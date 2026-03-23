from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import pandas as pd
import numpy as np
import io
import json

from services.auto_analyzer import auto_analyzer
from services.profiler import profiler
from routers.analyst import load_df, sanitize

router = APIRouter()


@router.post("/run")
async def run_auto_analysis(
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    source_id: Optional[str] = Form(None),
    column_profiles: Optional[str] = Form(None),
):
    """Run full auto-analysis on uploaded data. Returns correlations,
    distributions, anomalies, segments, relationships, and top insights.
    No AI/LLM calls -- pure computation."""
    try:
        file_bytes = await file.read()
        df = load_df(file_bytes, file_type)

        # If column profiles provided, use them; otherwise profile first
        if column_profiles:
            profiles = json.loads(column_profiles)
        else:
            profile_result = profiler.profile_file(
                file_bytes, file.filename or "data.csv",
                run_id="auto", source_id=source_id or "auto"
            )
            profiles = [col.model_dump() for col in profile_result.columns]

        result = auto_analyzer.analyze(df, profiles)
        return JSONResponse(content=sanitize(result))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-analysis failed: {str(e)}")
