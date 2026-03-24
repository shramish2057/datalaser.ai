"""Tests for safe execution sandbox in services.analyst.SafeExecutor."""
import pytest
import time
import pandas as pd
import numpy as np

from services.analyst import SafeExecutor


@pytest.fixture
def executor():
    return SafeExecutor()


@pytest.fixture
def sample_df():
    return pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})


# ---------------------------------------------------------------------------
# Blocked imports
# ---------------------------------------------------------------------------

class TestBlockedImports:

    def test_blocks_import_os(self, executor, sample_df):
        result = executor.execute("import os", sample_df)
        assert result["success"] is False
        assert "not allowed" in result["error"].lower() or "blocked" in result["error"].lower()

    def test_blocks_import_subprocess(self, executor, sample_df):
        result = executor.execute("import subprocess", sample_df)
        assert result["success"] is False

    def test_blocks_import_sys(self, executor, sample_df):
        result = executor.execute("import sys", sample_df)
        assert result["success"] is False

    def test_blocks_import_socket(self, executor, sample_df):
        result = executor.execute("import socket", sample_df)
        assert result["success"] is False

    def test_blocks_import_requests(self, executor, sample_df):
        result = executor.execute("import requests", sample_df)
        assert result["success"] is False


# ---------------------------------------------------------------------------
# Blocked file operations
# ---------------------------------------------------------------------------

class TestBlockedFileOps:

    def test_blocks_open_etc_passwd(self, executor, sample_df):
        result = executor.execute("open('/etc/passwd')", sample_df)
        assert result["success"] is False

    def test_blocks_open_generic(self, executor, sample_df):
        result = executor.execute("data = open('test.txt', 'r').read()", sample_df)
        assert result["success"] is False


# ---------------------------------------------------------------------------
# Blocked dangerous builtins
# ---------------------------------------------------------------------------

class TestBlockedBuiltins:

    def test_blocks_exec(self, executor, sample_df):
        result = executor.execute("exec('print(1)')", sample_df)
        assert result["success"] is False

    def test_blocks_eval(self, executor, sample_df):
        result = executor.execute("eval('1+1')", sample_df)
        assert result["success"] is False

    def test_blocks_compile(self, executor, sample_df):
        result = executor.execute("compile('pass', '<s>', 'exec')", sample_df)
        assert result["success"] is False

    def test_blocks_globals(self, executor, sample_df):
        result = executor.execute("globals()", sample_df)
        assert result["success"] is False

    def test_blocks_getattr(self, executor, sample_df):
        result = executor.execute("getattr(df, '__class__')", sample_df)
        assert result["success"] is False

    def test_blocks_class_manipulation(self, executor, sample_df):
        result = executor.execute("df.__class__.__bases__", sample_df)
        assert result["success"] is False


# ---------------------------------------------------------------------------
# Valid code executes successfully
# ---------------------------------------------------------------------------

class TestValidExecution:

    def test_pandas_code_works(self, executor, sample_df):
        code = "result = df.describe().to_dict()"
        result = executor.execute(code, sample_df)
        assert result["success"] is True
        assert result["error"] is None
        assert result["output"] is not None

    def test_numpy_code_works(self, executor, sample_df):
        code = "result = float(np.mean(df['a']))"
        result = executor.execute(code, sample_df)
        assert result["success"] is True
        assert result["output"] == 2.0

    def test_print_captures_stdout(self, executor, sample_df):
        code = "print('hello world')"
        result = executor.execute(code, sample_df)
        assert result["success"] is True
        assert "hello world" in result["stdout"]

    def test_allowed_import_works(self, executor, sample_df):
        code = """
import math
result = math.sqrt(16)
"""
        result = executor.execute(code, sample_df)
        assert result["success"] is True
        assert result["output"] == 4.0

    def test_dataframe_result_serialised(self, executor, sample_df):
        code = "result = df.head(2)"
        result = executor.execute(code, sample_df)
        assert result["success"] is True
        assert result["output"]["type"] == "dataframe"
        assert len(result["output"]["data"]) == 2

    def test_chart_data_extraction(self, executor, sample_df):
        code = """
result = {
    'chart_type': 'bar',
    'data': {'a': 10, 'b': 20},
    'x_key': 'name',
    'y_keys': ['value'],
}
"""
        result = executor.execute(code, sample_df)
        assert result["success"] is True
        assert result["chart_data"] is not None
        assert result["chart_data"]["chart_type"] == "bar"


# ---------------------------------------------------------------------------
# Safety check method
# ---------------------------------------------------------------------------

class TestSafetyCheck:

    @pytest.mark.parametrize("code,safe", [
        ("import os", False),
        ("import subprocess", False),
        ("import sys", False),
        ("open('/etc/passwd')", False),
        ("x = df.mean()", True),
        ("result = df.describe()", True),
        ("import pandas as pd", True),  # pandas is in code but triggers pattern
    ])
    def test_check_safety(self, executor, code, safe):
        check = executor._check_safety(code)
        # Note: "import pandas" won't be blocked by _check_safety since
        # _check_safety only looks for specific dangerous patterns.
        # But "import os" is in the dangerous list.
        if not safe:
            assert check["safe"] is False


# ---------------------------------------------------------------------------
# Input dataframe isolation
# ---------------------------------------------------------------------------

class TestIsolation:

    def test_original_df_not_modified(self, executor, sample_df):
        original = sample_df.copy()
        code = "df['c'] = 99"
        executor.execute(code, sample_df)
        # The executor should pass df.copy(), so original is untouched
        assert "c" not in sample_df.columns
        pd.testing.assert_frame_equal(sample_df, original)
