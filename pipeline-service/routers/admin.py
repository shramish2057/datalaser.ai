"""
Admin endpoints for ML training pipeline.
Protected by ADMIN_API_KEY environment variable.
"""

import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_API_KEY = os.getenv("ML_ADMIN_API_KEY", "datalaser-admin-dev")


def verify_admin(x_admin_key: str = Header(None)):
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


@router.get("/ml/stats")
async def ml_stats(x_admin_key: str = Header(None)):
    """Get ML training statistics."""
    verify_admin(x_admin_key)

    try:
        from pathlib import Path
        models_dir = Path("models")

        # Count model files
        model_files = list(models_dir.glob("*.joblib")) if models_dir.exists() else []

        # Try to load latest model info
        latest_info = None
        latest_path = models_dir / "column_role_latest.joblib"
        if latest_path.exists():
            import joblib
            bundle = joblib.load(latest_path)
            latest_info = {
                "version": bundle.get("version"),
                "accuracy": bundle.get("accuracy"),
                "dataset_size": bundle.get("dataset_size"),
                "trained_at": bundle.get("trained_at"),
                "classes": bundle.get("classes", []),
            }

        # Get vocabulary stats
        vocab_stats = {}
        try:
            from services.ml_vocabulary import get_vocabulary_stats
            vocab_stats = get_vocabulary_stats()
        except Exception:
            pass

        # Count training samples from Supabase
        sample_counts = {}
        try:
            import httpx
            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
            if supabase_url and supabase_key:
                async with httpx.AsyncClient() as client:
                    for table in ["ml_training_samples", "ml_training_tables", "ml_training_datasets", "ml_template_results", "ml_vocabulary"]:
                        resp = await client.get(
                            f"{supabase_url}/rest/v1/{table}?select=id&limit=1",
                            headers={
                                "apikey": supabase_key,
                                "Authorization": f"Bearer {supabase_key}",
                                "Prefer": "count=exact",
                            },
                            timeout=5,
                        )
                        count = resp.headers.get("content-range", "").split("/")[-1]
                        sample_counts[table] = int(count) if count and count != "*" else 0
        except Exception:
            pass

        return JSONResponse(content={
            "model_count": len(model_files),
            "latest_model": latest_info,
            "sample_counts": sample_counts,
            "vocabulary": vocab_stats,
        })
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@router.post("/ml/train")
async def train_model(
    x_admin_key: str = Header(None),
    min_samples: int = Form(50),
):
    """Train a new column role classifier from accumulated samples."""
    verify_admin(x_admin_key)

    try:
        # Fetch training samples from Supabase
        import httpx
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

        if not supabase_url or not supabase_key:
            return JSONResponse(
                content={"error": "Supabase credentials not configured"},
                status_code=500
            )

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{supabase_url}/rest/v1/ml_training_samples?select=*",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                },
                timeout=30,
            )

        if resp.status_code != 200:
            return JSONResponse(
                content={"error": f"Failed to fetch samples: {resp.text}"},
                status_code=500
            )

        rows = resp.json()
        if not rows:
            return JSONResponse(content={"error": "No training samples found", "sample_count": 0})

        # Convert DB rows to training format
        samples = []
        for row in rows:
            samples.append({
                "column_name": row["column_name"],
                "business_role": row["business_role"],
                "label_source": row["label_source"],
                "features": {
                    "dtype": row.get("dtype"),
                    "distribution_shape": row.get("distribution_shape"),
                    "value_scale": row.get("value_scale"),
                    "null_rate": row.get("null_rate"),
                    "unique_rate": row.get("unique_rate"),
                    "unique_count": row.get("unique_count"),
                    "min_value": row.get("min_value"),
                    "max_value": row.get("max_value"),
                    "mean_value": row.get("mean_value"),
                    "std_value": row.get("std_dev"),
                    "skewness": row.get("skewness"),
                    "kurtosis": row.get("kurtosis"),
                    "is_integer": row.get("is_integer"),
                },
            })

        from services.ml_trainer import train_column_role_model
        result = train_model_result = train_column_role_model(samples, min_samples=min_samples)

        # Reload model in predictor
        from services.ml_predictor import reload_model
        reload_model()

        return JSONResponse(content=result)

    except Exception as e:
        logger.exception("Training failed")
        return JSONResponse(content={"error": str(e)}, status_code=500)


@router.post("/ml/process-dataset")
async def process_dataset(
    x_admin_key: str = Header(None),
    file: UploadFile = File(...),
    industry_type: str = Form("unknown"),
    use_claude: bool = Form(False),
):
    """
    Process an uploaded CSV dataset for ML training.
    Extracts column features and labels, saves to ml_training_samples.
    """
    verify_admin(x_admin_key)

    try:
        import pandas as pd
        import io
        from services.vil import StatisticalFingerprint

        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))

        fingerprinter = StatisticalFingerprint()
        samples_saved = 0

        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

        import httpx
        async with httpx.AsyncClient() as client:
            for col_name in df.columns:
                series = df[col_name]
                fp = fingerprinter.fingerprint_column(series, col_name)

                # Use regex-based role as label (free)
                business_role = fp.get("business_role_hint", "unknown")

                sample = {
                    "table_name": file.filename.replace(".csv", "").replace(" ", "_"),
                    "column_name": col_name,
                    "dtype": str(series.dtype),
                    "distribution_shape": fp.get("distribution_shape"),
                    "value_scale": fp.get("value_scale"),
                    "null_rate": float(series.isnull().mean()),
                    "unique_rate": float(series.nunique() / max(len(series), 1)),
                    "unique_count": int(series.nunique()),
                    "min_value": float(series.min()) if pd.api.types.is_numeric_dtype(series) else None,
                    "max_value": float(series.max()) if pd.api.types.is_numeric_dtype(series) else None,
                    "mean_value": float(series.mean()) if pd.api.types.is_numeric_dtype(series) else None,
                    "std_dev": float(series.std()) if pd.api.types.is_numeric_dtype(series) else None,
                    "skewness": float(series.skew()) if pd.api.types.is_numeric_dtype(series) else None,
                    "kurtosis": float(series.kurtosis()) if pd.api.types.is_numeric_dtype(series) else None,
                    "is_integer": bool(pd.api.types.is_integer_dtype(series)),
                    "business_role": business_role,
                    "label_source": "regex",
                    "industry_type": industry_type,
                }

                # Save to Supabase
                resp = await client.post(
                    f"{supabase_url}/rest/v1/ml_training_samples",
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    },
                    json=sample,
                    timeout=10,
                )
                if resp.status_code in (200, 201):
                    samples_saved += 1

        return JSONResponse(content={
            "file": file.filename,
            "columns": len(df.columns),
            "rows": len(df),
            "samples_saved": samples_saved,
            "industry_type": industry_type,
        })

    except Exception as e:
        logger.exception("Dataset processing failed")
        return JSONResponse(content={"error": str(e)}, status_code=500)
