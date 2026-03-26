"""
Table-level feature extraction for table type classification.
Aggregates column-level features into a per-table feature vector.
"""

import math
from typing import Optional


TABLE_TYPE_LABELS = [
    "transaction",  # Orders, sales, events (timestamped, high volume)
    "master",       # Customers, products, employees (entity data, lower volume)
    "quality",      # Complaints, defects, inspections
    "log",          # Audit trails, system logs, sync records
    "bridge",       # Many-to-many junction tables
    "fact",         # Analytical fact tables (data warehouse)
    "dimension",    # Dimensional lookup tables (data warehouse)
]

FEATURE_NAMES = [
    "row_count_log", "column_count",
    "numeric_pct", "text_pct", "date_pct", "boolean_pct",
    "has_timestamp", "has_id_column", "has_multiple_ids",
    "avg_cardinality_log", "avg_null_rate",
    "role_revenue_count", "role_cost_count", "role_quantity_count",
    "role_rate_count", "role_id_count", "role_category_count",
    "role_date_count", "role_unknown_count",
    "name_has_order", "name_has_customer", "name_has_product",
    "name_has_quality", "name_has_log", "name_has_history",
]


def extract_table_features(
    table_name: str,
    row_count: int,
    columns: list[dict],
    fingerprints: dict[str, dict],
) -> list[float]:
    """
    Extract a fixed-length feature vector for a table.

    Args:
        table_name: Name of the table
        row_count: Number of rows
        columns: List of column dicts with 'name', 'dtype', etc.
        fingerprints: {qualified_name: fingerprint_dict}

    Returns:
        Feature vector matching FEATURE_NAMES order.
    """
    n_cols = len(columns)
    if n_cols == 0:
        return [0.0] * len(FEATURE_NAMES)

    # Count column types
    numeric_count = sum(1 for c in columns if c.get('dtype') in ('numeric', 'float', 'int', 'integer'))
    text_count = sum(1 for c in columns if c.get('dtype') in ('text', 'categorical', 'string', 'varchar'))
    date_count = sum(1 for c in columns if c.get('dtype') in ('datetime', 'date', 'timestamp'))
    bool_count = sum(1 for c in columns if c.get('dtype') in ('boolean', 'bool'))

    numeric_pct = numeric_count / n_cols
    text_pct = text_count / n_cols
    date_pct = date_count / n_cols
    boolean_pct = bool_count / n_cols

    # Check for timestamp and ID columns
    name_lower = table_name.lower()
    has_timestamp = any(
        c.get('dtype') in ('datetime', 'date', 'timestamp') or
        any(k in c['name'].lower() for k in ('created', 'updated', 'timestamp', '_at', 'datum'))
        for c in columns
    )
    id_columns = [c for c in columns if
        c['name'].lower().endswith('_id') or
        c['name'].lower() in ('id', 'pk', 'uuid') or
        c['name'].lower().startswith('fk_')]
    has_id_column = len(id_columns) > 0
    has_multiple_ids = len(id_columns) >= 2  # bridge table signal

    # Average cardinality and null rate from fingerprints
    cardinalities = []
    null_rates = []
    for c in columns:
        qname = f"{table_name}.{c['name']}"
        fp = fingerprints.get(qname, {})
        if fp.get('unique_rate') is not None:
            cardinalities.append(fp['unique_rate'])
        if fp.get('null_rate') is not None:
            null_rates.append(fp['null_rate'])

    avg_cardinality = sum(cardinalities) / len(cardinalities) if cardinalities else 0.5
    avg_null_rate = sum(null_rates) / len(null_rates) if null_rates else 0.0

    # Role distribution
    role_counts = {
        'revenue': 0, 'cost': 0, 'quantity': 0, 'rate': 0,
        'identifier': 0, 'category': 0, 'date': 0, 'unknown': 0,
    }
    for c in columns:
        qname = f"{table_name}.{c['name']}"
        fp = fingerprints.get(qname, {})
        role = fp.get('business_role_hint', 'unknown')
        if role in role_counts:
            role_counts[role] += 1
        elif role in ('margin', 'price', 'amount'):
            role_counts['revenue'] += 1
        elif role in ('defect_rate',):
            role_counts['rate'] += 1
        elif role in ('text',):
            role_counts['category'] += 1
        elif role in ('count',):
            role_counts['quantity'] += 1
        else:
            role_counts['unknown'] += 1

    # Table name pattern features
    name_has_order = 1.0 if any(k in name_lower for k in ['order', 'bestellung', 'auftrag', 'buchung']) else 0.0
    name_has_customer = 1.0 if any(k in name_lower for k in ['customer', 'kunde', 'client', 'lieferant']) else 0.0
    name_has_product = 1.0 if any(k in name_lower for k in ['product', 'produkt', 'artikel', 'item']) else 0.0
    name_has_quality = 1.0 if any(k in name_lower for k in ['quality', 'qualität', 'reklamation', 'complaint', 'defect', 'ausschuss']) else 0.0
    name_has_log = 1.0 if any(k in name_lower for k in ['log', 'audit', 'sync', 'protokoll']) else 0.0
    name_has_history = 1.0 if any(k in name_lower for k in ['history', 'historie', 'verlauf', 'archiv']) else 0.0

    return [
        math.log1p(row_count),
        float(n_cols),
        numeric_pct, text_pct, date_pct, boolean_pct,
        1.0 if has_timestamp else 0.0,
        1.0 if has_id_column else 0.0,
        1.0 if has_multiple_ids else 0.0,
        math.log1p(avg_cardinality * 100),
        avg_null_rate,
        float(role_counts['revenue']), float(role_counts['cost']),
        float(role_counts['quantity']), float(role_counts['rate']),
        float(role_counts['identifier']), float(role_counts['category']),
        float(role_counts['date']), float(role_counts['unknown']),
        name_has_order, name_has_customer, name_has_product,
        name_has_quality, name_has_log, name_has_history,
    ]


