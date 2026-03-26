"""
DataLaser Domain Registry — Extensible taxonomy of business domains.

Not hardcoded — grows automatically from training data.
Initial seed covers German Mittelstand + major industries.
New domains discovered when Claude classifies unknown patterns.

Usage:
    from services.domain_registry import DOMAIN_REGISTRY, get_domain, find_domain_by_column

Architecture:
    - Each domain has: patterns, vocabulary, benchmarks, templates
    - Domains are hierarchical: tier1 → sub_domains
    - New domains added by ML pipeline when new patterns appear in 10+ datasets
    - Cross-cutting knowledge types shared across all domains
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SubDomain:
    id: str
    name_de: str
    name_en: str
    column_patterns: list[str] = field(default_factory=list)
    vocabulary: dict[str, str] = field(default_factory=dict)  # german → english


@dataclass
class Domain:
    id: str
    name_de: str
    name_en: str
    tier: int  # 1 = core, 2 = specialized, 3 = auto-discovered
    color: str
    icon: str  # emoji
    sub_domains: list[SubDomain] = field(default_factory=list)
    column_patterns: list[str] = field(default_factory=list)
    statistical_signatures: dict[str, str] = field(default_factory=dict)
    vocabulary: dict[str, str] = field(default_factory=dict)
    benchmark_sources: list[str] = field(default_factory=list)


# ─── SEED DOMAINS ─────────────────────────────────────────────────────────────

DOMAIN_REGISTRY: dict[str, Domain] = {

    # ── Tier 1: Core Domains ──────────────────────────────────────────────────

    "manufacturing": Domain(
        id="manufacturing",
        name_de="Produktion & Fertigung",
        name_en="Manufacturing",
        tier=1,
        color="#3b82f6",
        icon="🏭",
        sub_domains=[
            SubDomain("automotive", "Automobilindustrie", "Automotive",
                       ["fahrgestell", "fahrzeug", "vda", "vin", "modell"],
                       {"fahrgestell": "chassis", "fahrzeug": "vehicle"}),
            SubDomain("mechanical", "Maschinenbau", "Mechanical Engineering",
                       ["maschine", "werkzeug", "cnc", "drehmoment", "toleranz"],
                       {"werkzeug": "tool", "drehmoment": "torque"}),
            SubDomain("chemical", "Chemie & Pharma", "Chemical & Pharma",
                       ["reaktion", "batch", "konzentration", "reinheit", "wirkstoff", "charge"],
                       {"reinheit": "purity", "wirkstoff": "active ingredient", "charge": "batch"}),
            SubDomain("food", "Lebensmittel", "Food & Beverage",
                       ["haccp", "mindesthaltbarkeit", "charge", "temperatur", "hygiene"],
                       {"mindesthaltbarkeit": "shelf life"}),
            SubDomain("electronics", "Elektronik", "Electronics",
                       ["platine", "chip", "baugruppe", "lötung", "firmware"],
                       {"platine": "circuit board", "baugruppe": "assembly"}),
        ],
        column_patterns=[
            "defect", "ausschuss", "maschine", "batch", "lieferzeit",
            "produktion", "schicht", "werkstück", "qualität", "fertigung",
            "stueckzahl", "toleranz", "maschinentyp", "durchlaufzeit",
            "energieverbrauch", "ausbeute", "yield", "scrap",
        ],
        statistical_signatures={
            "has_defect_rate": "column with values 0-10% named *ausschuss*/*defect*",
            "has_batch_integers": "sequential integers in *charge*/*batch* column",
            "has_lead_time": "positive floats in *durchlaufzeit*/*lead_time*",
        },
        vocabulary={
            "ausschuss": "defect/scrap", "durchlaufzeit": "lead time",
            "schicht": "shift", "werkstück": "workpiece",
            "fertigung": "production", "anlage": "equipment",
            "instandhaltung": "maintenance", "rüstzeit": "setup time",
        },
        benchmark_sources=["VDMA", "VDA", "Destatis Produzierendes Gewerbe"],
    ),

    "commerce": Domain(
        id="commerce",
        name_de="Handel",
        name_en="Commerce",
        tier=1,
        color="#10b981",
        icon="🛒",
        sub_domains=[
            SubDomain("retail", "Einzelhandel", "Retail",
                       ["filiale", "kasse", "pos", "regal", "inventur"],
                       {"filiale": "store", "kasse": "checkout", "regal": "shelf"}),
            SubDomain("wholesale", "Großhandel", "Wholesale",
                       ["großhandel", "palette", "lagerbestand", "mindestbestellmenge"],
                       {"palette": "pallet", "lagerbestand": "stock"}),
            SubDomain("ecommerce", "E-Commerce", "E-Commerce",
                       ["warenkorb", "conversion", "checkout", "retoure", "versand"],
                       {"warenkorb": "shopping cart", "retoure": "return"}),
        ],
        column_patterns=[
            "order", "bestellung", "cart", "warenkorb", "sku", "product",
            "produkt", "shipping", "versand", "customer", "kunde",
            "retoure", "return", "conversion", "umsatz", "rabatt",
        ],
        vocabulary={
            "bestellung": "order", "umsatz": "revenue", "rabatt": "discount",
            "kunde": "customer", "versand": "shipping", "rechnung": "invoice",
            "gutschrift": "credit note", "lieferschein": "delivery note",
        },
        benchmark_sources=["HDE", "Destatis Handel", "EHI Retail Institute"],
    ),

    "finance": Domain(
        id="finance",
        name_de="Finanzen & Controlling",
        name_en="Finance & Controlling",
        tier=1,
        color="#f59e0b",
        icon="💰",
        sub_domains=[
            SubDomain("banking", "Bankwesen", "Banking",
                       ["konto", "buchung", "saldo", "zins", "kredit", "darlehen"],
                       {"konto": "account", "buchung": "transaction", "zins": "interest"}),
            SubDomain("insurance", "Versicherung", "Insurance",
                       ["police", "schadenfall", "prämie", "deckung", "versicherungsnehmer"],
                       {"schadenfall": "claim", "prämie": "premium"}),
            SubDomain("controlling", "Controlling", "Controlling",
                       ["kostenstelle", "kostenträger", "deckungsbeitrag", "plankosten", "istkosten"],
                       {"kostenstelle": "cost center", "deckungsbeitrag": "contribution margin"}),
            SubDomain("accounting", "Buchhaltung", "Accounting",
                       ["sachkonto", "buchungssatz", "bilanz", "guv", "abschreibung"],
                       {"sachkonto": "general ledger account", "bilanz": "balance sheet"}),
        ],
        column_patterns=[
            "portfolio", "asset", "liability", "loan", "kredit", "zins",
            "konto", "buchung", "saldo", "bilanz", "gewinn", "verlust",
            "kostenstelle", "deckungsbeitrag", "abschreibung",
        ],
        vocabulary={
            "gewinn": "profit", "verlust": "loss", "bilanz": "balance sheet",
            "abschreibung": "depreciation", "rückstellung": "provision",
            "eigenkapital": "equity", "fremdkapital": "debt",
            "liquidität": "liquidity", "cashflow": "cash flow",
        },
        benchmark_sources=["Bundesbank", "BaFin", "Destatis Finanzen"],
    ),

    "services": Domain(
        id="services",
        name_de="Dienstleistung",
        name_en="Services",
        tier=1,
        color="#8b5cf6",
        icon="💼",
        sub_domains=[
            SubDomain("consulting", "Beratung", "Consulting",
                       ["projekt", "stunden", "tagessatz", "mandate"],
                       {"tagessatz": "daily rate", "mandate": "engagement"}),
            SubDomain("saas", "Software/SaaS", "Software/SaaS",
                       ["mrr", "arr", "churn", "subscription", "user", "feature", "trial"],
                       {"mrr": "monthly recurring revenue", "arr": "annual recurring revenue"}),
            SubDomain("logistics", "Logistik", "Logistics",
                       ["sendung", "lieferung", "route", "lkw", "lager", "kommissionierung"],
                       {"sendung": "shipment", "kommissionierung": "order picking"}),
            SubDomain("healthcare", "Gesundheitswesen", "Healthcare",
                       ["patient", "diagnose", "drg", "verweildauer", "behandlung"],
                       {"verweildauer": "length of stay", "behandlung": "treatment"}),
        ],
        column_patterns=[
            "project", "client", "hours", "stunden", "engagement",
            "mrr", "churn", "subscription", "patient", "diagnose",
            "sendung", "lieferung", "route",
        ],
        vocabulary={
            "stunden": "hours", "auslastung": "utilization",
            "kundenzufriedenheit": "customer satisfaction",
        },
        benchmark_sources=["Destatis Dienstleistungen", "Bitkom"],
    ),

    # ── Tier 2: Specialized Domains ───────────────────────────────────────────

    "public_sector": Domain(
        id="public_sector",
        name_de="Öffentlicher Sektor",
        name_en="Public Sector",
        tier=2,
        color="#06b6d4",
        icon="🏛️",
        sub_domains=[
            SubDomain("government", "Verwaltung", "Government",
                       ["haushalt", "gemeinde", "bürger", "antrag", "bescheid"],
                       {"haushalt": "budget", "gemeinde": "municipality"}),
            SubDomain("education", "Bildung", "Education",
                       ["schüler", "studenten", "kurs", "prüfung", "note"],
                       {"prüfung": "exam", "note": "grade"}),
            SubDomain("utilities", "Stadtwerke", "Municipal Utilities",
                       ["verbrauch", "zähler", "tarif", "netz", "einspeisung"],
                       {"verbrauch": "consumption", "zähler": "meter"}),
        ],
        column_patterns=[
            "haushalt", "gemeinde", "bürger", "antrag", "verbrauch", "zähler",
        ],
        vocabulary={
            "haushalt": "budget", "bescheid": "official notice",
        },
        benchmark_sources=["Destatis", "KGSt"],
    ),

    "energy": Domain(
        id="energy",
        name_de="Energie & Versorgung",
        name_en="Energy & Utilities",
        tier=2,
        color="#ef4444",
        icon="⚡",
        column_patterns=[
            "kwh", "megawatt", "einspeisung", "netzlast", "solar", "wind",
            "stromnetz", "verbrauch", "lastgang", "erzeugung",
        ],
        vocabulary={
            "einspeisung": "feed-in", "netzlast": "grid load",
            "lastgang": "load profile", "erzeugung": "generation",
        },
        benchmark_sources=["Bundesnetzagentur", "BDEW"],
    ),

    "life_sciences": Domain(
        id="life_sciences",
        name_de="Life Sciences",
        name_en="Life Sciences",
        tier=2,
        color="#ec4899",
        icon="🧬",
        sub_domains=[
            SubDomain("pharma", "Pharma", "Pharma",
                       ["wirkstoff", "dosis", "studie", "phase", "zulassung", "nebenwirkung"],
                       {"wirkstoff": "active ingredient", "nebenwirkung": "side effect"}),
            SubDomain("chemical_research", "Chemische Forschung", "Chemical Research",
                       ["reaktion", "katalysator", "ausbeute", "konzentration", "mol"],
                       {"ausbeute": "yield", "katalysator": "catalyst"}),
        ],
        column_patterns=[
            "reaktion", "konzentration", "dosis", "wirkstoff", "mol",
            "ph", "temperatur", "reinheit", "ausbeute",
        ],
        vocabulary={
            "ausbeute": "yield", "reinheit": "purity",
            "versuchsreihe": "test series",
        },
        benchmark_sources=["EMA", "BfArM", "PubChem"],
    ),

    "agriculture": Domain(
        id="agriculture",
        name_de="Landwirtschaft",
        name_en="Agriculture",
        tier=2,
        color="#84cc16",
        icon="🌾",
        column_patterns=[
            "ernte", "ertrag", "fläche", "hektar", "vieh", "futter",
            "dünger", "boden", "niederschlag", "sorte",
        ],
        vocabulary={
            "ernte": "harvest", "ertrag": "yield", "fläche": "area",
            "dünger": "fertilizer", "niederschlag": "precipitation",
        },
        benchmark_sources=["Destatis Landwirtschaft", "BMEL"],
    ),
}


# ─── CROSS-CUTTING KNOWLEDGE ──────────────────────────────────────────────────

UNIVERSAL_VOCABULARY: dict[str, str] = {
    # Financial (universal across all domains)
    "umsatz": "revenue", "kosten": "cost", "gewinn": "profit",
    "verlust": "loss", "marge": "margin", "rabatt": "discount",
    "steuer": "tax", "mehrwertsteuer": "VAT", "netto": "net",
    "brutto": "gross", "betrag": "amount", "preis": "price",
    "rechnung": "invoice", "zahlung": "payment", "forderung": "receivable",
    "verbindlichkeit": "liability",

    # Time (universal)
    "datum": "date", "monat": "month", "quartal": "quarter",
    "jahr": "year", "woche": "week", "tag": "day",
    "zeitraum": "period", "stichtag": "reporting date",

    # Entity (universal)
    "kunde": "customer", "lieferant": "supplier", "mitarbeiter": "employee",
    "abteilung": "department", "standort": "location", "region": "region",
    "kategorie": "category", "status": "status", "typ": "type",
    "nummer": "number", "bezeichnung": "description", "name": "name",
}

# Column role → business category mapping (universal)
ROLE_TO_CATEGORY: dict[str, str] = {
    "revenue": "financial", "cost": "financial", "margin": "financial",
    "price": "financial", "amount": "financial",
    "quantity": "operational", "count": "operational",
    "rate": "quality", "defect_rate": "quality",
    "identifier": "entity", "category": "entity", "text": "entity",
    "date": "temporal",
}

# Business category → color (for visualization)
CATEGORY_COLORS: dict[str, str] = {
    "financial": "#10b981",
    "operational": "#3b82f6",
    "quality": "#ef4444",
    "entity": "#71717a",
    "temporal": "#f59e0b",
}


# ─── LOOKUP FUNCTIONS ─────────────────────────────────────────────────────────

def get_domain(domain_id: str) -> Optional[Domain]:
    """Get a domain by ID."""
    return DOMAIN_REGISTRY.get(domain_id)


def get_all_domains(tier: Optional[int] = None) -> list[Domain]:
    """Get all domains, optionally filtered by tier."""
    domains = list(DOMAIN_REGISTRY.values())
    if tier is not None:
        domains = [d for d in domains if d.tier == tier]
    return domains


def find_domain_by_column(col_name: str) -> list[tuple[str, float]]:
    """
    Find which domains a column name might belong to.
    Returns list of (domain_id, confidence) sorted by confidence desc.
    """
    name_lower = col_name.lower()
    scores: list[tuple[str, float]] = []

    for domain_id, domain in DOMAIN_REGISTRY.items():
        score = 0.0

        # Check domain-level patterns
        for pattern in domain.column_patterns:
            if pattern in name_lower:
                score += 1.0

        # Check domain vocabulary
        for german_term in domain.vocabulary:
            if german_term in name_lower:
                score += 0.8

        # Check sub-domain patterns
        for sub in domain.sub_domains:
            for pattern in sub.column_patterns:
                if pattern in name_lower:
                    score += 0.6

        if score > 0:
            scores.append((domain_id, score))

    scores.sort(key=lambda x: x[1], reverse=True)
    return scores


def translate_column_name(col_name: str) -> tuple[str, str]:
    """
    Translate a German column name to bilingual labels.
    Returns (label_de, label_en).
    """
    name_lower = col_name.lower().replace('_', ' ')

    # Check universal vocabulary first
    for german, english in UNIVERSAL_VOCABULARY.items():
        if german in name_lower:
            pretty_de = name_lower.replace(german, german).title()
            pretty_en = name_lower.replace(german, english).title()
            return pretty_de, pretty_en

    # Check domain vocabularies
    for domain in DOMAIN_REGISTRY.values():
        for german, english in domain.vocabulary.items():
            if german in name_lower:
                pretty_de = name_lower.replace(german, german).title()
                pretty_en = name_lower.replace(german, english).title()
                return pretty_de, pretty_en

    # Fallback: title case the original
    pretty = col_name.replace('_', ' ').title()
    return pretty, pretty


def get_importance_for_role(role: str) -> int:
    """Rule-based importance scoring. No ML needed."""
    IMPORTANCE = {
        "revenue": 5, "cost": 5, "margin": 5, "price": 4,
        "quantity": 4, "rate": 4, "defect_rate": 4,
        "count": 3, "amount": 3,
        "category": 3, "text": 2,
        "date": 2, "identifier": 1, "unknown": 1,
    }
    return IMPORTANCE.get(role, 2)
