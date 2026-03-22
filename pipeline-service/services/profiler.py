import polars as pl
import pandas as pd
import numpy as np
import io
from collections import Counter

from utils.encoding import detect_encoding
from utils.type_detection import is_null_value, detect_semantic_type, count_true_nulls
from utils.date_parser import has_format_inconsistency
from models.schemas import DataProfile, ColumnProfile, QualityWarning


class DataProfiler:

    def profile_file(
        self,
        file_bytes: bytes,
        file_name: str,
        run_id: str,
        source_id: str,
    ) -> DataProfile:
        file_type = file_name.split('.')[-1].lower()
        file_size = len(file_bytes)

        encoding = detect_encoding(file_bytes)
        df = self._load_file(file_bytes, file_type, encoding)

        total_rows = len(df)
        total_columns = len(df.columns)

        column_profiles = []
        for col in df.columns:
            profile = self._profile_column(df, col, total_rows)
            column_profiles.append(profile)

        warnings = self._generate_warnings(column_profiles, total_rows)
        quality_score = self._compute_quality_score(warnings, column_profiles)
        quality_level = self._quality_level(quality_score)

        return DataProfile(
            run_id=run_id,
            source_id=source_id,
            file_name=file_name,
            file_type=file_type,
            total_rows=total_rows,
            total_columns=total_columns,
            file_size_bytes=file_size,
            columns=column_profiles,
            quality_score=quality_score,
            quality_level=quality_level,
            warnings=warnings,
            detected_encoding=encoding,
            has_header=True,
        )

    # ── File loading ─────────────────────────────────────────────

    def _load_file(self, file_bytes: bytes, file_type: str, encoding: str) -> pl.DataFrame:
        buf = io.BytesIO(file_bytes)
        try:
            if file_type == 'csv':
                return pl.read_csv(
                    buf, encoding=encoding, ignore_errors=True,
                    null_values=["", "null", "NULL", "NA", "N/A", "nan", "NaN", "None", "\\N", "\\\\N"],
                )
            elif file_type in ('xlsx', 'xls'):
                return pl.from_pandas(pd.read_excel(buf))
            elif file_type == 'json':
                return pl.read_json(buf)
            elif file_type == 'parquet':
                return pl.read_parquet(buf)
        except Exception:
            pass

        # Fallback to pandas
        buf.seek(0)
        na_vals = ["", "null", "NULL", "NA", "N/A", "nan", "NaN", "None", "-", "--", "\\N"]
        if file_type == 'csv':
            df_pd = pd.read_csv(buf, encoding=encoding, encoding_errors='replace', na_values=na_vals)
        elif file_type in ('xlsx', 'xls'):
            df_pd = pd.read_excel(buf)
        elif file_type == 'json':
            df_pd = pd.read_json(buf)
        else:
            df_pd = pd.read_parquet(buf)
        return pl.from_pandas(df_pd)

    # ── Per-column profiling ─────────────────────────────────────

    def _profile_column(self, df: pl.DataFrame, col: str, total_rows: int) -> ColumnProfile:
        series = df[col]
        raw_list = series.to_list()
        str_values = [str(v) if v is not None else '' for v in raw_list]
        non_null_strs = [v for v in str_values if not is_null_value(v)]

        # Also count Polars-level nulls
        polars_nulls = series.null_count()
        text_nulls = count_true_nulls(str_values)
        null_count = max(polars_nulls, text_nulls)
        null_rate = null_count / total_rows if total_rows > 0 else 0

        unique_values = set(non_null_strs)
        unique_count = len(unique_values)
        unique_rate = unique_count / len(non_null_strs) if non_null_strs else 0

        # Top values
        value_counts = Counter(non_null_strs).most_common(10)
        top_values = [{"value": v, "count": c} for v, c in value_counts]

        sample_values = non_null_strs[:5]
        dtype = self._detect_dtype(series, non_null_strs, col)

        # Numeric stats
        min_val = max_val = mean_val = median_val = std_val = None
        outlier_count = 0

        if dtype == 'numeric':
            numeric_vals = []
            for v in non_null_strs:
                try:
                    numeric_vals.append(float(v.replace(',', '').replace('$', '').replace('%', '')))
                except (ValueError, AttributeError):
                    pass

            if numeric_vals:
                arr = np.array(numeric_vals)
                min_val = float(np.min(arr))
                max_val = float(np.max(arr))
                mean_val = float(np.mean(arr))
                median_val = float(np.median(arr))
                std_val = float(np.std(arr))

                q1, q3 = np.percentile(arr, [25, 75])
                iqr = q3 - q1
                if iqr > 0:
                    lower = q1 - 1.5 * iqr
                    upper = q3 + 1.5 * iqr
                    outlier_count = int(np.sum((arr < lower) | (arr > upper)))

        # Mixed types
        mixed_types = False
        if dtype == 'numeric' and non_null_strs:
            numeric_count = sum(1 for v in non_null_strs if self._is_numeric(v))
            mixed_types = numeric_count < len(non_null_strs) * 0.95

        # Format issues for dates
        format_issues = False
        if dtype == 'date':
            format_issues = has_format_inconsistency(non_null_strs[:20])

        return ColumnProfile(
            name=col,
            dtype=dtype,
            null_rate=round(null_rate, 4),
            unique_rate=round(unique_rate, 4),
            total_values=len(non_null_strs),
            null_count=null_count,
            unique_count=unique_count,
            min_value=min_val,
            max_value=max_val,
            mean_value=round(mean_val, 4) if mean_val is not None else None,
            median_value=round(median_val, 4) if median_val is not None else None,
            std_dev=round(std_val, 4) if std_val is not None else None,
            top_values=top_values,
            sample_values=sample_values,
            format_issues=format_issues,
            mixed_types=mixed_types,
            outlier_count=outlier_count,
        )

    # ── Type detection ───────────────────────────────────────────

    def _detect_dtype(self, series: pl.Series, non_null_strs: list, col_name: str) -> str:
        lower_name = col_name.lower()

        # Date heuristic by name
        date_keywords = ['date', 'time', 'created', 'updated', 'timestamp', '_at', '_on']
        if any(kw in lower_name for kw in date_keywords):
            return 'date'

        # ID heuristic by name
        id_keywords = ['_id', 'uuid', 'key']
        if any(lower_name.endswith(kw) or lower_name == kw for kw in id_keywords):
            return 'id'
        if lower_name == 'id':
            return 'id'

        # Check Polars dtype first
        polars_dtype = str(series.dtype)
        if polars_dtype in ('Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Float32', 'Float64'):
            return 'numeric'

        # Numeric by value inspection
        if non_null_strs:
            sample = non_null_strs[:50]
            numeric_count = sum(1 for v in sample if self._is_numeric(v))
            if numeric_count / len(sample) >= 0.8:
                return 'numeric'

        # Long text
        if non_null_strs:
            avg_len = sum(len(v) for v in non_null_strs[:20]) / min(len(non_null_strs), 20)
            if avg_len > 50:
                return 'text'

        return 'categorical'

    def _is_numeric(self, value: str) -> bool:
        try:
            float(str(value).replace(',', '').replace('$', '').replace('%', ''))
            return True
        except (ValueError, AttributeError):
            return False

    # ── Quality scoring ──────────────────────────────────────────

    def _generate_warnings(self, columns: list, total_rows: int) -> list:
        warnings = []
        for col in columns:
            # Missing values
            if col.null_rate > 0.6:
                warnings.append(QualityWarning(
                    column=col.name, issue='missing_values', severity='red',
                    detail=f'{round(col.null_rate * 100, 1)}% of values are missing',
                    affected_rows=col.null_count,
                ))
            elif col.null_rate > 0.2:
                warnings.append(QualityWarning(
                    column=col.name, issue='missing_values', severity='amber',
                    detail=f'{round(col.null_rate * 100, 1)}% of values are missing',
                    affected_rows=col.null_count,
                ))
            elif col.null_rate > 0.05:
                warnings.append(QualityWarning(
                    column=col.name, issue='missing_values', severity='yellow',
                    detail=f'{round(col.null_rate * 100, 1)}% of values are missing',
                    affected_rows=col.null_count,
                ))

            # Mixed types
            if col.mixed_types:
                warnings.append(QualityWarning(
                    column=col.name, issue='mixed_types', severity='amber',
                    detail='Column contains both numeric and text values',
                ))

            # Format inconsistency
            if col.format_issues:
                warnings.append(QualityWarning(
                    column=col.name, issue='format_inconsistency', severity='amber',
                    detail='Multiple date formats detected in this column',
                ))

            # Outliers
            if col.outlier_count > 0 and col.total_values > 0:
                outlier_pct = col.outlier_count / col.total_values
                if outlier_pct > 0.05:
                    warnings.append(QualityWarning(
                        column=col.name, issue='outliers', severity='yellow',
                        detail=f'{col.outlier_count} outliers detected ({round(outlier_pct * 100, 1)}% of values)',
                        affected_rows=col.outlier_count,
                    ))

        return warnings

    def _compute_quality_score(self, warnings: list, columns: list) -> int:
        penalty = 0
        for w in warnings:
            if w.severity == 'red':
                penalty += 20
            elif w.severity == 'amber':
                penalty += 10
            elif w.severity == 'yellow':
                penalty += 5
        return max(0, 100 - penalty)

    def _quality_level(self, score: int) -> str:
        if score >= 90:
            return 'good'
        if score >= 70:
            return 'yellow'
        if score >= 50:
            return 'amber'
        return 'red'

    # ── Database profiling ───────────────────────────────────────

    def profile_database_table(
        self,
        connection_string: str,
        table_name: str,
        run_id: str,
        source_id: str,
    ) -> DataProfile:
        import sqlalchemy
        engine = sqlalchemy.create_engine(connection_string)
        df_pd = pd.read_sql(f"SELECT * FROM {table_name} LIMIT 100000", engine)
        buf = io.BytesIO()
        df_pd.to_csv(buf, index=False)
        return self.profile_file(
            file_bytes=buf.getvalue(),
            file_name=f"{table_name}.csv",
            run_id=run_id,
            source_id=source_id,
        )


profiler = DataProfiler()
