"""Tests for services.suggester.generate_suggestions."""
import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock

from services.suggester import generate_suggestions
from models.schemas import (
    DataProfile, ColumnProfile, QualityWarning,
)


def _make_profile(**overrides):
    """Build a minimal DataProfile for testing."""
    defaults = {
        "run_id": "r1",
        "source_id": "s1",
        "file_name": "test.csv",
        "file_type": "csv",
        "total_rows": 100,
        "total_columns": 3,
        "file_size_bytes": 5000,
        "columns": [
            ColumnProfile(
                name="amount", dtype="numeric", semantic_role="measure",
                null_rate=0.15, unique_rate=0.9, total_values=85,
                null_count=15, unique_count=80,
            ),
            ColumnProfile(
                name="category", dtype="categorical", semantic_role="dimension",
                null_rate=0.0, unique_rate=0.05, total_values=100,
                null_count=0, unique_count=5,
            ),
            ColumnProfile(
                name="date", dtype="date", semantic_role="date",
                null_rate=0.0, unique_rate=0.8, total_values=100,
                null_count=0, unique_count=80,
                format_issues=True,
            ),
        ],
        "quality_score": 75,
        "quality_level": "yellow",
        "warnings": [
            QualityWarning(column="amount", issue="missing_values",
                           severity="amber", detail="15% missing"),
        ],
        "detected_encoding": "utf-8",
        "has_header": True,
    }
    defaults.update(overrides)
    return DataProfile(**defaults)


# ---------------------------------------------------------------------------
# API key validation
# ---------------------------------------------------------------------------

class TestAPIKeyValidation:

    @pytest.mark.asyncio
    async def test_raises_without_api_key(self):
        profile = _make_profile()
        with patch("services.suggester.CLAUDE_API_KEY", None):
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
                await generate_suggestions(profile)


# ---------------------------------------------------------------------------
# Suggestion generation (mocked API)
# ---------------------------------------------------------------------------

class TestSuggestionGeneration:

    @pytest.mark.asyncio
    async def test_returns_list_of_suggestions(self):
        """Mock the Anthropic API and verify parsing."""
        mock_response_data = [
            {
                "id": "t1",
                "priority": 1,
                "operation": "fill_null",
                "column": "amount",
                "params": {"method": "median"},
                "reason": "15% missing values",
                "impact": "15 rows affected",
                "confidence": 0.9,
                "before_sample": ["None", "None"],
                "after_sample": ["42.5", "42.5"],
            }
        ]

        mock_api_response = MagicMock()
        mock_api_response.status_code = 200
        mock_api_response.raise_for_status = MagicMock()
        mock_api_response.json.return_value = {
            "content": [{"text": json.dumps(mock_response_data)}]
        }

        with patch("services.suggester.CLAUDE_API_KEY", "test-key"), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_api_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            profile = _make_profile()
            result = await generate_suggestions(profile)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["operation"] == "fill_null"
        assert result[0]["column"] == "amount"

    @pytest.mark.asyncio
    async def test_handles_markdown_code_blocks(self):
        """API may return JSON wrapped in markdown code blocks."""
        raw_text = '```json\n[{"id": "t1", "operation": "trim_whitespace", "column": "name", "priority": 1, "params": {}, "reason": "spaces", "impact": "all rows", "confidence": 0.8, "before_sample": [" a "], "after_sample": ["a"]}]\n```'

        mock_api_response = MagicMock()
        mock_api_response.raise_for_status = MagicMock()
        mock_api_response.json.return_value = {"content": [{"text": raw_text}]}

        with patch("services.suggester.CLAUDE_API_KEY", "test-key"), \
             patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_api_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            profile = _make_profile()
            result = await generate_suggestions(profile)

        assert isinstance(result, list)
        assert result[0]["operation"] == "trim_whitespace"


# ---------------------------------------------------------------------------
# Profile serialization for prompt
# ---------------------------------------------------------------------------

class TestProfileSerialization:

    def test_profile_builds_correctly(self):
        """Ensure the profile can be created and serialized."""
        profile = _make_profile()
        assert profile.total_rows == 100
        assert len(profile.columns) == 3
        assert len(profile.warnings) == 1
        # Ensure columns can be iterated (used in generate_suggestions)
        for col in profile.columns:
            assert col.name
            assert col.dtype
