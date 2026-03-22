import dateparser
from typing import List, Optional
import re

DATE_FORMATS = [
    r'\d{4}-\d{2}-\d{2}',           # ISO: 2024-01-15
    r'\d{1,2}/\d{1,2}/\d{4}',       # US: 01/15/2024
    r'\d{1,2}-\d{1,2}-\d{4}',       # EU: 15-01-2024
    r'\d{1,2}\s+\w+\s+\d{4}',       # 15 January 2024
    r'\w+\s+\d{1,2},?\s+\d{4}',     # January 15, 2024
    r'\d{10}',                        # Unix timestamp
    r'\d{13}',                        # Unix ms timestamp
]


def detect_date_formats(sample_values: List[str]) -> List[str]:
    detected = set()
    for val in sample_values:
        if not val or str(val).strip() == '':
            continue
        for fmt_pattern in DATE_FORMATS:
            if re.match(fmt_pattern, str(val).strip()):
                detected.add(fmt_pattern)
                break
    return list(detected)


def has_format_inconsistency(sample_values: List[str]) -> bool:
    formats = detect_date_formats([v for v in sample_values if v])
    return len(formats) > 1


def parse_date_safely(value: str) -> Optional[str]:
    try:
        parsed = dateparser.parse(str(value))
        if parsed:
            return parsed.isoformat()
    except Exception:
        pass
    return None
