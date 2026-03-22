import os
import json
import httpx
from models.schemas import DataProfile

CLAUDE_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-sonnet-4-20250514"

SUGGESTION_PROMPT = """You are a senior data engineer analysing a dataset profile.
Based on the column profiles below, suggest the most important data transformations
needed to make this data reliable for analysis.

Return ONLY a valid JSON array of transformation suggestions.
Each suggestion must have exactly these fields:
{
  "id": "unique string like t1, t2...",
  "priority": integer (1 = most important),
  "operation": one of: fill_null | drop_null_rows | cast_type | rename_column |
    drop_column | trim_whitespace | standardise_case | normalise_dates |
    deduplicate | filter_rows | normalise_numeric | clip_outliers |
    split_column | merge_columns | regex_replace | one_hot_encode,
  "column": "column name or null if applies to whole dataset",
  "params": object with operation-specific params,
  "reason": "clear explanation of why this transformation is needed",
  "impact": "description of how many rows/values affected",
  "confidence": float 0-1,
  "before_sample": ["example values before"],
  "after_sample": ["example values after transformation"]
}

Params format per operation:
- fill_null: {"method": "median|mean|mode|zero|forward|drop", "value": optional}
- cast_type: {"target_type": "int|float|string|date"}
- normalise_dates: {"target_format": "ISO8601"}
- clip_outliers: {"method": "iqr", "multiplier": 1.5}
- drop_column: {} (no params needed)
- trim_whitespace: {}
- deduplicate: {"keep": "first|last"}
- one_hot_encode: {"max_categories": 10}
- standardise_case: {"case": "lower|upper|title"}

Return 3-8 suggestions maximum, ordered by priority.
Only suggest transformations that are genuinely needed based on the data.
Do not suggest transformations for columns that look clean."""


async def generate_suggestions(profile: DataProfile) -> list:
    if not CLAUDE_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    column_summaries = []
    for col in profile.columns:
        summary = {
            "name": col.name,
            "dtype": col.dtype,
            "null_rate": col.null_rate,
            "unique_rate": col.unique_rate,
            "mixed_types": col.mixed_types,
            "format_issues": col.format_issues,
            "outlier_count": col.outlier_count,
            "sample_values": col.sample_values[:3],
            "top_values": col.top_values[:3],
        }
        if col.mean_value is not None:
            summary["mean"] = col.mean_value
            summary["std_dev"] = col.std_dev
        column_summaries.append(summary)

    user_message = f"""Dataset: {profile.file_name}
Total rows: {profile.total_rows}
Quality score: {profile.quality_score}/100
Quality level: {profile.quality_level}

Column profiles:
{json.dumps(column_summaries, indent=2)}

Warnings detected:
{json.dumps([w.model_dump() for w in profile.warnings], indent=2)}

Generate transformation suggestions for this dataset."""

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": CLAUDE_MODEL,
                "max_tokens": 2000,
                "system": SUGGESTION_PROMPT,
                "messages": [{"role": "user", "content": user_message}],
            },
        )
        response.raise_for_status()
        data = response.json()
        text = data["content"][0]["text"]

        # Parse JSON — handle markdown code blocks
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        suggestions = json.loads(text)
        return suggestions
