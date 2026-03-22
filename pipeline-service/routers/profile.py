from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional
import uuid
from services.profiler import profiler
from models.schemas import DataProfile

router = APIRouter()


@router.post("/file", response_model=DataProfile)
async def profile_file(
    file: UploadFile = File(...),
    source_id: str = Form(...),
    run_id: Optional[str] = Form(None),
):
    """Profile an uploaded file — detect types, quality, stats."""
    if not run_id:
        run_id = str(uuid.uuid4())

    file_bytes = await file.read()
    print(f'[PROFILE] Received file: {file.filename}, size={len(file_bytes)}, first_100={file_bytes[:100]}')

    # 500MB limit
    max_size = 500 * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 500MB.")

    allowed_types = ['csv', 'xlsx', 'xls', 'json', 'parquet']
    file_ext = (file.filename or '').split('.')[-1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

    try:
        result = profiler.profile_file(
            file_bytes=file_bytes,
            file_name=file.filename or 'unknown.csv',
            run_id=run_id,
            source_id=source_id,
        )
        print(f'[PROFILE] Result: score={result.quality_score}, warnings={len(result.warnings)}, rows={result.total_rows}')
        for w in result.warnings:
            print(f'[PROFILE]   {w.column}: {w.detail}')
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profiling failed: {str(e)}")


@router.post("/database")
async def profile_database(request: dict):
    """Profile a database table via connection string."""
    run_id = request.get('run_id') or str(uuid.uuid4())
    try:
        result = profiler.profile_database_table(
            connection_string=request['connection_string'],
            table_name=request['table_name'],
            run_id=run_id,
            source_id=request['source_id'],
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database profiling failed: {str(e)}")


@router.get("/{run_id}")
async def get_profile(run_id: str):
    """Retrieve a previously computed profile."""
    raise HTTPException(status_code=404, detail="Profile not found — use POST /profile/file to create one")
