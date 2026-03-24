"""Tests for services.templates.TemplateEngine."""
import re
import pytest
import pandas as pd
import numpy as np

from services.templates import TemplateEngine, PATTERNS, _match


@pytest.fixture
def engine():
    return TemplateEngine()


# ---------------------------------------------------------------------------
# Pattern matching (bilingual column detection)
# ---------------------------------------------------------------------------

class TestPatternMatching:

    @pytest.mark.parametrize("col,concept", [
        ("Umsatz", "revenue"),
        ("revenue", "revenue"),
        ("sales", "revenue"),
        ("turnover", "revenue"),
        ("Kosten", "cost"),
        ("cost_total", "cost"),
        ("expense", "cost"),
        ("Kunde", "customer"),
        ("customer_id", "customer"),
        ("Produkt", "product"),
        ("product_name", "product"),
        ("Region", "region"),
        ("city", "region"),
    ])
    def test_bilingual_patterns(self, col, concept):
        assert _match(col, concept), f"Expected '{col}' to match concept '{concept}'"


# ---------------------------------------------------------------------------
# get_applicable with minimum columns
# ---------------------------------------------------------------------------

class TestGetApplicable:

    def test_returns_templates_for_dataset_with_3_plus_columns(self, engine, simple_numeric_profiles):
        matches = engine.get_applicable(simple_numeric_profiles)
        assert len(matches) > 0
        # T01 (Data Quality Scorecard) requires min_columns: 3
        template_ids = [m.template_id for m in matches]
        assert "T01" in template_ids

    def test_universal_templates_always_match(self, engine, titanic_profiles):
        matches = engine.get_applicable(titanic_profiles)
        template_ids = [m.template_id for m in matches]
        # T01 requires min_columns 3, T02 requires 2 measures, etc.
        assert "T01" in template_ids

    def test_german_headers_detect_business_templates(self, engine, german_sales_profiles):
        """German headers like Umsatz, Kosten, Kunde should trigger T09, T10, T13."""
        matches = engine.get_applicable(german_sales_profiles)
        template_ids = [m.template_id for m in matches]
        # T09 = Revenue Driver Analysis (needs revenue pattern + measure + dimension)
        assert "T09" in template_ids
        # T10 = Profitability Analysis (needs revenue + cost patterns + 2 measures)
        assert "T10" in template_ids
        # T13 = Customer Concentration Risk (needs customer + revenue patterns)
        assert "T13" in template_ids

    def test_english_headers_detect_same_templates(self, engine):
        """English equivalents should detect the same templates."""
        profiles = [
            {"name": "customer", "dtype": "categorical", "semantic_role": "dimension", "null_rate": 0, "unique_rate": 0.5, "unique_count": 10},
            {"name": "product", "dtype": "categorical", "semantic_role": "dimension", "null_rate": 0, "unique_rate": 0.5, "unique_count": 10},
            {"name": "revenue", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 1.0, "unique_count": 100},
            {"name": "cost", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 1.0, "unique_count": 100},
            {"name": "quantity", "dtype": "numeric", "semantic_role": "measure", "null_rate": 0, "unique_rate": 0.8, "unique_count": 50},
            {"name": "date", "dtype": "date", "semantic_role": "date", "null_rate": 0, "unique_rate": 1.0, "unique_count": 100},
            {"name": "region", "dtype": "categorical", "semantic_role": "dimension", "null_rate": 0, "unique_rate": 0.3, "unique_count": 5},
        ]
        matches = engine.get_applicable(profiles)
        template_ids = [m.template_id for m in matches]
        assert "T09" in template_ids
        assert "T10" in template_ids
        assert "T13" in template_ids


# ---------------------------------------------------------------------------
# Confidence scoring
# ---------------------------------------------------------------------------

class TestConfidenceScoring:

    def test_pattern_match_increases_confidence(self, engine, german_sales_profiles):
        matches = engine.get_applicable(german_sales_profiles)
        # Templates with both role AND name pattern match should have higher confidence
        # than universal templates with just role match
        t09 = next((m for m in matches if m.template_id == "T09"), None)
        t01 = next((m for m in matches if m.template_id == "T01"), None)
        assert t09 is not None
        assert t01 is not None
        # T09 has both role match (0.5) + pattern match component
        assert t09.confidence >= 0.5

    def test_confidence_above_threshold(self, engine, simple_numeric_profiles):
        matches = engine.get_applicable(simple_numeric_profiles)
        for m in matches:
            assert m.confidence >= 0.3  # minimum threshold


# ---------------------------------------------------------------------------
# Template findings contain numbers
# ---------------------------------------------------------------------------

class TestTemplateFindings:

    def test_t01_findings_contain_numbers(self, engine, titanic_df, titanic_profiles):
        result = engine.run("T01", titanic_df, titanic_profiles)
        assert result.success
        # Findings should contain specific numbers (digits)
        for finding in result.findings:
            text = finding["text"] if isinstance(finding, dict) else str(finding)
            assert re.search(r'\d', text), f"Finding should contain numbers: {text}"

    def test_t02_on_numeric_data(self, engine, simple_numeric_df, simple_numeric_profiles):
        result = engine.run("T02", simple_numeric_df, simple_numeric_profiles)
        assert result.success
        assert len(result.findings) > 0


# ---------------------------------------------------------------------------
# build_ai_context_from_templates
# ---------------------------------------------------------------------------

class TestBuildAIContext:

    def test_returns_verified_prefixed_text(self, engine, titanic_df, titanic_profiles):
        context = engine.build_ai_context_from_templates(titanic_df, titanic_profiles)
        if context:  # May be empty if no templates run successfully
            lines = [l for l in context.split("\n") if l.strip()]
            for line in lines:
                assert line.startswith("[VERIFIED]"), f"Each line should start with [VERIFIED]: {line}"

    def test_returns_empty_for_no_profiles(self, engine):
        df = pd.DataFrame({"x": [1]})
        context = engine.build_ai_context_from_templates(df, [])
        assert context == ""


# ---------------------------------------------------------------------------
# TemplateMatch structure
# ---------------------------------------------------------------------------

class TestTemplateMatchStructure:

    def test_match_has_required_fields(self, engine, german_sales_profiles):
        matches = engine.get_applicable(german_sales_profiles)
        for m in matches:
            assert m.template_id
            assert m.name
            assert m.category
            assert m.description
            assert isinstance(m.confidence, float)
            assert isinstance(m.matched_columns, dict)

    def test_matched_columns_populated(self, engine, german_sales_profiles):
        matches = engine.get_applicable(german_sales_profiles)
        # At least some matches should have matched columns
        any_with_cols = any(len(m.matched_columns) > 0 for m in matches)
        assert any_with_cols
