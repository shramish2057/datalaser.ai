"""
ML model serving for column role prediction.
Loads trained model from disk, predicts business_role with confidence score.
Falls back gracefully if no model is available.
"""

import logging
from pathlib import Path
from typing import Optional

import joblib

from services.ml_features import extract_features

logger = logging.getLogger(__name__)

MODELS_DIR = Path("models")

# In-memory cache for loaded models
_model_cache: dict = {}


def _load_model(model_name: str = "column_role") -> Optional[dict]:
    """Load model from memory cache → local disk → Supabase Storage."""
    if model_name in _model_cache:
        return _model_cache[model_name]

    # Try loading from Supabase Storage (persistent) + local cache
    try:
        from services.ml_storage import load_model as storage_load
        bundle = storage_load(model_name)
        if bundle:
            _model_cache[model_name] = bundle
            logger.info(
                "Loaded %s model v%s (accuracy: %.3f, classes: %d)",
                model_name, bundle.get('version', '?'),
                bundle.get('accuracy', 0), len(bundle.get('classes', []))
            )
            return bundle
    except Exception as e:
        logger.warning("Storage load failed for %s: %s", model_name, e)

    # Fallback: try local filesystem directly
    path = MODELS_DIR / f"{model_name}_latest.joblib"
    if path.exists():
        try:
            bundle = joblib.load(path)
            _model_cache[model_name] = bundle
            return bundle
        except Exception:
            pass

    logger.info("No trained model found for %s", model_name)
    return None


def reload_model(model_name: str = "column_role"):
    """Force reload model from disk (after retraining)."""
    _model_cache.pop(model_name, None)
    return _load_model(model_name)


def predict_column_role(fp: dict, col_name: str) -> Optional[tuple[str, float]]:
    """
    Predict business_role for a single column.

    Returns:
        (predicted_role, confidence) or None if no model available.
    """
    bundle = _load_model()
    if not bundle:
        return None

    model = bundle['model']
    try:
        features = extract_features(fp, col_name)
        prediction = model.predict([features])[0]
        probas = model.predict_proba([features])[0]
        confidence = float(max(probas))
        return prediction, confidence
    except Exception as e:
        logger.warning("Prediction failed for %s: %s", col_name, e)
        return None


def predict_all_columns(
    fingerprints: dict[str, dict],
    confidence_threshold: float = 0.85,
) -> Optional[dict]:
    """
    Predict business_role for all columns in a dataset.
    Returns a result dict compatible with classify_columns_with_ai_sync() output,
    or None if model is unavailable or average confidence is too low.

    Args:
        fingerprints: {qualified_name: fingerprint_dict}
        confidence_threshold: minimum average confidence to accept ML result

    Returns:
        {
            'columns': [{'name': ..., 'business_role': ..., ...}],
            'categories': [...],
            'avg_confidence': float,
            'source': 'ml'
        }
        or None
    """
    bundle = _load_model()
    if not bundle:
        return None

    model = bundle['model']
    columns = []
    confidences = []

    # Role → category mapping (derived, not AI)
    ROLE_TO_CATEGORY = {
        'revenue': 'revenue', 'cost': 'revenue', 'margin': 'revenue',
        'quantity': 'production', 'count': 'production',
        'rate': 'quality', 'defect_rate': 'quality',
        'identifier': 'entity', 'category': 'entity', 'text': 'entity',
        'date': 'entity',
    }

    # Role → importance (heuristic)
    ROLE_TO_IMPORTANCE = {
        'revenue': 5, 'cost': 5, 'margin': 5,
        'rate': 4, 'defect_rate': 4, 'quantity': 4,
        'count': 3, 'category': 3,
        'date': 2, 'identifier': 1, 'text': 1, 'unknown': 1,
    }

    # Role → bilingual label template
    ROLE_LABELS = {
        'revenue': ('Umsatz', 'Revenue'),
        'cost': ('Kosten', 'Cost'),
        'margin': ('Marge', 'Margin'),
        'quantity': ('Menge', 'Quantity'),
        'rate': ('Quote', 'Rate'),
        'count': ('Anzahl', 'Count'),
        'identifier': ('ID', 'ID'),
        'category': ('Kategorie', 'Category'),
        'date': ('Datum', 'Date'),
    }

    for qname, fp in fingerprints.items():
        col_name = qname.split('.')[-1]
        try:
            features = extract_features(fp, col_name)
            prediction = model.predict([features])[0]
            probas = model.predict_proba([features])[0]
            confidence = float(max(probas))

            category = ROLE_TO_CATEGORY.get(prediction, 'entity')
            importance = ROLE_TO_IMPORTANCE.get(prediction, 2)
            labels = ROLE_LABELS.get(prediction, (col_name.replace('_', ' ').title(), col_name.replace('_', ' ').title()))

            columns.append({
                'name': col_name,
                'business_role': prediction,
                'business_category': category,
                'label_de': labels[0],
                'label_en': labels[1],
                'importance': importance,
                'ml_confidence': confidence,
            })
            confidences.append(confidence)
        except Exception as e:
            logger.warning("Prediction failed for %s: %s", qname, e)
            continue

    if not confidences:
        return None

    avg_confidence = sum(confidences) / len(confidences)

    if avg_confidence < confidence_threshold:
        logger.info(
            "ML confidence too low (%.3f < %.3f), falling back to Claude",
            avg_confidence, confidence_threshold
        )
        return None

    # Build default categories from detected roles
    detected_categories = set(c['business_category'] for c in columns)
    from services.vil import DEFAULT_CATEGORIES
    categories = [c for c in DEFAULT_CATEGORIES if c['id'] in detected_categories]

    logger.info(
        "ML predicted %d columns, avg confidence: %.3f",
        len(columns), avg_confidence
    )

    return {
        'columns': columns,
        'categories': categories,
        'avg_confidence': avg_confidence,
        'source': 'ml',
    }
