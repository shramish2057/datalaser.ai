import re
from typing import List

EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
PHONE_RE = re.compile(r'^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$')
URL_RE = re.compile(r'^https?://\S+$')
ZIP_RE = re.compile(r'^\d{5}(-\d{4})?$')
UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)

NULL_STRINGS = {'', 'null', 'none', 'na', 'n/a', 'nan', '#n/a', '-', '--', 'missing', 'unknown', '?'}


def is_null_value(value: str) -> bool:
    return str(value).strip().lower() in NULL_STRINGS


def detect_semantic_type(column_name: str, sample_values: List[str]) -> str:
    non_null = [v for v in sample_values if not is_null_value(str(v))]
    if not non_null:
        return 'empty'

    checks = [
        (EMAIL_RE, 'email'),
        (PHONE_RE, 'phone'),
        (URL_RE, 'url'),
        (UUID_RE, 'uuid'),
        (ZIP_RE, 'zipcode'),
    ]

    for pattern, semantic_type in checks:
        match_rate = sum(1 for v in non_null if pattern.match(str(v).strip())) / len(non_null)
        if match_rate > 0.8:
            return semantic_type

    return 'general'


def count_true_nulls(series_values: List) -> int:
    return sum(1 for v in series_values if is_null_value(str(v)) or v is None)
