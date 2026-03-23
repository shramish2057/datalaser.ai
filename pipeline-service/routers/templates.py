from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import json

from services.templates import template_engine
from services.profiler import profiler
from routers.analyst import load_df, sanitize

router = APIRouter()


@router.post("/applicable")
async def get_applicable_templates(
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    column_profiles: Optional[str] = Form(None),
):
    """Given uploaded data, return which analysis templates apply."""
    try:
        file_bytes = await file.read()

        if column_profiles:
            profiles = json.loads(column_profiles)
        else:
            profile_result = profiler.profile_file(
                file_bytes, file.filename or "data.csv",
                run_id="auto", source_id="auto"
            )
            profiles = [col.model_dump() for col in profile_result.columns]

        matches = template_engine.get_applicable(profiles)
        return JSONResponse(content=sanitize([m.model_dump() for m in matches]))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{template_id}/run")
async def run_template(
    template_id: str,
    file: UploadFile = File(...),
    file_type: str = Form("csv"),
    column_profiles: Optional[str] = Form(None),
    column_mapping: Optional[str] = Form(None),
):
    """Run a specific analysis template on uploaded data."""
    try:
        file_bytes = await file.read()
        df = load_df(file_bytes, file_type)

        if column_profiles:
            profiles = json.loads(column_profiles)
        else:
            profile_result = profiler.profile_file(
                file_bytes, file.filename or "data.csv",
                run_id="auto", source_id="auto"
            )
            profiles = [col.model_dump() for col in profile_result.columns]

        mapping = json.loads(column_mapping) if column_mapping else None
        result = template_engine.run(template_id, df, profiles, mapping)
        return JSONResponse(content=sanitize(result.model_dump()))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
