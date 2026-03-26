"""
Auto-growing vocabulary builder for DataLaser Intelligence Engine.
Learns German business terminology from every dataset processed.
Builds a bilingual dictionary: German column name tokens → English meaning + business role.
"""

import os
import re
import logging
from typing import Optional

import httpx

from services.domain_registry import (
    UNIVERSAL_VOCABULARY,
    DOMAIN_REGISTRY,
    find_domain_by_column,
)

logger = logging.getLogger(__name__)


def tokenize_column_name(col_name: str) -> list[str]:
    """
    Split a column name into meaningful tokens.
    Handles: underscore_case, camelCase, German compound words (basic).

    Examples:
        "quartals_umsatz" → ["quartals", "umsatz"]
        "herstellKosten" → ["herstell", "kosten"]
        "umsatz_vorjahr" → ["umsatz", "vorjahr"]
    """
    # Split on underscores
    parts = col_name.split('_')

    tokens = []
    for part in parts:
        # Split camelCase
        sub = re.sub(r'([a-z])([A-Z])', r'\1_\2', part).split('_')
        for s in sub:
            s_lower = s.lower().strip()
            if s_lower and len(s_lower) > 1:  # skip single chars
                tokens.append(s_lower)

    return tokens


def find_translation(term: str) -> Optional[str]:
    """
    Look up translation in universal vocabulary + domain vocabularies.
    Returns English translation or None.
    """
    term_lower = term.lower()

    # Check universal vocabulary
    if term_lower in UNIVERSAL_VOCABULARY:
        return UNIVERSAL_VOCABULARY[term_lower]

    # Check domain vocabularies
    for domain in DOMAIN_REGISTRY.values():
        if term_lower in domain.vocabulary:
            return domain.vocabulary[term_lower]
        for sub in domain.sub_domains:
            if term_lower in sub.vocabulary:
                return sub.vocabulary[term_lower]

    return None


def find_role_for_term(term: str) -> Optional[str]:
    """Infer business role from a vocabulary term."""
    term_lower = term.lower()

    # Revenue-related
    if term_lower in {'umsatz', 'revenue', 'sales', 'erlös', 'ertrag', 'einnahmen', 'income'}:
        return 'revenue'
    # Cost-related
    if term_lower in {'kosten', 'cost', 'aufwand', 'expense', 'ausgaben', 'herstellkosten'}:
        return 'cost'
    # Quantity
    if term_lower in {'menge', 'quantity', 'stück', 'anzahl', 'bestand'}:
        return 'quantity'
    # Rate
    if term_lower in {'rate', 'quote', 'prozent', 'anteil', 'percent'}:
        return 'rate'
    # Date
    if term_lower in {'datum', 'date', 'zeit', 'time', 'monat', 'jahr', 'quartal'}:
        return 'date'
    # ID
    if term_lower in {'id', 'nummer', 'number', 'code', 'key'}:
        return 'identifier'

    return None


def save_vocabulary_from_dataset(
    fingerprints: dict[str, dict],
    domain_id: Optional[str] = None,
):
    """
    Extract vocabulary tokens from all column names in a dataset.
    Saves new terms or increments frequency for existing ones.
    Silent — never raises, just logs warnings.
    """
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not supabase_key:
        return

    # Collect unique terms with context
    terms_to_save: dict[str, dict] = {}

    for qname, fp in fingerprints.items():
        col_name = qname.split('.')[-1]
        tokens = tokenize_column_name(col_name)
        role = fp.get('business_role_hint', None)

        # Also detect domain from column name
        col_domains = find_domain_by_column(col_name)
        col_domain = col_domains[0][0] if col_domains else domain_id

        for token in tokens:
            if token in terms_to_save:
                terms_to_save[token]['frequency'] += 1
                continue

            translation = find_translation(token)
            token_role = find_role_for_term(token) or role

            terms_to_save[token] = {
                'term': token,
                'language': 'de',
                'domain_id': col_domain,
                'business_role': token_role,
                'translation': translation,
                'frequency': 1,
            }

    if not terms_to_save:
        return

    # Upsert: insert new terms, increment frequency for existing
    try:
        with httpx.Client(timeout=15) as client:
            for term_data in terms_to_save.values():
                # Try insert, on conflict update frequency
                resp = client.post(
                    f"{supabase_url}/rest/v1/ml_vocabulary",
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                    json=term_data,
                )
                # If conflict (term exists), increment frequency via RPC or separate update
                if resp.status_code == 409:
                    client.patch(
                        f"{supabase_url}/rest/v1/ml_vocabulary?term=eq.{term_data['term']}&language=eq.{term_data['language']}",
                        headers={
                            "apikey": supabase_key,
                            "Authorization": f"Bearer {supabase_key}",
                            "Content-Type": "application/json",
                        },
                        json={"frequency": f"frequency + {term_data['frequency']}"},
                    )

        logger.info("Saved %d vocabulary terms (domain: %s)", len(terms_to_save), domain_id or 'unknown')

    except Exception as e:
        logger.warning("Vocabulary save error: %s", e)


def get_vocabulary_stats() -> dict:
    """Get vocabulary statistics for admin dashboard."""
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not supabase_key:
        return {"total_terms": 0, "domains": {}}

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"{supabase_url}/rest/v1/ml_vocabulary?select=term,domain_id,frequency",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                },
            )
            if resp.status_code == 200:
                rows = resp.json()
                domain_counts: dict[str, int] = {}
                for r in rows:
                    d = r.get('domain_id') or 'unknown'
                    domain_counts[d] = domain_counts.get(d, 0) + 1
                return {
                    "total_terms": len(rows),
                    "domains": domain_counts,
                    "top_frequency": sorted(rows, key=lambda x: x.get('frequency', 0), reverse=True)[:20],
                }
    except Exception:
        pass

    return {"total_terms": 0, "domains": {}}
