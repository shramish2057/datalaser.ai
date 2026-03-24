"""Shared fixtures for pipeline-service tests."""
import os
import sys
import pytest
import pandas as pd
import numpy as np

# Ensure pipeline-service root is on sys.path so `services.*` / `models.*` resolve.
_pipeline_root = os.path.join(os.path.dirname(__file__), os.pardir)
sys.path.insert(0, os.path.abspath(_pipeline_root))

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, "tests", "fixtures")


@pytest.fixture
def titanic_csv_path():
    return os.path.join(FIXTURES_DIR, "titanic.csv")


@pytest.fixture
def german_sales_csv_path():
    return os.path.join(FIXTURES_DIR, "german_sales.csv")


@pytest.fixture
def simple_numeric_csv_path():
    return os.path.join(FIXTURES_DIR, "simple_numeric.csv")


@pytest.fixture
def messy_data_csv_path():
    return os.path.join(FIXTURES_DIR, "messy_data.csv")


# ---------------------------------------------------------------------------
# DataFrames loaded once
# ---------------------------------------------------------------------------

@pytest.fixture
def titanic_df(titanic_csv_path):
    return pd.read_csv(titanic_csv_path)


@pytest.fixture
def german_sales_df(german_sales_csv_path):
    return pd.read_csv(german_sales_csv_path)


@pytest.fixture
def simple_numeric_df(simple_numeric_csv_path):
    return pd.read_csv(simple_numeric_csv_path)


@pytest.fixture
def messy_data_df(messy_data_csv_path):
    return pd.read_csv(messy_data_csv_path)


# ---------------------------------------------------------------------------
# Raw bytes (for profiler which expects file bytes)
# ---------------------------------------------------------------------------

@pytest.fixture
def titanic_bytes(titanic_csv_path):
    with open(titanic_csv_path, "rb") as f:
        return f.read()


@pytest.fixture
def german_sales_bytes(german_sales_csv_path):
    with open(german_sales_csv_path, "rb") as f:
        return f.read()


@pytest.fixture
def simple_numeric_bytes(simple_numeric_csv_path):
    with open(simple_numeric_csv_path, "rb") as f:
        return f.read()


@pytest.fixture
def messy_data_bytes(messy_data_csv_path):
    with open(messy_data_csv_path, "rb") as f:
        return f.read()


# ---------------------------------------------------------------------------
# Column profiles (lightweight dict form used by templates / auto_analyzer)
# ---------------------------------------------------------------------------

@pytest.fixture
def simple_numeric_profiles():
    """Manually constructed profiles matching simple_numeric.csv columns."""
    return [
        {"name": "id", "dtype": "id", "semantic_role": "id", "null_rate": 0, "unique_rate": 1.0, "unique_count": 10, "mixed_types": False, "outlier_count": 0},
        {"name": "value_a", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 1.0, "unique_count": 10, "mixed_types": False, "outlier_count": 0},
        {"name": "value_b", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 1.0, "unique_count": 10, "mixed_types": False, "outlier_count": 0},
        {"name": "value_c", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 1.0, "unique_count": 10, "mixed_types": False, "outlier_count": 0},
    ]


@pytest.fixture
def german_sales_profiles():
    """Profiles matching german_sales.csv columns."""
    return [
        {"name": "Kunde", "dtype": "categorical", "semantic_role": "dimension", "null_rate": 0, "unique_rate": 0.5, "unique_count": 3, "mixed_types": False, "outlier_count": 0},
        {"name": "Produkt", "dtype": "categorical", "semantic_role": "dimension", "null_rate": 0, "unique_rate": 0.5, "unique_count": 3, "mixed_types": False, "outlier_count": 0},
        {"name": "Umsatz", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 1.0, "unique_count": 5, "mixed_types": False, "outlier_count": 0},
        {"name": "Kosten", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 1.0, "unique_count": 5, "mixed_types": False, "outlier_count": 0},
        {"name": "Menge", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 0.8, "unique_count": 5, "mixed_types": False, "outlier_count": 0},
        {"name": "Datum", "dtype": "date", "semantic_role": "date", "null_rate": 0, "unique_rate": 1.0, "unique_count": 5, "mixed_types": False, "outlier_count": 0},
        {"name": "Region", "dtype": "categorical", "semantic_role": "dimension", "null_rate": 0, "unique_rate": 0.6, "unique_count": 3, "mixed_types": False, "outlier_count": 0},
    ]


@pytest.fixture
def titanic_profiles():
    """Profiles matching titanic.csv columns (simplified)."""
    return [
        {"name": "PassengerId", "dtype": "id", "semantic_role": "id", "null_rate": 0, "unique_rate": 1.0, "unique_count": 891, "mixed_types": False, "outlier_count": 0},
        {"name": "Survived", "dtype": "numeric", "semantic_role": "binary", "null_rate": 0, "unique_rate": 0.002, "unique_count": 2, "mixed_types": False, "outlier_count": 0},
        {"name": "Pclass", "dtype": "numeric", "semantic_role": "dimension", "null_rate": 0, "unique_rate": 0.003, "unique_count": 3, "mixed_types": False, "outlier_count": 0},
        {"name": "Name", "dtype": "text", "semantic_role": "text", "null_rate": 0, "unique_rate": 1.0, "unique_count": 891, "mixed_types": False, "outlier_count": 0},
        {"name": "Sex", "dtype": "categorical", "semantic_role": "binary", "null_rate": 0, "unique_rate": 0.002, "unique_count": 2, "mixed_types": False, "outlier_count": 0},
        {"name": "Age", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0.2, "unique_rate": 0.12, "unique_count": 88, "mixed_types": False, "outlier_count": 1},
        {"name": "SibSp", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 0.008, "unique_count": 7, "mixed_types": False, "outlier_count": 5},
        {"name": "Parch", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 0.008, "unique_count": 7, "mixed_types": False, "outlier_count": 5},
        {"name": "Ticket", "dtype": "categorical", "semantic_role": "text", "null_rate": 0, "unique_rate": 0.77, "unique_count": 681, "mixed_types": False, "outlier_count": 0},
        {"name": "Fare", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 0.28, "unique_count": 248, "mixed_types": False, "outlier_count": 20},
        {"name": "Cabin", "dtype": "categorical", "semantic_role": "text", "null_rate": 0.77, "unique_rate": 0.23, "unique_count": 147, "mixed_types": False, "outlier_count": 0},
        {"name": "Embarked", "dtype": "categorical", "semantic_role": "dimension", "null_rate": 0.002, "unique_rate": 0.003, "unique_count": 3, "mixed_types": False, "outlier_count": 0},
    ]
