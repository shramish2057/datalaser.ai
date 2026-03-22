import pandas as pd
import numpy as np
import io
import json
from typing import List, Tuple
from utils.date_parser import parse_date_safely
from models.schemas import TransformStep, TransformResult


class DataTransformer:

    def load_dataframe(self, file_bytes: bytes, file_type: str) -> pd.DataFrame:
        buf = io.BytesIO(file_bytes)
        na_vals = ["", "null", "NULL", "NA", "N/A", "nan", "NaN", "-", "\\N"]
        if file_type == "csv":
            return pd.read_csv(buf, na_values=na_vals)
        elif file_type in ("xlsx", "xls"):
            return pd.read_excel(buf)
        elif file_type == "json":
            return pd.read_json(buf)
        elif file_type == "parquet":
            return pd.read_parquet(buf)
        raise ValueError(f"Unsupported file type: {file_type}")

    def apply_steps(
        self,
        df: pd.DataFrame,
        steps: List[TransformStep],
        run_id: str,
    ) -> Tuple[pd.DataFrame, List[dict], List[dict]]:
        lineage = []
        errors = []

        for step in steps:
            try:
                rows_before = len(df)
                df, step_info = self._apply_step(df, step)
                rows_after = len(df)
                lineage.append({
                    "step_id": step.id,
                    "operation": step.operation,
                    "column": step.column,
                    "rows_before": rows_before,
                    "rows_after": rows_after,
                    "rows_affected": rows_before - rows_after
                    if rows_before > rows_after
                    else step_info.get("rows_affected", 0),
                })
            except Exception as e:
                errors.append({
                    "step_id": step.id,
                    "error": str(e),
                    "operation": step.operation,
                })

        return df, lineage, errors

    def _apply_step(
        self, df: pd.DataFrame, step: TransformStep
    ) -> Tuple[pd.DataFrame, dict]:
        op = step.operation
        col = step.column
        params = step.params or {}
        info: dict = {}

        if op == "fill_null":
            method = params.get("method", "median")
            if col not in df.columns:
                raise ValueError(f"Column '{col}' not found")
            null_count = int(df[col].isna().sum())
            if method == "median":
                df[col] = df[col].fillna(df[col].median())
            elif method == "mean":
                df[col] = df[col].fillna(df[col].mean())
            elif method == "mode":
                mode = df[col].mode()
                df[col] = df[col].fillna(mode[0] if not mode.empty else None)
            elif method == "zero":
                df[col] = df[col].fillna(0)
            elif method == "forward":
                df[col] = df[col].ffill()
            elif method == "drop":
                df = df.dropna(subset=[col])
            elif method == "custom":
                df[col] = df[col].fillna(params.get("value"))
            info["rows_affected"] = null_count

        elif op == "drop_null_rows":
            cols = [col] if col else None
            before = len(df)
            df = df.dropna(subset=cols)
            info["rows_affected"] = before - len(df)

        elif op == "cast_type":
            target = params.get("target_type", "string")
            if target == "int":
                df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
            elif target == "float":
                df[col] = pd.to_numeric(df[col], errors="coerce")
            elif target == "string":
                df[col] = df[col].astype(str)
            elif target == "date":
                df[col] = pd.to_datetime(df[col], errors="coerce")
            info["rows_affected"] = int(df[col].notna().sum())

        elif op == "rename_column":
            new_name = params.get("new_name")
            if new_name:
                df = df.rename(columns={col: new_name})

        elif op == "drop_column":
            if col in df.columns:
                df = df.drop(columns=[col])

        elif op == "trim_whitespace":
            if col and df[col].dtype == object:
                df[col] = df[col].str.strip()

        elif op == "standardise_case":
            case = params.get("case", "lower")
            if col and df[col].dtype == object:
                if case == "lower":
                    df[col] = df[col].str.lower()
                elif case == "upper":
                    df[col] = df[col].str.upper()
                elif case == "title":
                    df[col] = df[col].str.title()

        elif op == "normalise_dates":
            if col:
                df[col] = df[col].apply(
                    lambda x: parse_date_safely(str(x)) if pd.notna(x) else None
                )

        elif op == "deduplicate":
            keep = params.get("keep", "first")
            subset = params.get("columns", None)
            before = len(df)
            df = df.drop_duplicates(subset=subset, keep=keep)
            info["rows_affected"] = before - len(df)

        elif op == "filter_rows":
            column = params.get("column", col)
            operator = params.get("operator", "not_null")
            value = params.get("value")
            before = len(df)
            if operator == "not_null":
                df = df[df[column].notna()]
            elif operator == "==":
                df = df[df[column] == value]
            elif operator == "!=":
                df = df[df[column] != value]
            elif operator == ">":
                df = df[df[column] > float(value)]
            elif operator == "<":
                df = df[df[column] < float(value)]
            elif operator == "contains":
                df = df[df[column].astype(str).str.contains(str(value), na=False)]
            info["rows_affected"] = before - len(df)

        elif op == "clip_outliers":
            method = params.get("method", "iqr")
            multiplier = params.get("multiplier", 1.5)
            numeric_col = pd.to_numeric(df[col], errors="coerce")
            if method == "iqr":
                q1 = numeric_col.quantile(0.25)
                q3 = numeric_col.quantile(0.75)
                iqr = q3 - q1
                lower = q1 - multiplier * iqr
                upper = q3 + multiplier * iqr
                clipped = numeric_col.clip(lower=lower, upper=upper)
                info["rows_affected"] = int((numeric_col != clipped).sum())
                df[col] = clipped

        elif op == "split_column":
            delimiter = params.get("delimiter", " ")
            new_names = params.get("new_names", [f"{col}_1", f"{col}_2"])
            splits = df[col].astype(str).str.split(delimiter, expand=True)
            for i, name in enumerate(new_names):
                if i < splits.shape[1]:
                    df[name] = splits[i]

        elif op == "merge_columns":
            columns = params.get("columns", [])
            separator = params.get("separator", " ")
            new_name = params.get("new_name", "_".join(columns))
            df[new_name] = df[columns].astype(str).agg(separator.join, axis=1)

        elif op == "regex_replace":
            pattern = params.get("pattern", "")
            replacement = params.get("replacement", "")
            df[col] = df[col].astype(str).str.replace(pattern, replacement, regex=True)

        elif op == "normalise_numeric":
            method = params.get("method", "min-max")
            numeric_col = pd.to_numeric(df[col], errors="coerce")
            if method == "min-max":
                min_v = numeric_col.min()
                max_v = numeric_col.max()
                if max_v > min_v:
                    df[col] = (numeric_col - min_v) / (max_v - min_v)
            elif method == "z-score":
                df[col] = (numeric_col - numeric_col.mean()) / numeric_col.std()

        elif op == "one_hot_encode":
            max_cats = params.get("max_categories", 10)
            top_cats = df[col].value_counts().head(max_cats).index
            for cat in top_cats:
                new_col = f"{col}_{str(cat).lower().replace(' ', '_')}"
                df[new_col] = (df[col] == cat).astype(int)

        return df, info

    def get_preview(self, df: pd.DataFrame, n: int = 10) -> List[dict]:
        return df.head(n).fillna("").to_dict(orient="records")

    def to_csv_bytes(self, df: pd.DataFrame) -> bytes:
        buf = io.BytesIO()
        df.to_csv(buf, index=False)
        return buf.getvalue()


transformer = DataTransformer()
