from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List
import uuid
import json
from models.schemas import JoinDefinition
from services.joiner import joiner

router = APIRouter()


@router.post("/detect")
async def detect_joins(
    files: List[UploadFile] = File(...),
    aliases: str = Form(...),
):
    """Upload 2+ files and detect joinable column candidates."""
    try:
        alias_list = json.loads(aliases)
        if len(files) < 2:
            raise HTTPException(status_code=400, detail="At least 2 files required")
        if len(files) != len(alias_list):
            raise HTTPException(status_code=400, detail="Number of files must match aliases")

        dataframes = {}
        for file, alias in zip(files, alias_list):
            file_bytes = await file.read()
            file_type = (file.filename or "").split(".")[-1].lower()
            dataframes[alias] = joiner.load_source(file_bytes, file_type)

        keys = list(dataframes.keys())
        df1 = dataframes[keys[0]]
        df2 = dataframes[keys[1]]

        candidates = joiner.detect_join_candidates(df1, df2, keys[0], keys[1])

        return {
            "left_source": keys[0],
            "right_source": keys[1],
            "left_columns": list(df1.columns),
            "right_columns": list(df2.columns),
            "left_rows": len(df1),
            "right_rows": len(df2),
            "candidates": [c.model_dump() for c in candidates],
            "recommended": candidates[0].model_dump() if candidates else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Join detection failed: {str(e)}")


@router.post("/apply")
async def apply_join(
    files: List[UploadFile] = File(...),
    aliases: str = Form(...),
    joins: str = Form(...),
):
    """Apply joins and return merged dataset preview + stats."""
    try:
        alias_list = json.loads(aliases)
        join_list = [JoinDefinition(**j) for j in json.loads(joins)]

        dataframes = {}
        for file, alias in zip(files, alias_list):
            file_bytes = await file.read()
            file_type = (file.filename or "").split(".")[-1].lower()
            dataframes[alias] = joiner.load_source(file_bytes, file_type)

        result_df = joiner.apply_join(dataframes, join_list)

        keys = list(dataframes.keys())
        stats = joiner.get_join_stats(
            df_before_left=dataframes[keys[0]],
            df_before_right=dataframes[keys[1]],
            df_after=result_df,
            join_type=join_list[0].join_type.value if join_list else "inner",
        )

        preview = result_df.head(10).fillna("").to_dict(orient="records")

        return {
            "success": True,
            "stats": stats,
            "columns": list(result_df.columns),
            "preview": preview,
            "run_id": str(uuid.uuid4()),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Join failed: {str(e)}")
