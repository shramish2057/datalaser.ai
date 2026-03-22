import pandas as pd
import io
from typing import List, Dict
from rapidfuzz import fuzz
from models.schemas import JoinDefinition, JoinCandidate


class JoinEngine:

    def load_source(self, file_bytes: bytes, file_type: str) -> pd.DataFrame:
        buf = io.BytesIO(file_bytes)
        na_vals = ["", "null", "NULL", "NA", "N/A", "nan"]
        if file_type == "csv":
            return pd.read_csv(buf, na_values=na_vals)
        elif file_type in ("xlsx", "xls"):
            return pd.read_excel(buf)
        elif file_type == "json":
            return pd.read_json(buf)
        elif file_type == "parquet":
            return pd.read_parquet(buf)
        raise ValueError(f"Unsupported file type: {file_type}")

    def detect_join_candidates(
        self,
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        alias1: str,
        alias2: str,
    ) -> List[JoinCandidate]:
        candidates = []

        for col1 in df1.columns:
            for col2 in df2.columns:
                if not self._types_compatible(df1[col1], df2[col2]):
                    continue

                # Name similarity
                name_score = fuzz.ratio(
                    col1.lower().replace("_", "").replace("-", ""),
                    col2.lower().replace("_", "").replace("-", ""),
                ) / 100

                # Value overlap
                set1 = set(df1[col1].dropna().astype(str).str.strip().values)
                set2 = set(df2[col2].dropna().astype(str).str.strip().values)

                if not set1 or not set2:
                    continue

                intersection = len(set1 & set2)
                union = len(set1 | set2)
                overlap = intersection / union if union > 0 else 0

                smaller_set_overlap = (
                    intersection / min(len(set1), len(set2))
                    if min(len(set1), len(set2)) > 0
                    else 0
                )

                # Combined: name 30%, overlap 50%, smaller-set 20%
                score = (name_score * 0.30) + (overlap * 0.50) + (smaller_set_overlap * 0.20)

                if score > 0.45:
                    candidates.append(
                        JoinCandidate(
                            left_column=col1,
                            right_column=col2,
                            confidence=round(score, 3),
                            overlap_pct=round(smaller_set_overlap * 100, 1),
                            name_similarity=round(name_score, 3),
                        )
                    )

        candidates.sort(key=lambda x: -x.confidence)

        # Deduplicate — best match per column
        seen_left: set = set()
        seen_right: set = set()
        deduped = []
        for c in candidates:
            if c.left_column not in seen_left and c.right_column not in seen_right:
                deduped.append(c)
                seen_left.add(c.left_column)
                seen_right.add(c.right_column)

        return deduped[:5]

    def _types_compatible(self, s1: pd.Series, s2: pd.Series) -> bool:
        if pd.api.types.is_numeric_dtype(s1) and pd.api.types.is_numeric_dtype(s2):
            return True
        if s1.dtype == object and s2.dtype == object:
            return True
        if s1.dtype == object or s2.dtype == object:
            return True
        return False

    def apply_join(
        self,
        dataframes: Dict[str, pd.DataFrame],
        joins: List[JoinDefinition],
    ) -> pd.DataFrame:
        if not dataframes:
            raise ValueError("No dataframes provided")

        aliases = list(dataframes.keys())
        result = dataframes[aliases[0]].copy()
        current_alias = aliases[0]

        for join_def in joins:
            right_alias = join_def.right_source
            right_df = dataframes[right_alias]

            left_col = join_def.left_column
            right_col = join_def.right_column
            join_type = join_def.join_type.value

            if left_col == right_col:
                result = result.merge(
                    right_df, on=left_col, how=join_type,
                    suffixes=("", f"_{right_alias}"),
                )
            else:
                result = result.merge(
                    right_df, left_on=left_col, right_on=right_col,
                    how=join_type, suffixes=("", f"_{right_alias}"),
                )

            current_alias = f"{current_alias}_{right_alias}"

        return result

    def get_join_stats(
        self,
        df_before_left: pd.DataFrame,
        df_before_right: pd.DataFrame,
        df_after: pd.DataFrame,
        join_type: str,
    ) -> dict:
        return {
            "left_rows": len(df_before_left),
            "right_rows": len(df_before_right),
            "result_rows": len(df_after),
            "result_columns": len(df_after.columns),
            "rows_dropped": max(0, len(df_before_left) - len(df_after))
            if join_type == "inner"
            else 0,
            "pct_kept": round(len(df_after) / len(df_before_left) * 100, 1)
            if len(df_before_left) > 0
            else 100,
        }


joiner = JoinEngine()
