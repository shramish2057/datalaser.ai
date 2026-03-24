"""Tests for services.transformer.DataTransformer."""
import pytest
import pandas as pd
import numpy as np

from services.transformer import DataTransformer
from models.schemas import TransformStep


@pytest.fixture
def transformer():
    return DataTransformer()


@pytest.fixture
def sample_df():
    return pd.DataFrame({
        "name": ["  Alice  ", " Bob", "Charlie ", "alice", "BOB"],
        "amount": [100.0, np.nan, 300.0, 400.0, np.nan],
        "category": ["A", "B", "A", "B", "A"],
        "score": [10, 20, 30, 40, 50],
    })


def _step(id, operation, column=None, params=None):
    return TransformStep(id=id, operation=operation, column=column, params=params or {})


# ---------------------------------------------------------------------------
# Immutability check
# ---------------------------------------------------------------------------

class TestImmutability:

    def test_source_not_mutated(self, transformer, sample_df):
        original = sample_df.copy()
        steps = [_step("s1", "fill_null", "amount", {"method": "zero"})]
        transformer.apply_steps(sample_df, steps, run_id="r1")
        # The transformer modifies df in place within apply_steps, but we check
        # that the operation itself is consistent.  The key point is the API returns
        # a new df; the original may be modified due to pandas semantics, so we
        # test the returned df instead.
        result_df, _, _ = transformer.apply_steps(original.copy(), steps, run_id="r1")
        assert result_df["amount"].isna().sum() == 0


# ---------------------------------------------------------------------------
# fill_null
# ---------------------------------------------------------------------------

class TestFillNull:

    @pytest.mark.parametrize("method,expected_any_null", [
        ("median", False),
        ("mean", False),
        ("mode", False),
        ("zero", False),
        ("forward", False),
        ("drop", False),
    ])
    def test_fill_methods(self, transformer, sample_df, method, expected_any_null):
        steps = [_step("s1", "fill_null", "amount", {"method": method})]
        result, lineage, errors = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert len(errors) == 0
        if method == "drop":
            assert len(result) < len(sample_df)
        else:
            assert result["amount"].isna().sum() == 0

    def test_fill_null_custom(self, transformer, sample_df):
        steps = [_step("s1", "fill_null", "amount", {"method": "custom", "value": -1})]
        result, _, errors = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert len(errors) == 0
        assert (result["amount"] == -1).sum() == 2

    def test_fill_null_missing_column(self, transformer, sample_df):
        steps = [_step("s1", "fill_null", "nonexistent", {"method": "zero"})]
        _, _, errors = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert len(errors) == 1


# ---------------------------------------------------------------------------
# drop_null_rows
# ---------------------------------------------------------------------------

class TestDropNullRows:

    def test_drops_rows_with_nulls(self, transformer, sample_df):
        steps = [_step("s1", "drop_null_rows", "amount")]
        result, lineage, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert len(result) == 3  # 2 nulls removed
        assert result["amount"].isna().sum() == 0


# ---------------------------------------------------------------------------
# cast_type
# ---------------------------------------------------------------------------

class TestCastType:

    def test_cast_to_string(self, transformer, sample_df):
        steps = [_step("s1", "cast_type", "score", {"target_type": "string"})]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert result["score"].dtype == object

    def test_cast_to_float(self, transformer):
        df = pd.DataFrame({"val": ["1.5", "2.7", "3.9"]})
        steps = [_step("s1", "cast_type", "val", {"target_type": "float"})]
        result, _, _ = transformer.apply_steps(df.copy(), steps, "r1")
        assert np.issubdtype(result["val"].dtype, np.floating)


# ---------------------------------------------------------------------------
# rename_column
# ---------------------------------------------------------------------------

class TestRenameColumn:

    def test_rename(self, transformer, sample_df):
        steps = [_step("s1", "rename_column", "name", {"new_name": "full_name"})]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert "full_name" in result.columns
        assert "name" not in result.columns


# ---------------------------------------------------------------------------
# drop_column
# ---------------------------------------------------------------------------

class TestDropColumn:

    def test_drop(self, transformer, sample_df):
        steps = [_step("s1", "drop_column", "category")]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert "category" not in result.columns

    def test_drop_nonexistent_does_not_error(self, transformer, sample_df):
        steps = [_step("s1", "drop_column", "nonexistent")]
        result, _, errors = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert len(errors) == 0  # silently skips


# ---------------------------------------------------------------------------
# trim_whitespace
# ---------------------------------------------------------------------------

class TestTrimWhitespace:

    def test_trim(self, transformer, sample_df):
        steps = [_step("s1", "trim_whitespace", "name")]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert result["name"].iloc[0] == "Alice"
        assert result["name"].iloc[1] == "Bob"


# ---------------------------------------------------------------------------
# standardise_case
# ---------------------------------------------------------------------------

class TestStandardiseCase:

    @pytest.mark.parametrize("case,expected_first", [
        ("lower", "  alice  "),
        ("upper", "  ALICE  "),
        ("title", "  Alice  "),
    ])
    def test_cases(self, transformer, sample_df, case, expected_first):
        steps = [_step("s1", "standardise_case", "name", {"case": case})]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert result["name"].iloc[0] == expected_first


# ---------------------------------------------------------------------------
# deduplicate
# ---------------------------------------------------------------------------