def infer_table_type_heuristic(
    table_name: str,
    row_count: int,
    columns: list[dict],
    fingerprints: dict[str, dict],
) -> str:
    """
    Rule-based table type inference (no ML needed, works from day 1).
    Returns one of TABLE_TYPE_LABELS.
    """
    name_lower = table_name.lower()
    n_cols = len(columns)

    # Bridge table: mostly FK columns, 2+ ID columns, few other columns
    id_cols = [c for c in columns if c['name'].lower().endswith('_id') or c['name'].lower() in ('id', 'pk')]
    if len(id_cols) >= 2 and len(id_cols) >= n_cols * 0.5:
        return "bridge"

    # Quality table: name or columns suggest defects/complaints
    if any(k in name_lower for k in ['reklamation', 'complaint', 'defect', 'ausschuss', 'quality', 'qualität', 'fehler']):
        return "quality"

    # Log/audit table
    if any(k in name_lower for k in ['log', 'audit', 'sync', 'protokoll', 'history', 'verlauf']):
        return "log"

    # Transaction table: has timestamp + financial columns + high row count
    has_date = any(c.get('dtype') in ('datetime', 'date') for c in columns)
    has_financial = any(
        fingerprints.get(f"{table_name}.{c['name']}", {}).get('business_role_hint') in ('revenue', 'cost', 'amount', 'price')
        for c in columns
    )
    if has_date and has_financial:
        return "transaction"
    if any(k in name_lower for k in ['order', 'bestellung', 'buchung', 'transaktion', 'sale', 'invoice']):
        return "transaction"

    # Master/entity table: low row count relative to transactions, mostly text/category columns
    text_pct = sum(1 for c in columns if c.get('dtype') in ('text', 'categorical', 'string')) / max(n_cols, 1)
    if row_count < 1000 and text_pct > 0.4:
        return "master"
    if any(k in name_lower for k in ['kunde', 'customer', 'produkt', 'product', 'mitarbeiter', 'employee', 'lieferant', 'supplier']):
        return "master"

    # Fact table (data warehouse pattern): many numeric columns, FK references
    numeric_pct = sum(1 for c in columns if c.get('dtype') in ('numeric', 'float', 'int')) / max(n_cols, 1)
    if numeric_pct > 0.6 and len(id_cols) >= 2:
        return "fact"

    # Default: treat as transaction if large, master if small
    if row_count > 500:
        return "transaction"
    return "master"


def get_role_distribution(columns: list[dict], fingerprints: dict[str, dict], table_name: str) -> dict:
    """Get the distribution of business roles for a table's columns."""
    dist: dict[str, int] = {}
    for c in columns:
        qname = f"{table_name}.{c['name']}"
        fp = fingerprints.get(qname, {})
        role = fp.get('business_role_hint', 'unknown')
        dist[role] = dist.get(role, 0) + 1
    return dist
