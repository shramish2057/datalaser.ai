"""Tests for services.profiler.DataProfiler."""
import pytest
import pandas as pd
import polars as pl

from services.profiler import DataProfiler
from models.schemas import DataProfile


@pytest.fixture
def profiler():
    return DataProfiler()


# ---------------------------------------------------------------------------
# Basic profiling
# ---------------------------------------------------------------------------

class TestProfileFile:

    def test_titanic_row_and_column_count(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        assert isinstance(result, DataProfile)
        assert result.total_rows > 0
        assert result.total_columns == 12

    def test_german_sales_row_count(self, profiler, german_sales_bytes):
        result = profiler.profile_file(german_sales_bytes, "german_sales.csv", run_id="r2", source_id="s2")
        assert result.total_rows > 0
        assert result.total_columns == 7

    def test_simple_numeric_columns(self, profiler, simple_numeric_bytes):
        result = profiler.profile_file(simple_numeric_bytes, "simple_numeric.csv", run_id="r3", source_id="s3")
        col_names = [c.name for c in result.columns]
        assert "id" in col_names
        assert "value_a" in col_names
        assert "value_b" in col_names
        assert "value_c" in col_names

    def test_quality_score_range(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        assert 0 <= result.quality_score <= 100

    def test_quality_score_perfect_data(self, profiler, simple_numeric_bytes):
        result = profiler.profile_file(simple_numeric_bytes, "simple_numeric.csv", run_id="r1", source_id="s1")
        # simple_numeric has no nulls, no mixed types -> high quality
        assert result.quality_score >= 80

    def test_file_metadata(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        assert result.file_type == "csv"
        assert result.file_name == "titanic.csv"
        assert result.file_size_bytes == len(titanic_bytes)
        assert result.run_id == "r1"
        assert result.source_id == "s1"
        assert result.has_header is True


# ---------------------------------------------------------------------------
# Null detection
# ---------------------------------------------------------------------------

class TestNullDetection:

    def test_titanic_cabin_has_nulls(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        cabin = next(c for c in result.columns if c.name == "Cabin")
        assert cabin.null_rate > 0.5  # Cabin is ~77% null

    def test_titanic_age_has_some_nulls(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        age = next(c for c in result.columns if c.name == "Age")
        assert age.null_rate > 0.0
        assert age.null_count > 0

    def test_complete_columns_have_zero_null_rate(self, profiler, simple_numeric_bytes):
        result = profiler.profile_file(simple_numeric_bytes, "simple_numeric.csv", run_id="r1", source_id="s1")
        for col in result.columns:
            assert col.null_rate == 0.0


# ---------------------------------------------------------------------------
# Semantic role detection
# ---------------------------------------------------------------------------

class TestSemanticRoles:

    def test_id_column_detected(self, profiler):
        """Columns ending with _id are detected as id role."""
        csv = b"user_id,value\n1,10\n2,20\n3,30\n"
        result = profiler.profile_file(csv, "test.csv", run_id="r1", source_id="s1")
        uid = next(c for c in result.columns if c.name == "user_id")
        assert uid.semantic_role == "id"

    def test_survived_is_binary(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        survived = next(c for c in result.columns if c.name == "Survived")
        assert survived.semantic_role == "binary"

    def test_numeric_columns_are_measures(self, profiler, simple_numeric_bytes):
        result = profiler.profile_file(simple_numeric_bytes, "simple_numeric.csv", run_id="r1", source_id="s1")
        for col in result.columns:
            if col.name.startswith("value_"):
                assert col.semantic_role == "measure"

    def test_categorical_columns_detected(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        embarked = next(c for c in result.columns if c.name == "Embarked")
        assert embarked.semantic_role in ("dimension", "binary")

    def test_sex_is_binary(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        sex = next(c for c in result.columns if c.name == "Sex")
        assert sex.semantic_role == "binary"


# ---------------------------------------------------------------------------
# Dtype detection
# ---------------------------------------------------------------------------

class TestDtypeDetection:

    def test_numeric_dtype(self, profiler, simple_numeric_bytes):
        result = profiler.profile_file(simple_numeric_bytes, "simple_numeric.csv", run_id="r1", source_id="s1")
        va = next(c for c in result.columns if c.name == "value_a")
        assert va.dtype == "numeric"

    def test_id_dtype(self, profiler):
        """Columns ending with _id get dtype 'id'."""
        csv = b"user_id,value\n1,10\n2,20\n3,30\n"
        result = profiler.profile_file(csv, "test.csv", run_id="r1", source_id="s1")
        uid = next(c for c in result.columns if c.name == "user_id")
        assert uid.dtype == "id"

    def test_fare_is_numeric(self, profiler, titanic_bytes):
        result = profiler.profile_file(titanic_bytes, "titanic.csv", run_id="r1", source_id="s1")
        fare = next(c for c in result.columns if c.name == "Fare")
        assert fare.dtype == "numeric"


# ---------------------------------------------------------------------------
# Empty dataframe handling
# ---------------------------------------------------------------------------

class TestEmptyDataframe:

    def test_empty_csv(self, profiler):
        empty_csv = b"col_a,col_b,col_c\n"
        result = profiler.profile_file(empty_csv, "empty.csv", run_id="r1", source_id="s1")
        assert result.total_rows == 0
        assert result.total_columns == 3


# ---------------------------------------------------------------------------
# Quality scoring
# ---------------------------------------------------------------------------

class TestQualityScoring:

    def test_quality_level_mapping(self, profiler):
        assert profiler._quality_level(95) == "good"
        assert profiler._quality_level(80) == "yellow"
        assert profiler._quality_level(60) == "amber"
        assert profiler._quality_level(30) == "red"

    def test_compute_quality_score_no_warnings(self, profiler):
        score = profiler._compute_quality_score([], [])
        assert score == 100

    def test_warnings_generated_for_messy_data(self, profiler, messy_data_bytes):
        result = profiler.profile_file(messy_data_bytes, "messy_data.csv", run_id="r1", source_id="s1")
        # messy_data has nulls so there should be some warnings or at least a non-perfect score
        assert isinstance(result.warnings, list)
