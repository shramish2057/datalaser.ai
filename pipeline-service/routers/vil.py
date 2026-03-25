"""
DataLaser VIL Router -- REST endpoints for the Verified Intelligence Layer.
Builds, updates, and serves the semantic knowledge graph.
"""
from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import json
import os
import logging
from datetime import datetime, timezone

import httpx

from services.vil import vil_engine, apply_corrections
from routers.analyst import sanitize

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory graph cache keyed by project_id.
# Production deployments should persist to Supabase / Redis.
_graph_cache: dict[str, dict] = {}
_corrections_cache: dict[str, list[dict]] = {}


@router.post("/build")
async def build_graph(
    source_type: str = Form(...),
    connection_string: str = Form(...),
    source_id: str = Form(...),
    project_id: str = Form(...),
    schema_tables: str = Form(...),
    corrections: str = Form("[]"),
):
    """Build the complete VIL graph for a data source.

    Parameters
    ----------
    source_type : str
        Database type (e.g., "postgresql", "mysql").
    connection_string : str
        SQLAlchemy-compatible connection string.
    source_id : str
        UUID of the data source.
    project_id : str
        UUID of the project.
    schema_tables : str
        JSON string: list of ``{table_name, columns: [{name, ...}]}``.
    corrections : str
        JSON string: list of user corrections to apply.

    Returns
    -------
    JSONResponse
        The full graph payload: ``{nodes, edges, industry, kpis, metadata}``.
    """
    try:
        tables = json.loads(schema_tables)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid schema_tables JSON: {exc}",
        )

    try:
        correction_list = json.loads(corrections)
    except json.JSONDecodeError:
        correction_list = []

    # Merge with previously stored corrections for this project
    stored = _corrections_cache.get(project_id, [])
    all_corrections = stored + correction_list

    try:
        graph = vil_engine.build(
            connection_string=connection_string,
            schema_tables=tables,
            source_id=source_id,
            project_id=project_id,
            corrections=all_corrections if all_corrections else None,
        )
    except Exception as exc:
        logger.exception("VIL build failed for project %s", project_id)
        raise HTTPException(
            status_code=500,
            detail=f"VIL build failed: {str(exc)}",
        )

    # Cache the graph and corrections
    _graph_cache[project_id] = graph
    if correction_list:
        _corrections_cache.setdefault(project_id, []).extend(correction_list)

    return JSONResponse(content=sanitize(graph))


@router.post("/update")
async def update_graph(
    project_id: str = Form(...),
    correction: str = Form(...),
):
    """Apply a single user correction and return the updated graph.

    Parameters
    ----------
    project_id : str
        UUID of the project whose graph should be updated.
    correction : str
        JSON string representing one correction object with keys:
        ``action``, ``target_type``, ``target_id``, and action-specific fields.

    Returns
    -------
    JSONResponse
        The updated graph payload.
    """
    try:
        correction_obj = json.loads(correction)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid correction JSON: {exc}",
        )

    if project_id not in _graph_cache:
        raise HTTPException(
            status_code=404,
            detail=f"No graph found for project {project_id}. Build one first via /vil/build.",
        )

    # Store correction
    _corrections_cache.setdefault(project_id, []).append(correction_obj)

    # Apply to cached graph
    graph = _graph_cache[project_id]
    graph = apply_corrections(graph, [correction_obj])

    # Update metadata
    graph.setdefault("metadata", {})["updated_at"] = datetime.now(timezone.utc).isoformat()
    graph["metadata"]["node_count"] = len(graph.get("nodes", []))
    graph["metadata"]["edge_count"] = len(graph.get("edges", []))

    _graph_cache[project_id] = graph

    return JSONResponse(content=sanitize(graph))


@router.post("/graph")
async def get_graph(
    project_id: str = Form(...),
):
    """Return the current graph JSON for rendering.

    Parameters
    ----------
    project_id : str
        UUID of the project.

    Returns
    -------
    JSONResponse
        The cached graph payload, or 404 if not yet built.
    """
    if project_id not in _graph_cache:
        raise HTTPException(
            status_code=404,
            detail=f"No graph found for project {project_id}. Build one first via /vil/build.",
        )

    return JSONResponse(content=sanitize(_graph_cache[project_id]))


