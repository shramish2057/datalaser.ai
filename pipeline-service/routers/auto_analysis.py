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


def _quick_profile(df: pd.DataFrame) -> list[dict]:
    """Infer column semantic roles from a pandas DataFrame without full profiling."""
    profiles = []
    for col in df.columns:
        dtype = df[col].dtype
        nunique = df[col].nunique()
        total = len(df[col].dropna())
        name_lower = col.lower()

        # Date detection by name or dtype
        date_keywords = ['date', 'time', 'created', 'updated', 'timestamp', '_at', '_on',
                         'datum', 'zeitpunkt', 'erstellt', 'produktionsdatum', 'bestelldatum']
        if pd.api.types.is_datetime64_any_dtype(dtype) or any(kw in name_lower for kw in date_keywords):
            role = 'date'
        elif name_lower in ('id',) or name_lower.endswith('_id') or name_lower.endswith('id'):
            role = 'id'
        elif pd.api.types.is_numeric_dtype(dtype):
            if nunique == 2:
                role = 'binary'
            elif nunique > 20 or (total > 0 and nunique / total > 0.9):
                role = 'id' if nunique > 100 else 'measure'
            else:
                role = 'measure'
        elif pd.api.types.is_object_dtype(dtype) or pd.api.types.is_categorical_dtype(dtype):
            if nunique == 2:
                role = 'binary'
            elif nunique <= 50:
                role = 'dimension'
            else:
                role = 'text'
        else:
            role = 'measure'

        profiles.append({
            'name': col,
            'dtype': 'numeric' if pd.api.types.is_numeric_dtype(dtype) else 'categorical',
            'semantic_role': role,
        })
    return profiles


@router.post("/run-db")
async def run_auto_analysis_db(
    source_type: str = Form(...),
    connection_string: str = Form(...),
    table_name: str = Form(...),
    column_profiles: Optional[str] = Form(None),
):
    """Run full 17-analysis suite against a live database table.
    Smart-samples up to 50K rows for statistical computation.
    No AI/LLM calls, pure computation."""
    try:
        import sqlalchemy
        engine = sqlalchemy.create_engine(
            connection_string, connect_args={"connect_timeout": 10}
        )

        # Get actual row count
        with engine.connect() as conn:
            row_count = conn.execute(
                sqlalchemy.text(f'SELECT COUNT(*) FROM "{table_name}"')
            ).scalar()

        # Smart sample: up to 50K rows
        if row_count > 50000:
            df = pd.read_sql(
                f'SELECT * FROM "{table_name}" ORDER BY RANDOM() LIMIT 50000',
                engine
            )
        else:
            df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)

        # Profile columns
        if column_profiles:
            profiles = json.loads(column_profiles)
        else:
            profiles = _quick_profile(df)

        # Run the same AutoAnalyzer that files use
        result = auto_analyzer.analyze(df, profiles)
        result['row_count'] = row_count  # Use actual count, not sample size

        return JSONResponse(content=sanitize(result))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB auto-analysis failed: {str(e)}")
