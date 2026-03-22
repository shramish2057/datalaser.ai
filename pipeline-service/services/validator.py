import pandas as pd
import numpy as np
import re
import datetime
from typing import List, Tuple
from models.schemas import ValidationResult, ValidationReport

EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
PHONE_RE = re.compile(r'^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$')
NULL_STRINGS = {'', 'null', 'none', 'na', 'n/a', 'nan', '#n/a', '-', '--', 'missing', 'unknown', '?'}


def _is_float(value: str) -> bool:
    try:
        float(value.replace(',', '').replace('$', '').replace('%', ''))
        return True
    except (ValueError, TypeError):
        return False


class DataValidator:

    def validate(
        self,
        df: pd.DataFrame,
        run_id: str,
        source_name: str = "dataset",
    ) -> ValidationReport:
        tests: List[ValidationResult] = []

        tests.extend(self._test_row_count(df))
        tests.extend(self._test_completeness(df))
        tests.extend(self._test_uniqueness(df))
        tests.extend(self._test_type_consistency(df))
        tests.extend(self._test_value_ranges(df))
        tests.extend(self._test_categorical_validity(df))
        tests.extend(self._test_date_validity(df))
        tests.extend(self._test_string_patterns(df))

        overall, score = self._compute_overall(tests)
        summary = self._build_summary(tests, df)

        issues_count = sum(1 for t in tests if t.category == "issue" and t.status in ("warning", "failed"))
        characteristics_count = sum(1 for t in tests if t.category == "characteristic")

        return ValidationReport(
            run_id=run_id,
            overall_status=overall,
            score=score,
            tests=tests,
            summary=summary,
            issues_count=issues_count,
            characteristics_count=characteristics_count,
            fixable_resolved=issues_count == 0,
        )

    # ── Row count ─────────────────────────────────────────────────

    def _test_row_count(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []
        if len(df) == 0:
            results.append(ValidationResult(
                test_name="row_count_not_empty", column=None, status="failed",
                message="Dataset is empty — no rows to analyse", failing_rows=0, category="info",
            ))
        else:
            results.append(ValidationResult(
                test_name="row_count_not_empty", column=None, status="passed",
                message=f"Dataset has {len(df):,} rows", failing_rows=0, category="info",
            ))

        if 0 < len(df) < 10:
            results.append(ValidationResult(
                test_name="row_count_sufficient", column=None, status="warning",
                message=f"Dataset has only {len(df)} rows — results may not be statistically reliable",
                failing_rows=0, category="info",
            ))
        elif len(df) >= 10:
            results.append(ValidationResult(
                test_name="row_count_sufficient", column=None, status="passed",
                message=f"Dataset has sufficient rows ({len(df):,}) for analysis",
                failing_rows=0, category="info",
            ))
        return results

    # ── Completeness ──────────────────────────────────────────────

    def _test_completeness(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []
        for col in df.columns:
            series = df[col]
            null_count = int(series.isna().sum())
            if series.dtype == object:
                null_count += int(series.dropna().astype(str).str.strip().str.lower().isin(NULL_STRINGS).sum())

            null_rate = null_count / len(df) if len(df) > 0 else 0
            examples = df[col].dropna().head(3).astype(str).tolist()

            if null_rate == 0:
                status, message = "passed", "No missing values"
            elif null_rate < 0.05:
                status = "warning"
                message = f"{null_count} missing values ({round(null_rate*100,1)}%) — minor data loss"
            elif null_rate < 0.3:
                status = "warning"
                message = f"{null_count} missing values ({round(null_rate*100,1)}%) — consider imputation"
            else:
                status = "failed"
                message = f"{null_count} missing values ({round(null_rate*100,1)}%) — column may be unusable"

            results.append(ValidationResult(
                test_name="completeness", column=col, status=status,
                message=message, failing_rows=int(null_count), examples=examples,
            ))
        return results

    # ── Uniqueness ────────────────────────────────────────────────

    def _test_uniqueness(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []
        id_keywords = ['id', 'uuid', 'key', 'code', 'number', 'ref', 'no']

        for col in df.columns:
            col_lower = col.lower()
            is_id_col = any(col_lower.endswith(kw) or col_lower == kw for kw in id_keywords)
            if not is_id_col:
                continue

            total = len(df[col].dropna())
            unique = df[col].dropna().nunique()
            dup_count = total - unique

            if dup_count == 0:
                results.append(ValidationResult(
                    test_name="uniqueness", column=col, status="passed",
                    message=f"All {total:,} values are unique — good ID column",
                    failing_rows=0,
                ))
            else:
                dup_rate = dup_count / total if total > 0 else 0
                duplicates = df[col][df[col].duplicated()].head(5).astype(str).tolist()
                status = "warning" if dup_rate < 0.01 else "failed"
                results.append(ValidationResult(
                    test_name="uniqueness", column=col, status=status,
                    message=f"{dup_count} duplicate values ({round(dup_rate*100,1)}%) in ID column",
                    failing_rows=dup_count, examples=duplicates,
                ))
        return results

    # ── Type consistency ──────────────────────────────────────────

    def _test_type_consistency(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []
        for col in df.columns:
            if df[col].dtype != object:
                continue

            non_null = df[col].dropna().astype(str)
            if len(non_null) == 0:
                continue

            numeric_mask = non_null.str.replace(',', '', regex=False)\
                                   .str.replace('$', '', regex=False)\
                                   .str.replace('%', '', regex=False)\
                                   .apply(lambda x: _is_float(x))
            numeric_count = int(numeric_mask.sum())
            total = len(non_null)
            numeric_rate = numeric_count / total

            if 0.05 < numeric_rate < 0.95 and total > 10:
                bad_examples = non_null[~numeric_mask].head(3).tolist()
                results.append(ValidationResult(
                    test_name="type_consistency", column=col, status="warning",
                    message=f"Mixed types: {int(numeric_rate*100)}% numeric, {int((1-numeric_rate)*100)}% text",
                    failing_rows=int(total - numeric_count) if numeric_rate > 0.5 else int(numeric_count),
                    examples=bad_examples, category="characteristic",
                ))
            else:
                results.append(ValidationResult(
                    test_name="type_consistency", column=col, status="passed",
                    message="Values are consistently typed", failing_rows=0,
                ))
        return results

    # ── Value ranges ──────────────────────────────────────────────

    def _test_value_ranges(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []

        ID_KEYWORDS = ['id', 'key', 'code', 'number', 'no', 'ref',
                       'ticket', 'order', 'invoice', 'sku', 'zip',
                       'phone', 'mobile', 'postcode', 'passport']

        for col in df.columns:
            col_lower = col.lower()

            # Skip ID-like and code-like columns
            if any(kw in col_lower for kw in ID_KEYWORDS):
                continue

            numeric = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(numeric) < 10:
                continue

            # Skip high-cardinality columns (likely IDs or codes)
            unique_rate = df[col].nunique() / len(df[col].dropna()) if len(df[col].dropna()) > 0 else 0
            if unique_rate > 0.8:
                continue

            q1 = numeric.quantile(0.25)
            q3 = numeric.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower = q1 - 3 * iqr
            upper = q3 + 3 * iqr

            outliers = numeric[(numeric < lower) | (numeric > upper)]
            outlier_rate = len(outliers) / len(numeric)

            if len(outliers) == 0:
                results.append(ValidationResult(
                    test_name="value_range", column=col, status="passed",
                    message=f"No extreme outliers. Range: {numeric.min():.2f} — {numeric.max():.2f}",
                    failing_rows=0,
                ))
            elif outlier_rate < 0.02:
                results.append(ValidationResult(
                    test_name="value_range", column=col, status="warning",
                    message=f"{len(outliers)} extreme outliers ({round(outlier_rate*100,1)}%). Range: {numeric.min():.2f} — {numeric.max():.2f}",
                    failing_rows=len(outliers),
                    examples=[str(round(v, 2)) for v in outliers.head(3).tolist()],
                    category="characteristic",
                ))
            else:
                results.append(ValidationResult(
                    test_name="value_range", column=col, status="failed",
                    message=f"{len(outliers)} extreme outliers ({round(outlier_rate*100,1)}%) — likely data errors",
                    failing_rows=len(outliers),
                    examples=[str(round(v, 2)) for v in outliers.head(5).tolist()],
                ))
        return results

    # ── Categorical validity ──────────────────────────────────────

    def _test_categorical_validity(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []
        for col in df.columns:
            series = df[col].dropna().astype(str)
            if len(series) == 0:
                continue

            unique_count = series.nunique()
            if unique_count > 30 or unique_count < 2:
                continue

            unique_vals = series.unique().tolist()
            lowered = [v.lower().strip() for v in unique_vals]
            has_case_variants = len(set(lowered)) < len(lowered)

            if has_case_variants:
                results.append(ValidationResult(
                    test_name="categorical_consistency", column=col, status="warning",
                    message=f"Case variants detected in categorical column. Values: {unique_vals[:5]}",
                    failing_rows=0, examples=unique_vals[:5], category="characteristic",
                ))
            else:
                results.append(ValidationResult(
                    test_name="categorical_consistency", column=col, status="passed",
                    message=f"Categorical values are consistent ({unique_count} categories)",
                    failing_rows=0, examples=unique_vals[:5],
                ))
        return results

    # ── Date validity ─────────────────────────────────────────────

    def _test_date_validity(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []
        date_keywords = ['date', 'time', 'created', 'updated', '_at', '_on', 'timestamp']

        for col in df.columns:
            if not any(kw in col.lower() for kw in date_keywords):
                continue

            series = df[col].dropna().astype(str)
            if len(series) == 0:
                continue

            sample = series.head(20)
            parsed_count = 0
            future_count = 0
            now = datetime.datetime.now()

            for val in sample:
                try:
                    import dateparser
                    dt = dateparser.parse(val)
                    if dt:
                        parsed_count += 1
                        if dt > now:
                            future_count += 1
                except Exception:
                    pass

            parse_rate = parsed_count / len(sample) if len(sample) > 0 else 0

            if parse_rate < 0.5:
                results.append(ValidationResult(
                    test_name="date_validity", column=col, status="failed",
                    message=f"Only {int(parse_rate*100)}% of values could be parsed as dates",
                    failing_rows=int((1 - parse_rate) * len(series)),
                    examples=sample.head(3).tolist(),
                ))
            elif future_count > len(sample) * 0.5:
                results.append(ValidationResult(
                    test_name="date_validity", column=col, status="warning",
                    message="More than half of dates are in the future — check data freshness",
                    failing_rows=future_count, examples=sample.head(3).tolist(),
                ))
            else:
                results.append(ValidationResult(
                    test_name="date_validity", column=col, status="passed",
                    message=f"Date column parses correctly ({int(parse_rate*100)}% valid)",
                    failing_rows=0,
                ))
        return results

    # ── String patterns ───────────────────────────────────────────

    def _test_string_patterns(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []
        email_keywords = ['email', 'mail', 'e_mail']
        phone_keywords = ['phone', 'mobile', 'tel', 'cell']

        for col in df.columns:
            col_lower = col.lower()
            series = df[col].dropna().astype(str)
            if len(series) == 0:
                continue

            pattern = None
            pattern_name = None

            if any(kw in col_lower for kw in email_keywords):
                pattern = EMAIL_RE
                pattern_name = "email"
            elif any(kw in col_lower for kw in phone_keywords):
                pattern = PHONE_RE
                pattern_name = "phone number"

            if pattern is None:
                continue

            invalid = series[~series.str.strip().apply(lambda x: bool(pattern.match(x)))]
            invalid_rate = len(invalid) / len(series)

            if invalid_rate == 0:
                results.append(ValidationResult(
                    test_name="pattern_validity", column=col, status="passed",
                    message=f"All values match expected {pattern_name} format",
                    failing_rows=0,
                ))
            elif invalid_rate < 0.05:
                results.append(ValidationResult(
                    test_name="pattern_validity", column=col, status="warning",
                    message=f"{len(invalid)} invalid {pattern_name}s ({round(invalid_rate*100,1)}%)",
                    failing_rows=len(invalid), examples=invalid.head(3).tolist(),
                ))
            else:
                results.append(ValidationResult(
                    test_name="pattern_validity", column=col, status="failed",
                    message=f"{len(invalid)} invalid {pattern_name}s ({round(invalid_rate*100,1)}%) — column may contain wrong data",
                    failing_rows=len(invalid), examples=invalid.head(3).tolist(),
                ))
        return results

    # ── Scoring ───────────────────────────────────────────────────

    def _compute_overall(self, tests: List[ValidationResult]) -> Tuple[str, int]:
        if not tests:
            return "passed", 100

        # Only "issue" category affects score — characteristics and info don't
        issue_failures = sum(1 for t in tests if t.status == "failed" and t.category == "issue")
        issue_warnings = sum(1 for t in tests if t.status == "warning" and t.category == "issue")

        score = 100
        score -= (issue_failures * 15)
        score -= (issue_warnings * 5)
        score = max(0, min(100, score))

        if issue_failures > 0:
            overall = "failed"
        elif issue_warnings > 0:
            overall = "warning"
        else:
            overall = "passed"

        return overall, score

    def _build_summary(self, tests: List[ValidationResult], df: pd.DataFrame) -> str:
        issues = [t for t in tests if t.category == "issue" and t.status in ("warning", "failed")]
        chars = [t for t in tests if t.category == "characteristic"]
        passed_count = sum(1 for t in tests if t.status == "passed")

        if not issues:
            summary = "All fixable issues resolved. "
            if chars:
                summary += f"{len(chars)} data characteristic(s) noted (no action needed). "
        else:
            summary = f"{len(issues)} issue(s) need attention. "

        summary += f"{len(df):,} rows x {len(df.columns)} columns."
        return summary


    # ── Drift detection ────────────────────────────────────────

    def detect_schema_drift(
        self,
        current_profile: dict,
        previous_profile: dict,
    ) -> dict:
        drift: dict = {"detected": False, "details": []}

        current_cols = {c["name"]: c for c in current_profile.get("columns", [])}
        previous_cols = {c["name"]: c for c in previous_profile.get("columns", [])}

        # New columns added
        for col in set(current_cols.keys()) - set(previous_cols.keys()):
            drift["detected"] = True
            drift["details"].append({
                "type": "column_added",
                "column": col,
                "severity": "warning",
                "message": f"New column '{col}' appeared in the data",
            })

        # Columns removed
        for col in set(previous_cols.keys()) - set(current_cols.keys()):
            drift["detected"] = True
            drift["details"].append({
                "type": "column_removed",
                "column": col,
                "severity": "critical",
                "message": f"Column '{col}' was removed from the data",
            })

        # Type changes
        for col in set(current_cols.keys()) & set(previous_cols.keys()):
            curr = current_cols[col]
            prev = previous_cols[col]

            if curr.get("dtype") != prev.get("dtype"):
                drift["detected"] = True
                drift["details"].append({
                    "type": "type_change",
                    "column": col,
                    "severity": "critical",
                    "message": f"Column '{col}' changed type from {prev.get('dtype')} to {curr.get('dtype')}",
                })

            # Null rate drift (> 10% change)
            curr_null = curr.get("null_rate", 0)
            prev_null = prev.get("null_rate", 0)
            if abs(curr_null - prev_null) > 0.1:
                drift["detected"] = True
                drift["details"].append({
                    "type": "null_rate_drift",
                    "column": col,
                    "severity": "warning",
                    "message": f"Column '{col}' null rate changed from {round(prev_null*100,1)}% to {round(curr_null*100,1)}%",
                })

            # Row count drift (> 20% change)
            curr_rows = current_profile.get("total_rows", 0)
            prev_rows = previous_profile.get("total_rows", 0)
            if prev_rows > 0:
                change_pct = abs(curr_rows - prev_rows) / prev_rows
                if change_pct > 0.2:
                    drift["detected"] = True
                    drift["details"].append({
                        "type": "row_count_drift",
                        "column": None,
                        "severity": "warning",
                        "message": f"Row count changed by {round(change_pct*100,1)}% ({prev_rows} → {curr_rows})",
                    })

        return drift


validator = DataValidator()
