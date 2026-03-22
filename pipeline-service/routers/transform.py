from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
import uuid
import json
from models.schemas import TransformRequest, TransformResult, TransformStep, DataProfile
from services.transformer import transformer
from services.suggester import generate_suggestions

router = APIRouter()


@router.post("/suggestions")
async def get_suggestions(profile: DataProfile):
    """Get AI-suggested transforms based on a data profile."""
    try:
        suggestions = await generate_suggestions(profile)
        return {"suggestions": suggestions, "count": len(suggestions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Suggestion generation failed: {str(e)}")


@router.post("/preview")
async def preview_transform(
    file: UploadFile = File(...),
    steps: str = Form(...),
    file_type: str = Form("csv"),
):
    """Preview transforms without persisting."""
    try:
        file_bytes = await file.read()
        steps_list = [TransformStep(**s) for s in json.loads(steps)]
        df = transformer.load_dataframe(file_bytes, file_type)
        rows_before = len(df)
        df_transformed, lineage, errors = transformer.apply_steps(df, steps_list, "preview")
        preview = transformer.get_preview(df_transformed)
        return {
            "preview": preview,
            "columns": list(df_transformed.columns),
            "rows_before": rows_before,
            "rows_after": len(df_transformed),
            "lineage": lineage,
            "errors": errors,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply", response_model=TransformResult)
async def apply_transform(
    file: UploadFile = File(...),
    steps: str = Form(...),
    run_id: Optional[str] = Form(None),
    source_id: str = Form(...),
    file_type: str = Form("csv"),
):
    """Apply transform steps to a dataset."""
    if not run_id:
        run_id = str(uuid.uuid4())

    try:
        file_bytes = await file.read()
        steps_list = [TransformStep(**s) for s in json.loads(steps)]
        df = transformer.load_dataframe(file_bytes, file_type)
        rows_before = len(df)
        df_transformed, lineage, errors = transformer.apply_steps(df, steps_list, run_id)
        preview = transformer.get_preview(df_transformed)

        return TransformResult(
            run_id=run_id,
            success=len(errors) == 0,
            rows_before=rows_before,
            rows_after=len(df_transformed),
            preview=preview,
            columns=list(df_transformed.columns),
            errors=errors,
            lineage=lineage,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