@router.post("/insight")
async def get_node_insight(
    source_type: str = Form(...),
    connection_string: str = Form(...),
    table_name: str = Form(...),
    column_name: str = Form(""),
    node_type: str = Form("metric"),
    node_label: str = Form(""),
    node_value: str = Form(""),
    business_role: str = Form(""),
    locale: str = Form("en"),
):
    """Generate a verified business insight for a specific graph node.
    Runs SQL aggregates on live DB, then Claude interprets the numbers."""
    import sqlalchemy
    engine = sqlalchemy.create_engine(connection_string, connect_args={"connect_timeout": 10})

    # Build targeted SQL queries based on node type
    aggregates = {}

    if node_type == "metric" and column_name:
        with engine.connect() as conn:
            # Basic stats
            stats = conn.execute(sqlalchemy.text(f'''
                SELECT COUNT(*) as total, SUM("{column_name}")::float as total_sum,
                       AVG("{column_name}")::float as avg_val,
                       MIN("{column_name}")::float as min_val,
                       MAX("{column_name}")::float as max_val
                FROM "{table_name}" WHERE "{column_name}" IS NOT NULL
            ''')).fetchone()
            aggregates['total'] = stats[0]
            aggregates['sum'] = round(stats[1] or 0, 2)
            aggregates['avg'] = round(stats[2] or 0, 2)
            aggregates['min'] = stats[3]
            aggregates['max'] = stats[4]

            # Top contributors (if there's a dimension column)
            dim_cols = conn.execute(sqlalchemy.text(f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = :t AND data_type IN ('text','character varying')
            """), {"t": table_name}).fetchall()

            if dim_cols:
                dim_col = dim_cols[0][0]
                top = conn.execute(sqlalchemy.text(f'''
                    SELECT "{dim_col}"::text, SUM("{column_name}")::float as val
                    FROM "{table_name}" WHERE "{column_name}" IS NOT NULL
                    GROUP BY "{dim_col}" ORDER BY val DESC LIMIT 5
                ''')).fetchall()
                aggregates['top_by_dimension'] = {
                    'dimension': dim_col,
                    'values': [{'label': str(r[0]), 'value': round(r[1], 2)} for r in top]
                }

    elif node_type == "table":
        with engine.connect() as conn:
            row_count = conn.execute(sqlalchemy.text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar()
            col_count = conn.execute(sqlalchemy.text(f"""
                SELECT COUNT(*) FROM information_schema.columns WHERE table_name = :t
            """), {"t": table_name}).scalar()
            aggregates['row_count'] = row_count
            aggregates['column_count'] = col_count

    elif node_type == "dimension" and column_name:
        with engine.connect() as conn:
            top_vals = conn.execute(sqlalchemy.text(f'''
                SELECT "{column_name}"::text, COUNT(*) as cnt
                FROM "{table_name}" WHERE "{column_name}" IS NOT NULL
                GROUP BY "{column_name}" ORDER BY cnt DESC LIMIT 10
            ''')).fetchall()
            total = conn.execute(sqlalchemy.text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar()
            aggregates['top_values'] = [{'label': str(r[0]), 'count': int(r[1]), 'pct': round(int(r[1])/total*100, 1)} for r in top_vals]
            aggregates['total'] = total

    # Send aggregates to Claude for interpretation (no raw data)
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return JSONResponse(content={"finding": "API key not configured", "recommendation": "", "data_points": []})

    lang_instruction = "Antworte auf Deutsch." if locale == "de" else "Answer in English."

    prompt = f"""{lang_instruction}
You are a senior business analyst reviewing a {node_type} called "{node_label}" (value: {node_value}).
Business role: {business_role}

Aggregated data (computed from live database, not raw rows):
{json.dumps(aggregates, indent=2, default=str)}

Write a JSON response:
1. "finding": 2-3 sentences of specific verified insight with actual numbers. Start with the most important finding.
2. "recommendation": 1-2 sentences of actionable advice for a German Mittelstand CFO.
3. "data_points": array of 2-4 key metrics, each with "label", "value" (formatted string), "severity" (one of: "success", "warning", "critical", "info")

Return ONLY valid JSON."""

    try:
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": 1500, "messages": [{"role": "user", "content": prompt}]},
            timeout=30.0,
        )
        text = resp.json()["content"][0]["text"].strip()
        if text.startswith("```"): text = text.split("```")[1].lstrip("json\n")
        result = json.loads(text)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={
            "finding": f"Insight generation failed: {str(e)}",
            "recommendation": "",
            "data_points": []
        }, status_code=500)
