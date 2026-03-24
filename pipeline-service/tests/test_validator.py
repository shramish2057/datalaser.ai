"""Tests for services.validator.DataValidator."""
import pytest
import pandas as pd
import numpy as np

from services.validator import DataValidator
from models.schemas import ValidationReport


@pytest.fixture
def validator():
    return DataValidator()


# ---------------------------------------------------------------------------
# Completeness
# ---------------------------------------------------------------------------

class TestCompleteness:

    def test_detects_null_columns(self, validator):
        df = pd.DataFrame({
            "a": [1, 2, None, None, None, None, None, None, None, None],
            "b": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        })
        report = validator.validate(df, run_id="r1")
        # Column 'a' has 80% nulls -> should have a failed completeness test
        completeness_a = [t for t in report.tests if t.test_name == "completeness" and t.column == "a"]
        assert len(completeness_a) == 1
        assert completeness_a[0].status == "failed"

    def test_no_nulls_passes(self, validator):
        df = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})
        report = validator.validate(df, run_id="r1")
        completeness = [t for t in report.tests if t.test_name == "completeness"]
        assert all(t.status == "passed" for t in completeness)

    def test_null_strings_counted(self, validator):
        """Null-like strings (NA, null, etc.) should be counted as missing."""
        df = pd.DataFrame({"col": ["hello", "NA", "null", "None", "world",
                                    "data", "N/A", "actual", "real", "yes"]})
        report = validator.validate(df, run_id="r1")
        completeness = [t for t in report.tests if t.test_name == "completeness" and t.column == "col"]
        assert completeness[0].failing_rows > 0


# ---------------------------------------------------------------------------
# Type consistency
# ---------------------------------------------------------------------------

class TestTypeConsistency:

    def test_detects_mixed_types(self, validator):
        """A column with mix of numeric and text values should be flagged."""
        values = [str(i) for i in range(8)] + ["abc", "def", "ghi", "jkl"]
        df = pd.DataFrame({"mixed": values})
        report = validator.validate(df, run_id="r1")
        type_tests = [t for t in report.tests if t.test_name == "type_consistency" and t.column == "mixed"]
        # Should detect the mix
        assert len(type_tests) == 1
        assert type_tests[0].status in ("warning", "failed")

    def test_consistent_types_pass(self, validator):
        df = pd.DataFrame({"nums": [1, 2, 3, 4, 5], "texts": ["a", "b", "c", "d", "e"]})
        report = validator.validate(df, run_id="r1")
        type_tests = [t for t in report.tests if t.test_name == "type_consistency"]
        for t in type_tests:
            assert t.status == "passed"


# ---------------------------------------------------------------------------
# Outlier detection skips ID columns
# ---------------------------------------------------------------------------

class TestOutlierSkipsID:

    @pytest.mark.parametrize("col_name", [
        "ticket_id", "order_number", "ref_code", "PassengerId",
    ])
    def test_skips_id_like_columns(self, validator, col_name):
        """Columns matching ticket|id|code|number|ref should be skipped for outlier detection."""
        df = pd.DataFrame({
            col_name: list(range(100)) + [99999],  # extreme outlier
        })
        report = validator.validate(df, run_id="r1")
        range_tests = [t for t in report.tests if t.test_name == "value_range" and t.column == col_name]
        # Should be empty - the column should be skipped
        assert len(range_tests) == 0


# ---------------------------------------------------------------------------
# Scoring: only "issue" category penalizes
# ---------------------------------------------------------------------------

class TestScoring:

    def test_characteristics_do_not_penalize(self, validator):
        """Characteristic findings should NOT reduce the score."""
        from models.schemas import ValidationResult
        tests = [
            ValidationResult(test_name="type_consistency", column="x", status="warning",
                             message="Mixed types", failing_rows=5, category="characteristic"),
            ValidationResult(test_name="completeness", column="y", status="passed",
                             message="OK", failing_rows=0, category="issue"),
        ]
        overall, score = validator._compute_overall(tests)
        assert score == 100  # characteristic warning doesn't penalize

    def test_issue_warnings_penalize(self, validator):
        from models.schemas import ValidationResult
        tests = [
            ValidationResult(test_name="completeness", column="x", status="warning",
                             message="missing", failing_rows=5, category="issue"),
        ]
        overall, score = validator._compute_overall(tests)
        assert score == 95  # -5 for one issue warning
        assert overall == "warning"

    def test_issue_failures_penalize_more(self, validator):
        from models.schemas import ValidationResult
        tests = [
            ValidationResult(test_name="completeness", column="x", status="failed",
                             message="bad", failing_rows=50, category="issue"),
        ]
        overall, score = validator._compute_overall(tests)
        assert score == 85  # -15 for one issue failure
        assert overall == "failed"

    def test_info_does_not_penalize(self, validator):
        from models.schemas import ValidationResult
        tests = [
            ValidationResult(test_name="row_count_not_empty", column=None, status="passed",
                             message="OK", failing_rows=0, category="info"),
        ]
        _, score = validator._compute_overall(tests)
        assert score == 100


# ---------------------------------------------------------------------------
# Structured results
# ---------------------------------------------------------------------------

class TestStructuredResults:

    def test_report_structure(self, validator, titanic_df):
        report = validator.validate(titanic_df, run_id="r1")
        assert isinstance(report, ValidationReport)
        assert report.run_id == "r1"
        assert isinstance(report.score, int)
        assert report.overall_status in ("passed", "warning", "failed")
        assert isinstance(report.tests, list)
        assert len(report.tests) > 0
        assert isinstance(report.summary, str)

    def test_each_test_has_severity(self, validator, titanic_df):
        report = validator.validate(titanic_df, run_id="r1")
        for t in report.tests:
            assert t.status in ("passed", "warning", "failed")
            assert t.category in ("issue", "characteristic", "info")


# ---------------------------------------------------------------------------
# Schema drift detection
# ---------------------------------------------------------------------------

class TestSchemaDrift:

    def test_detects_new_column(self, validator):
        prev = {"columns": [{"name": "a", "dtype": "numeric", "null_rate": 0}], "total_rows": 100}
        curr = {"columns": [{"name": "a", "dtype": "numeric", "null_rate": 0},
                            {"name": "b", "dtype": "text", "null_rate": 0}], "total_rows": 100}
        drift = validator.detect_schema_drift(curr, prev)
        assert drift["detected"]
        types = [d["type"] for d in drift["details"]]
        assert "column_added" in types

    def test_detects_type_change(self, validator):
        prev = {"columns": [{"name": "a", "dtype": "numeric", "null_rate": 0}], "total_rows": 100}
        curr = {"columns": [{"name": "a", "dtype": "text", "null_rate": 0}], "total_rows": 100}
        drift = validator.detect_schema_drift(curr, prev)
        assert drift["detected"]
        types = [d["type"] for d in drift["details"]]
        assert "type_change" in types
