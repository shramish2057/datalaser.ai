import chardet


def detect_encoding(file_bytes: bytes) -> str:
    result = chardet.detect(file_bytes)
    encoding = result.get('encoding') or 'utf-8'
    confidence = result.get('confidence') or 0
    # Fall back to utf-8 if confidence is low
    if confidence < 0.7:
        for enc in ['utf-8', 'latin-1', 'windows-1252', 'utf-16']:
            try:
                file_bytes.decode(enc)
                return enc
            except (UnicodeDecodeError, Exception):
                continue
    return encoding


def read_file_with_encoding(file_bytes: bytes, file_type: str) -> str:
    encoding = detect_encoding(file_bytes)
    return encoding
