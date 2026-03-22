from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
import uuid
import pandas as pd
import io
from services.validator import validator
from models.schemas import ValidationReport

router = APIRouter()


@router.post("/run", response_model=ValidationReport)
async def run_validation(
    file: UploadFile = File(...),
    run_id: Optional[str] = Form(None),
    source_id: str = Form("unknown"),
    file_type: str = Form("csv"),
):
    """Run data quality validation suite on a dataset."""
    if not run_id:
        run_id = str(uuid.uuid4())

    try:
        file_bytes = await file.read()
        buf = io.BytesIO(file_bytes)
        na_vals = ["", "null", "NULL", "NA", "N/A", "nan", "NaN", "-", "\\N"]

        if file_type == "csv":
            df = pd.read_csv(buf, na_values=na_vals)
        elif file_type in ("xlsx", "xls"):
            df = pd.read_excel(buf)
        elif file_type == "json":
            df = pd.read_json(buf)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_type}")

        report = validator.validate(df, run_id=run_id, source_name=file.filename or "dataset")
        return report

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.post("/drift")
async def detect_drift(request: dict):
    """Compare current and previous data profiles to detect schema drift."""
    try:
        current = request.get("current_profile", {})
        previous = request.get("previous_profile", {})
        result = validator.detect_schema_drift(current, previous)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Drift detection failed: {str(e)}")


@router.get("/{run_id}")
async def get_validation(run_id: str):
    """Retrieve a previously run validation report."""
    raise HTTPException(
        status_code=404,
        detail="Validation result not found — use POST /validate/run to create one",
    )
