"""
Feature extraction for ML column role classification.
Converts StatisticalFingerprint output + column name into a numeric feature vector.
"""

import math

# Bilingual keyword sets for name-based features
_REVENUE_KW = {'revenue', 'umsatz', 'sales', 'erlös', 'ertrag', 'einnahmen', 'income', 'turnover'}
_COST_KW = {'cost', 'kosten', 'aufwand', 'herstellkosten', 'expense', 'ausgaben', 'material'}
_QUANTITY_KW = {'menge', 'quantity', 'stück', 'bestand', 'anzahl', 'count', 'amount', 'volume'}
_RATE_KW = {'rate', 'quote', 'prozent', 'anteil', 'percent', 'ratio', 'share'}
_MARGIN_KW = {'margin', 'marge', 'deckungsbeitrag', 'profit', 'gewinn'}
_ID_KW = {'_id', 'nummer', 'number', 'code', 'key', 'uuid', 'ref'}
_DATE_KW = {'date', 'datum', 'time', 'created', 'updated', 'timestamp', '_at', '_on'}
_QUALITY_KW = {'defect', 'ausschuss', 'reklamation', 'complaint', 'fehler', 'mangel', 'quality'}
_PRICE_KW = {'price', 'preis', 'betrag', 'tarif', 'gebühr', 'fee'}

# Feature names in order (must match training and prediction)
FEATURE_NAMES = [
    'null_rate', 'unique_rate', 'unique_count_log',
    'skewness', 'kurtosis', 'is_integer',
    'coeff_variation', 'value_range_log', 'mean_log', 'std_log',
    'scale_currency', 'scale_count', 'scale_percentage',
    'scale_id', 'scale_rate', 'scale_score', 'scale_generic',
    'dist_normal', 'dist_skewed_right', 'dist_skewed_left',
    'dist_bimodal', 'dist_zero_heavy', 'dist_uniform',
    'name_has_revenue', 'name_has_cost', 'name_has_quantity',
    'name_has_rate', 'name_has_margin', 'name_has_id',
    'name_has_date', 'name_has_quality', 'name_has_price',
    'name_length', 'name_word_count', 'name_has_underscore',
    'dtype_numeric', 'dtype_text', 'dtype_datetime',
]


def extract_features(fp: dict, col_name: str) -> list[float]:
    """
    Extract a fixed-length feature vector from a column's fingerprint + name.
    Returns a list of floats in FEATURE_NAMES order.
    """
    name_lower = col_name.lower()
    name_tokens = set(name_lower.replace('-', '_').split('_'))

    # Safe numeric extraction
    def safe(key, default=0.0):
        v = fp.get(key, default)
        if v is None:
            return default
        try:
            return float(v)
        except (ValueError, TypeError):
            return default

    null_rate = safe('null_rate')
    unique_rate = safe('unique_rate')
    unique_count = safe('unique_count')
    skewness = safe('skewness')
    kurtosis = safe('kurtosis')
    is_integer = 1.0 if fp.get('is_integer') else 0.0
    min_val = safe('min_value')
    max_val = safe('max_value')
    mean_val = safe('mean_value')
    std_val = safe('std_value')

    # Derived
    coeff_var = std_val / max(abs(mean_val), 0.001) if mean_val else 0.0
    value_range_log = math.log1p(abs(max_val - min_val))
    mean_log = math.log1p(abs(mean_val))
    std_log = math.log1p(abs(std_val))
    unique_count_log = math.log1p(unique_count)

    # Scale one-hot
    scale = fp.get('value_scale', 'generic')
    scale_currency = 1.0 if scale == 'currency' else 0.0
    scale_count = 1.0 if scale == 'count' else 0.0
    scale_percentage = 1.0 if scale == 'percentage' else 0.0
    scale_id = 1.0 if scale == 'id' else 0.0
    scale_rate = 1.0 if scale == 'rate' else 0.0
    scale_score = 1.0 if scale == 'score' else 0.0
    scale_generic = 1.0 if scale == 'generic' else 0.0

    # Distribution one-hot
    dist = fp.get('distribution_shape', 'unknown')
    dist_normal = 1.0 if dist == 'normal' else 0.0
    dist_skewed_right = 1.0 if dist == 'skewed_right' else 0.0
    dist_skewed_left = 1.0 if dist == 'skewed_left' else 0.0
    dist_bimodal = 1.0 if dist == 'bimodal' else 0.0
    dist_zero_heavy = 1.0 if dist == 'zero_heavy' else 0.0
    dist_uniform = 1.0 if dist == 'uniform' else 0.0

    # Name pattern features
    def has_any(keywords):
        return 1.0 if any(k in name_lower for k in keywords) or bool(name_tokens & keywords) else 0.0

    name_has_revenue = has_any(_REVENUE_KW)
    name_has_cost = has_any(_COST_KW)
    name_has_quantity = has_any(_QUANTITY_KW)
    name_has_rate = has_any(_RATE_KW)
    name_has_margin = has_any(_MARGIN_KW)
    name_has_id = has_any(_ID_KW)
    name_has_date = has_any(_DATE_KW)
    name_has_quality = has_any(_QUALITY_KW)
    name_has_price = has_any(_PRICE_KW)

    # Name structure
    name_length = float(len(col_name))
    name_word_count = float(len(col_name.split('_')))
    name_has_underscore = 1.0 if '_' in col_name else 0.0

    # Dtype
    dtype = fp.get('dtype', 'unknown')
    dtype_numeric = 1.0 if dtype in ('numeric', 'float', 'int', 'integer') else 0.0
    dtype_text = 1.0 if dtype in ('text', 'categorical', 'string', 'varchar') else 0.0
    dtype_datetime = 1.0 if dtype in ('datetime', 'date', 'timestamp') else 0.0

    return [
        null_rate, unique_rate, unique_count_log,
        skewness, kurtosis, is_integer,
        coeff_var, value_range_log, mean_log, std_log,
        scale_currency, scale_count, scale_percentage,
        scale_id, scale_rate, scale_score, scale_generic,
        dist_normal, dist_skewed_right, dist_skewed_left,
        dist_bimodal, dist_zero_heavy, dist_uniform,
        name_has_revenue, name_has_cost, name_has_quantity,
        name_has_rate, name_has_margin, name_has_id,
        name_has_date, name_has_quality, name_has_price,
        name_length, name_word_count, name_has_underscore,
        dtype_numeric, dtype_text, dtype_datetime,
    ]


def extract_features_dict(fp: dict, col_name: str) -> dict:
    """Extract features as a named dict (for inspection/debugging)."""
    values = extract_features(fp, col_name)
    return dict(zip(FEATURE_NAMES, values))
