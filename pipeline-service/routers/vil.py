"""
DataLaser VIL Router -- REST endpoints for the Verified Intelligence Layer.
Builds, updates, and serves the semantic knowledge graph.
"""
from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import json
import logging
from datetime import datetime, timezone

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
