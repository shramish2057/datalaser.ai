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
import pandas as pd
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
    correction: str = Form(...),
):
    """Validate a correction object. The frontend handles persistence to
    Supabase (vil_corrections table) and triggers a full graph rebuild
    via /vil/build which loads all corrections from the DB.

    This endpoint does NOT use in-memory cache. Corrections survive
    pipeline restarts because they live in the database.
    """
    try:
        correction_obj = json.loads(correction)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid correction JSON: {exc}")

    # Validate required fields
    if "action" not in correction_obj:
        raise HTTPException(status_code=400, detail="Correction must have an 'action' field")

    return JSONResponse(content={"success": True, "correction": correction_obj})


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
                       MAX("{column_name}")::float as max_val,
                       STDDEV("{column_name}")::float as std_val
                FROM "{table_name}" WHERE "{column_name}" IS NOT NULL
            ''')).fetchone()
            aggregates['total_rows'] = stats[0]
            aggregates['sum'] = round(stats[1] or 0, 2)
            aggregates['avg'] = round(stats[2] or 0, 2)
            aggregates['min'] = round(float(stats[3] or 0), 2)
            aggregates['max'] = round(float(stats[4] or 0), 2)
            aggregates['std'] = round(float(stats[5] or 0), 2)

            # Period comparison (first half vs second half for trend context)
            try:
                half_count = stats[0] // 2
                halves = conn.execute(sqlalchemy.text(f'''
                    WITH numbered AS (
                        SELECT "{column_name}", ROW_NUMBER() OVER () as rn
                        FROM "{table_name}" WHERE "{column_name}" IS NOT NULL
                    )
                    SELECT
                        AVG(CASE WHEN rn <= {half_count} THEN "{column_name}" END)::float as first_half_avg,
                        AVG(CASE WHEN rn > {half_count} THEN "{column_name}" END)::float as second_half_avg,
                        SUM(CASE WHEN rn <= {half_count} THEN "{column_name}" END)::float as first_half_sum,
                        SUM(CASE WHEN rn > {half_count} THEN "{column_name}" END)::float as second_half_sum
                    FROM numbered
                ''')).fetchone()
                if halves and halves[0] and halves[1]:
                    pct_change = round((halves[1] - halves[0]) / abs(halves[0]) * 100, 1) if halves[0] != 0 else 0
                    aggregates['trend'] = {
                        'first_half_avg': round(halves[0], 2),
                        'second_half_avg': round(halves[1], 2),
                        'first_half_sum': round(halves[2], 2),
                        'second_half_sum': round(halves[3], 2),
                        'pct_change': pct_change,
                        'direction': 'up' if pct_change > 0 else 'down' if pct_change < 0 else 'flat',
                    }
            except Exception:
                pass

            # Top contributors by ALL dimension columns
            dim_cols = conn.execute(sqlalchemy.text(f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = :t AND data_type IN ('text','character varying')
            """), {"t": table_name}).fetchall()

            aggregates['breakdowns'] = []
            for (dim_col_name,) in dim_cols[:3]:
                top = conn.execute(sqlalchemy.text(f'''
                    SELECT "{dim_col_name}"::text, SUM("{column_name}")::float as val,
                           COUNT(*) as cnt
                    FROM "{table_name}" WHERE "{column_name}" IS NOT NULL
                    GROUP BY "{dim_col_name}" ORDER BY val DESC LIMIT 5
                ''')).fetchall()
                total_val = aggregates['sum']
                aggregates['breakdowns'].append({
                    'dimension': dim_col_name,
                    'values': [
                        {'label': str(r[0]), 'value': round(r[1], 2),
                         'pct': round(r[1] / total_val * 100, 1) if total_val else 0,
                         'count': int(r[2])}
                        for r in top
                    ]
                })

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

    # Run template engine on the data for verified findings
    template_findings = []
    try:
        from services.templates import template_engine
        from routers.auto_analysis import _quick_profile
        # Sample data for template execution (max 5000 rows)
        df = pd.read_sql(f'SELECT * FROM "{table_name}" LIMIT 5000', engine)
        profiles = _quick_profile(df)
        # Get applicable templates
        applicable = template_engine.get_applicable(profiles)
        # Run top 3 templates
        for match in applicable[:3]:
            try:
                result = template_engine.run(match.template_id, df, profiles, match.matched_columns)
                if result.success and result.findings:
                    for f in result.findings[:3]:
                        finding_text = f if isinstance(f, str) else f.get('text', str(f))
                        template_findings.append(f"[VERIFIED] {finding_text} ({match.name})")
            except Exception:
                pass
    except Exception as exc:
        logger.warning("Template execution failed for insight: %s", exc)

    template_block = "\n".join(template_findings) if template_findings else "No template findings available"

    # Send aggregates + template findings to Claude for interpretation (no raw data)
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return JSONResponse(content={"finding": "API key not configured", "recommendation": "", "data_points": []})

    lang_instruction = "Antworte KOMPLETT auf Deutsch. Verwende deutsche Fachbegriffe und EUR-Formatierung (€1.234,56)." if locale == "de" else "Answer in English. Use EUR formatting (€1,234.56)."

    prompt = f"""{lang_instruction}
You are a senior Controlling analyst at a German Mittelstand company.
You are reviewing: "{node_label}" ({node_type}, business role: {business_role})
Current value: {node_value}

LIVE AGGREGATED DATA (computed from the actual database just now):
{json.dumps(aggregates, indent=2, default=str)}

VERIFIED TEMPLATE FINDINGS (computed by DataLaser engine, not AI):
{template_block}

Use the verified findings as the BASIS of your analysis.
Do not contradict them. Add context, financial impact, and recommendations.

RULES:
- You MUST name at least one specific entity (region, product, customer, machine) from the breakdown data.
- Generic advice like "consider diversifying" is FORBIDDEN. Be specific with targets.
- The financial_impact line MUST contain a specific EUR amount.

Write a JSON response with these EXACT fields:

1. "trend_text": One line showing value + direction + % change + period.
   Format: "5.546 ↓ 0,4% vs. Vorperiode" or "€12.489.515 ↑ 14,2% vs. Vorperiode"
   MUST include the actual number, arrow, percentage, and comparison period.

2. "finding": 2-3 sentences. Be SPECIFIC: name the exact dimension value (region, product, customer, machine) causing the pattern. Use actual numbers from the breakdown data. Example: "Region Nord generiert 43% des Gesamtumsatzes (€5,4M), wahrend Ost nur 12% beitragt. Kunden-Konzentration: Die Top-3 Kunden (Mueller GmbH, Schmidt AG, Richter AG) machen 67% des Umsatzes aus."

3. "recommendation": 1-2 sentences. Must be ACTIONABLE with specific targets. Not "diversify customers" but "Akquirieren Sie 5 Neukunden im Bereich €200-500K Jahresumsatz, Fokus auf Region Ost (derzeit nur 12% Anteil)."

4. "financial_impact": One sentence quantifying the EUR impact. Examples:
   "Potenzielle Einsparung: €8.200/Monat bei Senkung der Ausschussquote um 2%"
   "Klumpenrisiko: Verlust eines Top-Kunden gefahrdet €4,2M Jahresumsatz"
   "Umsatzpotenzial Region Ost: €1,8M bei Angleichung an Durchschnitt"
   This is the MOST IMPORTANT line for the CFO.

5. "data_points": array of 3-5 key metrics:
   Each: {{"label": "Name", "value": "formatted string with unit", "severity": "success|warning|critical|info"}}
   Include the top contributor by name, the concentration risk %, and the trend.

Return ONLY valid JSON. No markdown, no explanation."""

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
