"""Tests for services.file_handler.

Note: file_handler.py is currently a stub (comment-only file).
These tests cover the file-loading logic that lives in profiler._load_file
and transformer.load_dataframe, which are the actual file-handling code paths.
"""
import pytest
import io
import pandas as pd

from services.profiler import DataProfiler
from services.transformer import DataTransformer


@pytest.fixture
def profiler():
    return DataProfiler()


@pytest.fixture
def transformer():
    return DataTransformer()


# ---------------------------------------------------------------------------
# CSV file detection and loading
# ---------------------------------------------------------------------------

class TestCSVHandling:

    def test_load_csv_bytes(self, transformer):
        csv_content = b"a,b,c\n1,2,3\n4,5,6\n"
        df = transformer.load_dataframe(csv_content, "csv")
        assert len(df) == 2
        assert list(df.columns) == ["a", "b", "c"]

    def test_profile_csv_file(self, profiler):
        csv_content = b"x,y\n10,20\n30,40\n"
        result = profiler.profile_file(csv_content, "test.csv", "r1", "s1")
        assert result.total_rows == 2
        assert result.total_columns == 2
        assert result.file_type == "csv"


# ---------------------------------------------------------------------------
# Encoding handling
# ---------------------------------------------------------------------------

class TestEncodingHandling:

    def test_utf8_csv(self, profiler):
        csv_content = "name,city\nMüller,München\nSchäfer,Zürich\n".encode("utf-8")
        result = profiler.profile_file(csv_content, "test.csv", "r1", "s1")
        assert result.total_rows == 2

    def test_latin1_csv(self, profiler):
        csv_content = "name,city\nMüller,München\nSchäfer,Zürich\n".encode("latin-1")
        result = profiler.profile_file(csv_content, "test.csv", "r1", "s1")
        assert result.total_rows == 2

    def test_detected_encoding_set(self, profiler):
        csv_content = b"a,b\n1,2\n"
        result = profiler.profile_file(csv_content, "test.csv", "r1", "s1")
        assert result.detected_encoding is not None
        assert isinstance(result.detected_encoding, str)


# ---------------------------------------------------------------------------
# JSON file handling
# ---------------------------------------------------------------------------

class TestJSONHandling:

    def test_load_json_bytes(self, transformer):
        import json
        data = [{"a": 1, "b": 2}, {"a": 3, "b": 4}]
        json_bytes = json.dumps(data).encode("utf-8")
        df = transformer.load_dataframe(json_bytes, "json")
        assert len(df) == 2
        assert "a" in df.columns


# ---------------------------------------------------------------------------
# Parquet file handling
# ---------------------------------------------------------------------------

class TestParquetHandling:

    def test_load_parquet_bytes(self, transformer):
        df_original = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})
        buf = io.BytesIO()
        df_original.to_parquet(buf, index=False)
        parquet_bytes = buf.getvalue()

        df = transformer.load_dataframe(parquet_bytes, "parquet")
        assert len(df) == 3
        assert list(df.columns) == ["x", "y"]


# ---------------------------------------------------------------------------
# Unsupported file type
# ---------------------------------------------------------------------------

class TestUnsupportedType:

    def test_raises_for_unknown_type(self, transformer):
        with pytest.raises(ValueError, match="Unsupported file type"):
            transformer.load_dataframe(b"data", "xml")


# ---------------------------------------------------------------------------
# NA value handling
# ---------------------------------------------------------------------------

class TestNAValues:

    def test_na_strings_treated_as_null(self, transformer):
        csv_content = b"a,b\n1,NA\n2,null\n3,N/A\n4,real\n"
        df = transformer.load_dataframe(csv_content, "csv")
        # NA, null, N/A should be treated as NaN
        assert df["b"].isna().sum() == 3

    def test_profiler_detects_na_strings(self, profiler):
        csv_content = b"col\nvalue\nNA\nnull\nNone\nreal\n"
        result = profiler.profile_file(csv_content, "test.csv", "r1", "s1")
        col = result.columns[0]
        # Should detect at least some nulls
        assert col.null_count > 0 or col.null_rate > 0


# ---------------------------------------------------------------------------
# Excel file handling (xlsx)
# ---------------------------------------------------------------------------

class TestExcelHandling:

    def test_load_xlsx_bytes(self, transformer):
        df_original = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
        buf = io.BytesIO()
        df_original.to_excel(buf, index=False, engine="openpyxl")
        xlsx_bytes = buf.getvalue()

        df = transformer.load_dataframe(xlsx_bytes, "xlsx")
        assert len(df) == 2
        assert "a" in df.columns
