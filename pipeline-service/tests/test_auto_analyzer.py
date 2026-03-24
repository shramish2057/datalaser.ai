"""Tests for services.auto_analyzer.AutoAnalyzer."""
import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch

from services.auto_analyzer import AutoAnalyzer


@pytest.fixture
def analyzer():
    return AutoAnalyzer()


# ---------------------------------------------------------------------------
# Basic analysis on simple numeric data
# ---------------------------------------------------------------------------

class TestAnalyzeBasic:

    def test_runs_on_simple_data(self, analyzer, simple_numeric_df, simple_numeric_profiles):
        result = analyzer.analyze(simple_numeric_df, simple_numeric_profiles)
        assert isinstance(result, dict)
        assert result["row_count"] == len(simple_numeric_df)
        assert result["column_count"] == len(simple_numeric_df.columns)

    def test_returns_expected_keys(self, analyzer, simple_numeric_df, simple_numeric_profiles):
        result = analyzer.analyze(simple_numeric_df, simple_numeric_profiles)
        expected_keys = [
            "row_count", "column_count", "measures", "dimensions",
            "correlations", "distributions", "anomalies", "segments",
            "relationships", "trends", "top_insights",
        ]
        for key in expected_keys:
            assert key in result, f"Missing key: {key}"

    def test_measures_detected(self, analyzer, simple_numeric_df, simple_numeric_profiles):
        result = analyzer.analyze(simple_numeric_df, simple_numeric_profiles)
        assert "value_a" in result["measures"]
        assert "value_b" in result["measures"]
        assert "value_c" in result["measures"]


# ---------------------------------------------------------------------------
# Top insights
# ---------------------------------------------------------------------------

class TestTopInsights:

    def test_top_insights_returned(self, analyzer, titanic_df, titanic_profiles):
        result = analyzer.analyze(titanic_df, titanic_profiles)
        assert isinstance(result["top_insights"], list)

    def test_insights_have_structure(self, analyzer, titanic_df, titanic_profiles):
        result = analyzer.analyze(titanic_df, titanic_profiles)
        for insight in result["top_insights"]:
            assert "type" in insight
            assert "headline" in insight
            assert "columns" in insight


# ---------------------------------------------------------------------------
# No AI calls (zero external API hits)
# ---------------------------------------------------------------------------

class TestNoAICalls:

    def test_no_external_api_calls(self, analyzer, simple_numeric_df, simple_numeric_profiles):
        """AutoAnalyzer must work purely with computation, no HTTP/API calls."""
        import httpx

        original_get = httpx.Client.get if hasattr(httpx, "Client") else None
        original_post = httpx.Client.post if hasattr(httpx, "Client") else None
        call_count = {"value": 0}

        def mock_request(*args, **kwargs):
            call_count["value"] += 1
            raise RuntimeError("No API calls allowed in auto_analyzer")

        with patch.object(httpx.AsyncClient, "post", side_effect=mock_request), \
             patch.object(httpx.AsyncClient, "get", side_effect=mock_request):
            result = analyzer.analyze(simple_numeric_df, simple_numeric_profiles)

        assert call_count["value"] == 0
        assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# Correlation analysis
# ---------------------------------------------------------------------------

class TestCorrelations:

    def test_correlations_computed(self, analyzer, simple_numeric_df, simple_numeric_profiles):
        result = analyzer.analyze(simple_numeric_df, simple_numeric_profiles)
        corr = result["correlations"]
        assert "pairs" in corr
        # With 3 measures, there should be pairs
        assert len(corr["pairs"]) > 0

    def test_correlation_pair_structure(self, analyzer, simple_numeric_df, simple_numeric_profiles):
        result = analyzer.analyze(simple_numeric_df, simple_numeric_profiles)
        for pair in result["correlations"]["pairs"]:
            assert "col1" in pair
            assert "col2" in pair
            assert "r" in pair
            assert -1 <= pair["r"] <= 1


# ---------------------------------------------------------------------------
# Distribution analysis
# ---------------------------------------------------------------------------

class TestDistributions:

    def test_distributions_computed(self, analyzer, simple_numeric_df, simple_numeric_profiles):
        result = analyzer.analyze(simple_numeric_df, simple_numeric_profiles)
        dists = result["distributions"]
        assert isinstance(dists, list)

    def test_distribution_has_shape(self, analyzer, titanic_df, titanic_profiles):
        result = analyzer.analyze(titanic_df, titanic_profiles)
        for dist in result["distributions"]:
            assert "shape" in dist
            assert dist["shape"] in ("normal", "symmetric", "right-skewed", "left-skewed",
                                     "slightly-right-skewed", "slightly-left-skewed")


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------

class TestAnomalies:

    def test_anomalies_returned(self, analyzer, titanic_df, titanic_profiles):
        result = analyzer.analyze(titanic_df, titanic_profiles)
        anomalies = result["anomalies"]
        assert isinstance(anomalies, list)
        # Titanic Fare column has outliers
        if anomalies:
            assert "column" in anomalies[0]
            assert "outlier_count" in anomalies[0]
            assert "severity" in anomalies[0]


# ---------------------------------------------------------------------------
# Segment analysis
# ---------------------------------------------------------------------------

class TestSegments:

    def test_segments_on_titanic(self, analyzer, titanic_df, titanic_profiles):
        result = analyzer.analyze(titanic_df, titanic_profiles)
        segments = result["segments"]
        assert isinstance(segments, list)
        # Titanic has dimensions (Embarked, Pclass via profiles) and measures
        if segments:
            assert "dimension" in segments[0]
            assert "measure" in segments[0]
            assert "p_value" in segments[0]


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:

    def test_empty_measures(self, analyzer):
        df = pd.DataFrame({"cat1": ["a", "b", "c"], "cat2": ["x", "y", "z"]})
        profiles = [
            {"name": "cat1", "semantic_role": "dimension"},
            {"name": "cat2", "semantic_role": "dimension"},
        ]
        result = analyzer.analyze(df, profiles)
        assert result["correlations"]["pairs"] == []
        assert result["distributions"] == []

    def test_single_column(self, analyzer):
        df = pd.DataFrame({"val": [1, 2, 3, 4, 5]})
        profiles = [{"name": "val", "semantic_role": "measure"}]
        result = analyzer.analyze(df, profiles)
        assert result["row_count"] == 5
