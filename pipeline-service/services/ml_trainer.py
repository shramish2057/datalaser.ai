"""
ML model training for column role classification.
Trains a Random Forest on accumulated VIL training samples.
"""

import os
import logging
import json
from datetime import datetime
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score
import joblib

from services.ml_features import extract_features, FEATURE_NAMES

logger = logging.getLogger(__name__)

MODELS_DIR = Path("models")
MODELS_DIR.mkdir(exist_ok=True)


def train_column_role_model(
    samples: list[dict],
    min_samples: int = 50,
    version: str | None = None,
) -> dict:
    """
    Train a Random Forest classifier for business_role prediction.

    Args:
        samples: List of dicts with keys:
            - column_name: str
            - features: dict (fingerprint data)
            - business_role: str (label)
            - label_source: str
        min_samples: Minimum samples required to train
        version: Model version string (auto-generated if None)

    Returns:
        Dict with accuracy, f1_scores, model_path, version
    """
    if len(samples) < min_samples:
        return {
            "error": f"Not enough samples: {len(samples)} < {min_samples}",
            "sample_count": len(samples),
        }

    # Weight samples by label source (user corrections > claude > regex)
    source_weights = {
        'user_correction': 3.0,
        'claude': 2.0,
        'ml_verified': 1.5,
        'regex': 1.0,
    }

    X = []
    y = []
    weights = []

    for s in samples:
        try:
            features = extract_features(s.get('features', {}), s['column_name'])
            role = s['business_role']
            if not role or role == 'unknown':
                continue
            X.append(features)
            y.append(role)
            weights.append(source_weights.get(s.get('label_source', 'regex'), 1.0))
        except Exception as e:
            logger.warning("Skipping sample %s: %s", s.get('column_name'), e)
            continue

    if len(X) < min_samples:
        return {
            "error": f"Not enough valid samples: {len(X)} < {min_samples}",
            "sample_count": len(X),
        }

    X = np.array(X)
    y = np.array(y)
    weights = np.array(weights)

    # Train/test split
    X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
        X, y, weights, test_size=0.2, random_state=42, stratify=y
    )

    # Train Random Forest
    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=20,
        min_samples_leaf=2,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train, sample_weight=w_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

    # Cross-validation
    cv_scores = cross_val_score(model, X, y, cv=min(5, len(set(y))), scoring='accuracy')

    # Version
    if not version:
        version = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Save model
    model_path = MODELS_DIR / f"column_role_v{version}.joblib"
    joblib.dump({
        'model': model,
        'feature_names': FEATURE_NAMES,
        'classes': list(model.classes_),
        'version': version,
        'accuracy': accuracy,
        'trained_at': datetime.now().isoformat(),
        'dataset_size': len(X),
    }, model_path)

    # Also save as 'latest' for serving
    latest_path = MODELS_DIR / "column_role_latest.joblib"
    joblib.dump({
        'model': model,
        'feature_names': FEATURE_NAMES,
        'classes': list(model.classes_),
        'version': version,
        'accuracy': accuracy,
        'trained_at': datetime.now().isoformat(),
        'dataset_size': len(X),
    }, latest_path)

    # Feature importance
    importances = dict(zip(FEATURE_NAMES, model.feature_importances_))
    top_features = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:10]

    logger.info(
        "Column role model v%s trained: accuracy=%.3f, cv=%.3f±%.3f, samples=%d, classes=%d",
        version, accuracy, cv_scores.mean(), cv_scores.std(), len(X), len(model.classes_)
    )

    return {
        "version": version,
        "accuracy": round(accuracy, 4),
        "cv_accuracy": round(float(cv_scores.mean()), 4),
        "cv_std": round(float(cv_scores.std()), 4),
        "f1_scores": {k: round(v.get('f1-score', 0), 4) for k, v in report.items() if isinstance(v, dict)},
        "dataset_size": len(X),
        "class_count": len(model.classes_),
        "classes": list(model.classes_),
        "top_features": top_features,
        "model_path": str(model_path),
    }
