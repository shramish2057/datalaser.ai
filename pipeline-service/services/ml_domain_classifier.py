"""
Domain/Industry classifier for DataLaser Intelligence Engine.
Predicts which business domain a dataset belongs to from its column profiles.

Two modes:
- Heuristic (works from day 1, no training needed)
- ML (trained from accumulated ml_training_datasets, needs 50+ samples)
"""

import os
import math
import logging
from typing import Optional
from pathlib import Path

from services.domain_registry import DOMAIN_REGISTRY, find_domain_by_column

logger = logging.getLogger(__name__)
MODELS_DIR = Path("models")


def extract_dataset_features(
    all_columns: list[dict],
    all_fingerprints: dict[str, dict],
    table_count: int,
) -> dict:
    """
    Extract dataset-level features for domain classification.
    Aggregates column-level info into a single feature dict.
    """
    n_cols = len(all_columns) or 1

    # Column type distribution
    numeric_count = sum(1 for c in all_columns if c.get('dtype') in ('numeric', 'float', 'int', 'integer'))
    text_count = sum(1 for c in all_columns if c.get('dtype') in ('text', 'categorical', 'string'))
    date_count = sum(1 for c in all_columns if c.get('dtype') in ('datetime', 'date', 'timestamp'))

    # Role distribution from fingerprints
    role_dist: dict[str, int] = {}
    for qname, fp in all_fingerprints.items():
        role = fp.get('business_role_hint', 'unknown')
        role_dist[role] = role_dist.get(role, 0) + 1

    # Domain pattern scores — how well each domain matches column names
    domain_scores: dict[str, float] = {}
    for col in all_columns:
        matches = find_domain_by_column(col['name'])
        for domain_id, score in matches:
            domain_scores[domain_id] = domain_scores.get(domain_id, 0) + score

    # Normalize domain scores
    max_score = max(domain_scores.values()) if domain_scores else 1
    for k in domain_scores:
        domain_scores[k] = round(domain_scores[k] / max(max_score, 1), 3)

    # Total row count
    total_rows = sum(
        fp.get('unique_count', 0) for fp in all_fingerprints.values()
    )

    return {
        "table_count": table_count,
        "total_column_count": len(all_columns),
        "total_row_count": total_rows,
        "numeric_column_pct": round(numeric_count / n_cols, 3),
        "text_column_pct": round(text_count / n_cols, 3),
        "date_column_pct": round(date_count / n_cols, 3),
        "role_distribution": role_dist,
        "domain_pattern_scores": domain_scores,
    }


def classify_domain_heuristic(
    all_columns: list[dict],
    all_fingerprints: dict[str, dict],
) -> tuple[str, float]:
    """
    Rule-based domain classification. Works from day 1.
    Returns (domain_id, confidence).
    """
    # Score each domain by column name matches
    domain_scores: dict[str, float] = {}

    for col in all_columns:
        col_name = col['name']
        matches = find_domain_by_column(col_name)
        for domain_id, score in matches:
            domain_scores[domain_id] = domain_scores.get(domain_id, 0) + score

    # Also check domain vocabulary in fingerprints
    for qname, fp in all_fingerprints.items():
        col_name = qname.split('.')[-1]
        # Check vocabulary matches from domain registry
        for domain_id, domain in DOMAIN_REGISTRY.items():
            for term in domain.vocabulary:
                if term in col_name.lower():
                    domain_scores[domain_id] = domain_scores.get(domain_id, 0) + 0.5
            for sub in domain.sub_domains:
                for term in sub.vocabulary:
                    if term in col_name.lower():
                        domain_scores[domain_id] = domain_scores.get(domain_id, 0) + 0.3

    if not domain_scores:
        return "services", 0.1  # generic fallback

    # Best match
    best = max(domain_scores.items(), key=lambda x: x[1])
    domain_id = best[0]

    # Confidence: normalize by column count
    n_cols = max(len(all_columns), 1)
    confidence = min(best[1] / (n_cols * 0.5), 1.0)

    return domain_id, round(confidence, 3)


def classify_domain_ml(
    features: dict,
) -> Optional[tuple[str, float]]:
    """
    ML-based domain classification. Requires trained model.
    Returns (domain_id, confidence) or None if no model available.
    """
    model_path = MODELS_DIR / "domain_classifier_latest.joblib"
    if not model_path.exists():
        return None

    try:
        import joblib
        bundle = joblib.load(model_path)
        model = bundle['model']
        feature_names = bundle['feature_names']

        # Build feature vector from the features dict
        X = []
        for name in feature_names:
            if name.startswith('domain_score_'):
                domain_id = name.replace('domain_score_', '')
                X.append(features.get('domain_pattern_scores', {}).get(domain_id, 0))
            elif name.startswith('role_'):
                role = name.replace('role_', '')
                X.append(features.get('role_distribution', {}).get(role, 0))
            else:
                X.append(features.get(name, 0))

        prediction = model.predict([X])[0]
        confidence = float(max(model.predict_proba([X])[0]))

        return prediction, confidence
    except Exception as e:
        logger.warning("ML domain classification failed: %s", e)
        return None


def classify_domain(
    all_columns: list[dict],
    all_fingerprints: dict[str, dict],
) -> tuple[str, float]:
    """
    Classify domain using ML if available, otherwise heuristic.
    """
    # Try ML first
    features = extract_dataset_features(all_columns, all_fingerprints, table_count=0)
    ml_result = classify_domain_ml(features)
    if ml_result and ml_result[1] > 0.7:
        logger.info("ML domain classifier: %s (%.2f)", ml_result[0], ml_result[1])
        return ml_result

    # Fallback to heuristic
    domain_id, confidence = classify_domain_heuristic(all_columns, all_fingerprints)
    logger.info("Heuristic domain classifier: %s (%.2f)", domain_id, confidence)
    return domain_id, confidence


def save_dataset_training_data(
    source_id: str,
    all_columns: list[dict],
    all_fingerprints: dict[str, dict],
    table_count: int,
    domain_id: str,
    domain_confidence: float,
    label_source: str,
):
    """Save dataset-level features for domain classifier training."""
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not supabase_key:
        return

    features = extract_dataset_features(all_columns, all_fingerprints, table_count)

    data = {
        "source_id": source_id,
        "table_count": table_count,
        "total_row_count": features["total_row_count"],
        "total_column_count": features["total_column_count"],
        "numeric_column_pct": features["numeric_column_pct"],
        "text_column_pct": features["text_column_pct"],
        "date_column_pct": features["date_column_pct"],
        "role_distribution": features["role_distribution"],
        "domain_pattern_scores": features["domain_pattern_scores"],
        "domain_id": domain_id,
        "domain_confidence": domain_confidence,
        "label_source": label_source,
    }

    try:
        import httpx
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                f"{supabase_url}/rest/v1/ml_training_datasets",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json=data,
            )
            if resp.status_code in (200, 201):
                logger.info("Saved dataset training sample: domain=%s", domain_id)
    except Exception as e:
        logger.warning("Dataset training save error: %s", e)