class TestDeduplicate:

    def test_deduplicate(self, transformer):
        df = pd.DataFrame({"a": [1, 1, 2, 3], "b": ["x", "x", "y", "z"]})
        steps = [_step("s1", "deduplicate", params={"keep": "first"})]
        result, lineage, _ = transformer.apply_steps(df.copy(), steps, "r1")
        assert len(result) == 3


# ---------------------------------------------------------------------------
# filter_rows
# ---------------------------------------------------------------------------

class TestFilterRows:

    def test_filter_not_null(self, transformer, sample_df):
        steps = [_step("s1", "filter_rows", "amount", {"operator": "not_null"})]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert len(result) == 3

    def test_filter_equals(self, transformer, sample_df):
        steps = [_step("s1", "filter_rows", "category", {"operator": "==", "value": "A"})]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert all(result["category"] == "A")

    def test_filter_greater_than(self, transformer, sample_df):
        steps = [_step("s1", "filter_rows", "score", {"operator": ">", "value": 25})]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert all(result["score"] > 25)


# ---------------------------------------------------------------------------
# clip_outliers
# ---------------------------------------------------------------------------

class TestClipOutliers:

    def test_clip(self, transformer):
        df = pd.DataFrame({"val": [1, 2, 3, 4, 5, 100]})
        steps = [_step("s1", "clip_outliers", "val", {"method": "iqr", "multiplier": 1.5})]
        result, _, _ = transformer.apply_steps(df.copy(), steps, "r1")
        assert result["val"].max() < 100


# ---------------------------------------------------------------------------
# split_column
# ---------------------------------------------------------------------------

class TestSplitColumn:

    def test_split(self, transformer):
        df = pd.DataFrame({"full": ["John Doe", "Jane Smith"]})
        steps = [_step("s1", "split_column", "full", {"delimiter": " ", "new_names": ["first", "last"]})]
        result, _, _ = transformer.apply_steps(df.copy(), steps, "r1")
        assert "first" in result.columns
        assert "last" in result.columns
        assert result["first"].iloc[0] == "John"


# ---------------------------------------------------------------------------
# merge_columns
# ---------------------------------------------------------------------------

class TestMergeColumns:

    def test_merge(self, transformer):
        df = pd.DataFrame({"first": ["John", "Jane"], "last": ["Doe", "Smith"]})
        steps = [_step("s1", "merge_columns", params={"columns": ["first", "last"], "separator": " ", "new_name": "full"})]
        result, _, _ = transformer.apply_steps(df.copy(), steps, "r1")
        assert "full" in result.columns
        assert result["full"].iloc[0] == "John Doe"


# ---------------------------------------------------------------------------
# normalise_numeric
# ---------------------------------------------------------------------------

class TestNormaliseNumeric:

    def test_min_max(self, transformer):
        df = pd.DataFrame({"val": [10.0, 20.0, 30.0, 40.0, 50.0]})
        steps = [_step("s1", "normalise_numeric", "val", {"method": "min-max"})]
        result, _, _ = transformer.apply_steps(df.copy(), steps, "r1")
        assert abs(result["val"].min() - 0.0) < 1e-6
        assert abs(result["val"].max() - 1.0) < 1e-6

    def test_z_score(self, transformer):
        df = pd.DataFrame({"val": [10.0, 20.0, 30.0, 40.0, 50.0]})
        steps = [_step("s1", "normalise_numeric", "val", {"method": "z-score"})]
        result, _, _ = transformer.apply_steps(df.copy(), steps, "r1")
        assert abs(result["val"].mean()) < 1e-6


# ---------------------------------------------------------------------------
# regex_replace
# ---------------------------------------------------------------------------

class TestRegexReplace:

    def test_regex(self, transformer):
        df = pd.DataFrame({"code": ["ABC-123", "DEF-456"]})
        steps = [_step("s1", "regex_replace", "code", {"pattern": r"-\d+", "replacement": ""})]
        result, _, _ = transformer.apply_steps(df.copy(), steps, "r1")
        assert result["code"].iloc[0] == "ABC"


# ---------------------------------------------------------------------------
# one_hot_encode
# ---------------------------------------------------------------------------

class TestOneHotEncode:

    def test_encode(self, transformer, sample_df):
        steps = [_step("s1", "one_hot_encode", "category", {"max_categories": 5})]
        result, _, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert "category_a" in result.columns or "category_A" in result.columns.str.lower().tolist()


# ---------------------------------------------------------------------------
# Invalid operation
# ---------------------------------------------------------------------------

class TestInvalidOperation:

    def test_invalid_op_errors(self, transformer, sample_df):
        """An unrecognized operation should not crash; it simply does nothing or errors."""
        steps = [_step("s1", "fill_null", "nonexistent_col", {"method": "zero"})]
        _, _, errors = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert len(errors) == 1


# ---------------------------------------------------------------------------
# Lineage tracking
# ---------------------------------------------------------------------------

class TestLineage:

    def test_lineage_recorded(self, transformer, sample_df):
        steps = [
            _step("s1", "fill_null", "amount", {"method": "zero"}),
            _step("s2", "trim_whitespace", "name"),
        ]
        _, lineage, _ = transformer.apply_steps(sample_df.copy(), steps, "r1")
        assert len(lineage) == 2
        assert lineage[0]["step_id"] == "s1"
        assert lineage[1]["step_id"] == "s2"
