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
                # Only flag outliers if IQR is meaningful (skip zero-heavy distributions
                # like discount columns where most values are 0)
                if iqr > 0 and (q1 != 0 or q3 != 0):
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

        semantic_role = self._detect_semantic_role(dtype, unique_count, unique_rate, col, non_null_strs, total_rows)

        return ColumnProfile(
            name=col,
            dtype=dtype,
            semantic_role=semantic_role,
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

        # Date heuristic by name (English + German)
        date_keywords = ['date', 'time', 'created', 'updated', 'timestamp', '_at', '_on',
                         'datum', 'zeitpunkt', 'erstellt', 'aktualisiert', 'produktionsdatum',
                         'bestelldatum', 'lieferdatum', 'rechnungsdatum']
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

    def _detect_semantic_role(self, dtype: str, unique_count: int, unique_rate: float,
                               col_name: str, non_null_strs: list, total_rows: int) -> str:
        """Classify column into a semantic role for analysis."""
        if dtype == 'date':
            return 'date'
        if dtype == 'id':
            return 'id'
        if dtype == 'numeric':
            # Binary: exactly 2 unique values (e.g. 0/1, Survived)
            if unique_count == 2:
                return 'binary'
            # ID-like numeric: high cardinality sequential integers
            if unique_rate > 0.9 and unique_count > 20:
                return 'id'
            return 'measure'
        if dtype == 'categorical':
            # Check for binary text (yes/no, true/false, m/f)
            if unique_count == 2:
                return 'binary'
            # Low cardinality = dimension (good for grouping)
            if unique_count <= 50:
                return 'dimension'
            # High cardinality categorical = text/free-form
            return 'text'
        if dtype == 'text':
            return 'text'
        return 'unknown'

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

    # ── SQL type mapping ────────────────────────────────────────

    def _sql_type_to_dtype(self, sql_type: str, col_name: str) -> str:
        lower_name = col_name.lower()
        # German + English date keywords
        date_keywords = ['date', 'time', 'created', 'updated', 'timestamp', '_at', '_on',
                         'datum', 'zeitpunkt', 'erstellt', 'produktionsdatum', 'bestelldatum']
        if any(kw in lower_name for kw in date_keywords):
            return 'date'
        id_keywords = ['_id', 'uuid', 'key']
        if any(lower_name.endswith(kw) or lower_name == kw for kw in id_keywords) or lower_name == 'id':
            return 'id'

        t = sql_type.lower()
        if any(k in t for k in ['int', 'float', 'double', 'decimal', 'numeric', 'real', 'money', 'serial']):
            return 'numeric'
        if any(k in t for k in ['date', 'time', 'timestamp']):
            return 'date'
        if 'bool' in t:
            return 'categorical'
        if 'uuid' in t:
            return 'id'
        return 'categorical'

    # ── Database profiling (SQL aggregates only, no raw rows) ─

    def profile_database_table(
        self,
        connection_string: str,
        table_name: str,
        run_id: str,
        source_id: str,
    ) -> DataProfile:
        import sqlalchemy
        engine = sqlalchemy.create_engine(connection_string)

        with engine.connect() as conn:
            # 1. Get row count
            row_count = conn.execute(sqlalchemy.text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar()

            # 2. Get column metadata from information_schema
            col_query = sqlalchemy.text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = :table
                ORDER BY ordinal_position
            """)
            col_rows = conn.execute(col_query, {"table": table_name}).fetchall()

            # 3. For each column, compute stats via SQL
            columns = []
            for col_name, data_type, is_nullable in col_rows:
                # Null count
                null_count = conn.execute(
                    sqlalchemy.text(f'SELECT COUNT(*) FROM "{table_name}" WHERE "{col_name}" IS NULL')
                ).scalar()
                null_rate = null_count / row_count if row_count > 0 else 0

                # Unique count
                unique_count = conn.execute(
                    sqlalchemy.text(f'SELECT COUNT(DISTINCT "{col_name}") FROM "{table_name}"')
                ).scalar()
                unique_rate = unique_count / (row_count - null_count) if (row_count - null_count) > 0 else 0

                # Determine dtype from SQL data_type
                dtype = self._sql_type_to_dtype(data_type, col_name)

                # Numeric stats (only for numeric columns)
                min_val = max_val = mean_val = median_val = std_val = None
                outlier_count = 0
                if dtype == 'numeric':
                    stats = conn.execute(sqlalchemy.text(f'''
                        SELECT MIN("{col_name}")::float, MAX("{col_name}")::float,
                               AVG("{col_name}")::float, STDDEV("{col_name}")::float,
                               PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "{col_name}") as q1,
                               PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "{col_name}") as median,
                               PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "{col_name}") as q3
                        FROM "{table_name}" WHERE "{col_name}" IS NOT NULL
                    ''')).fetchone()
                    if stats and stats[0] is not None:
                        min_val, max_val, mean_val, std_val = float(stats[0]), float(stats[1]), float(stats[2]), float(stats[3]) if stats[3] else 0
                        median_val = float(stats[5]) if stats[5] else None
                        q1, q3 = float(stats[4]) if stats[4] else 0, float(stats[6]) if stats[6] else 0
                        iqr = q3 - q1
                        if iqr > 0 and (q1 != 0 or q3 != 0):
                            lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                            outlier_count = conn.execute(sqlalchemy.text(f'''
                                SELECT COUNT(*) FROM "{table_name}"
                                WHERE "{col_name}" IS NOT NULL
                                AND ("{col_name}" < :lower OR "{col_name}" > :upper)
                            '''), {"lower": lower, "upper": upper}).scalar()

                # Top values for categoricals (no raw data, just value counts)
                top_values = []
                sample_values = []
                if dtype in ('categorical', 'text'):
                    top_rows = conn.execute(sqlalchemy.text(f'''
                        SELECT "{col_name}"::text, COUNT(*) as cnt
                        FROM "{table_name}" WHERE "{col_name}" IS NOT NULL
                        GROUP BY "{col_name}" ORDER BY cnt DESC LIMIT 10
                    ''')).fetchall()
                    top_values = [{"value": str(r[0]), "count": int(r[1])} for r in top_rows]
                    sample_values = [str(r[0]) for r in top_rows[:5]]

                semantic_role = self._detect_semantic_role(dtype, unique_count, unique_rate, col_name, sample_values, row_count)

                columns.append(ColumnProfile(
                    name=col_name, dtype=dtype, semantic_role=semantic_role,
                    null_rate=round(null_rate, 4), unique_rate=round(unique_rate, 4),
                    total_values=row_count - null_count, null_count=null_count,
                    unique_count=unique_count,
                    min_value=min_val, max_value=max_val,
                    mean_value=round(mean_val, 4) if mean_val else None,
                    median_value=round(median_val, 4) if median_val else None,
                    std_dev=round(std_val, 4) if std_val else None,
                    top_values=top_values, sample_values=sample_values,
                    format_issues=False, mixed_types=False, outlier_count=outlier_count or 0,
                ))

            warnings = self._generate_warnings(columns, row_count)
            quality_score = self._compute_quality_score(warnings, columns)
            quality_level = self._quality_level(quality_score)

            return DataProfile(
                run_id=run_id, source_id=source_id,
                file_name=table_name, file_type='database',
                total_rows=row_count, total_columns=len(columns),
                file_size_bytes=0, columns=columns,
                quality_score=quality_score, quality_level=quality_level,
                warnings=warnings, detected_encoding='N/A', has_header=True,
            )


profiler = DataProfiler()
