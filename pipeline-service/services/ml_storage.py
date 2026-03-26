"""
ML Model Storage — persists trained models to Supabase Storage.
Survives Railway redeploys. Local filesystem used as cache only.

Storage path: ml-models/{model_name}/{version}.joblib
Bucket: 'ml-models' (created via Supabase dashboard or migration)
"""

import os
import io
import logging
from pathlib import Path
from typing import Optional

import joblib
import httpx

logger = logging.getLogger(__name__)

LOCAL_CACHE_DIR = Path("models")
LOCAL_CACHE_DIR.mkdir(exist_ok=True)

BUCKET = "ml-models"


def _supabase_creds() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    return url, key


def save_model(model_bundle: dict, model_name: str, version: str) -> str:
    """
    Save a trained model to Supabase Storage + local cache.

    Args:
        model_bundle: dict with 'model', 'feature_names', 'classes', etc.
        model_name: e.g. 'column_role', 'domain_classifier'
        version: e.g. '20260326_143000'

    Returns:
        Storage path string
    """
    # 1. Save to local cache first (for immediate serving)
    local_path = LOCAL_CACHE_DIR / f"{model_name}_v{version}.joblib"
    joblib.dump(model_bundle, local_path)

    latest_path = LOCAL_CACHE_DIR / f"{model_name}_latest.joblib"
    joblib.dump(model_bundle, latest_path)

    # 2. Upload to Supabase Storage (persistent)
    storage_path = f"{model_name}/{version}.joblib"
    latest_storage_path = f"{model_name}/latest.joblib"

    url, key = _supabase_creds()
    if not url or not key:
        logger.warning("Supabase not configured, model saved locally only")
        return str(local_path)

    # Serialize to bytes
    buffer = io.BytesIO()
    joblib.dump(model_bundle, buffer)
    model_bytes = buffer.getvalue()

    try:
        with httpx.Client(timeout=30) as client:
            # Upload versioned copy
            resp = client.post(
                f"{url}/storage/v1/object/{BUCKET}/{storage_path}",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/octet-stream",
                    "x-upsert": "true",
                },
                content=model_bytes,
            )
            if resp.status_code not in (200, 201):
                logger.warning("Failed to upload model to storage: %s", resp.text[:200])

            # Upload as 'latest'
            resp2 = client.post(
                f"{url}/storage/v1/object/{BUCKET}/{latest_storage_path}",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/octet-stream",
                    "x-upsert": "true",
                },
                content=model_bytes,
            )
            if resp2.status_code in (200, 201):
                logger.info("Model saved to Supabase Storage: %s", storage_path)
            else:
                logger.warning("Failed to upload latest model: %s", resp2.text[:200])

    except Exception as e:
        logger.warning("Storage upload error (model saved locally): %s", e)

    return storage_path


def load_model(model_name: str) -> Optional[dict]:
    """
    Load a trained model. Tries local cache first, then Supabase Storage.

    Returns:
        Model bundle dict or None if not found.
    """
    # 1. Try local cache first (fast)
    local_path = LOCAL_CACHE_DIR / f"{model_name}_latest.joblib"
    if local_path.exists():
        try:
            bundle = joblib.load(local_path)
            logger.debug("Model loaded from local cache: %s", model_name)
            return bundle
        except Exception:
            pass

    # 2. Download from Supabase Storage
    url, key = _supabase_creds()
    if not url or not key:
        return None

    storage_path = f"{model_name}/latest.joblib"

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{url}/storage/v1/object/{BUCKET}/{storage_path}",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                },
            )
            if resp.status_code == 200:
                buffer = io.BytesIO(resp.content)
                bundle = joblib.load(buffer)

                # Cache locally for next time
                joblib.dump(bundle, local_path)
                logger.info("Model downloaded from Supabase Storage: %s", model_name)
                return bundle
            else:
                logger.debug("No model in storage for %s: %s", model_name, resp.status_code)

    except Exception as e:
        logger.warning("Storage download error: %s", e)

    return None


def list_model_versions(model_name: str) -> list[dict]:
    """List all versions of a model in Supabase Storage."""
    url, key = _supabase_creds()
    if not url or not key:
        return []

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                f"{url}/storage/v1/object/list/{BUCKET}",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={"prefix": f"{model_name}/", "limit": 100},
            )
            if resp.status_code == 200:
                files = resp.json()
                return [
                    {
                        "name": f["name"],
                        "size": f.get("metadata", {}).get("size", 0),
                        "created_at": f.get("created_at", ""),
                    }
                    for f in files
                    if f["name"].endswith(".joblib") and f["name"] != "latest.joblib"
                ]
    except Exception:
        pass

    return []
