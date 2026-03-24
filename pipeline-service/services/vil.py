"""
DataLaser VIL (Verified Intelligence Layer) -- Core intelligence engine.
Builds a semantic knowledge graph from raw data sources by combining
statistical fingerprinting, industry classification, KPI mapping,
and relationship detection. No AI/LLM calls -- pure computation.
"""
import pandas as pd
import numpy as np
import scipy.stats as stats
import sqlalchemy
import warnings
import re
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from services.auto_analyzer import auto_analyzer
from routers.auto_analysis import _quick_profile

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Component 1: Statistical Fingerprinting
# ---------------------------------------------------------------------------

class StatisticalFingerprint:
    """Compute statistical fingerprint for each column beyond basic profiling."""

    # Name patterns used by business-role inference
    _REVENUE_PATTERNS = re.compile(
        r"(revenue|umsatz|sales|einnahmen|erloese|erlös|turnover|income)", re.I
    )
    _COST_PATTERNS = re.compile(
        r"(cost|kosten|expense|aufwand|ausgaben|cogs|herstellkosten)", re.I
    )
    _QUANTITY_PATTERNS = re.compile(
        r"(quantity|menge|anzahl|stueck|stück|units|count|bestand|volume)", re.I
    )
    _MARGIN_PATTERNS = re.compile(
        r"(margin|marge|rohertrag|deckungsbeitrag|profit)", re.I
    )
    _RATE_PATTERNS = re.compile(
        r"(rate|quote|anteil|churn|conversion|yield|rendite|ratio)", re.I
    )
    _ID_PATTERNS = re.compile(r"(_id$|^id$|nummer|number|^pk$|^fk_)", re.I)
    _DATE_PATTERNS = re.compile(
        r"(date|datum|zeit|time|created|updated|timestamp|_at$|_on$)", re.I
    )
    _CATEGORY_PATTERNS = re.compile(
        r"(category|kategorie|type|typ|group|gruppe|segment|region|status|klasse|class)", re.I
    )

    def fingerprint_column(self, series: pd.Series, col_name: str) -> dict:
        """Return {distribution_shape, value_scale, temporal_pattern, business_role_hint}."""
        result = {
            "column": col_name,
            "distribution_shape": "unknown",
            "value_scale": "unknown",
            "temporal_pattern": None,
            "business_role_hint": "unknown",
        }

        if not pd.api.types.is_numeric_dtype(series):
            result["business_role_hint"] = self._infer_business_role(
                series, col_name, "categorical", "unknown"
            )
            return result

        clean = series.dropna()
        if len(clean) < 5:
            return result

        values = clean.values.astype(float)

        distribution = self._detect_distribution(values)
        scale = self._classify_scale(values, col_name)
        role = self._infer_business_role(series, col_name, scale, distribution)

        result["distribution_shape"] = distribution
        result["value_scale"] = scale
        result["business_role_hint"] = role

        return result

    # -- distribution detection ------------------------------------------------

    def _detect_distribution(self, values: np.ndarray) -> str:
        """Classify distribution: normal, skewed_right, skewed_left, bimodal,
        uniform, zero_heavy."""
        if len(values) < 8:
            return "unknown"

        zero_frac = np.mean(values == 0)
        if zero_frac > 0.4:
            return "zero_heavy"

        skewness = float(stats.skew(values))
        kurtosis_val = float(stats.kurtosis(values))

        # Normality check (D'Agostino-Pearson)
        try:
            _, p_normal = stats.normaltest(values)
            is_normal = p_normal > 0.05
        except Exception:
            is_normal = False

        if is_normal and abs(skewness) < 0.5:
            return "normal"

        # Bimodal heuristic: negative excess kurtosis and two clear peaks
        if kurtosis_val < -0.5:
            try:
                hist, _ = np.histogram(values, bins="auto")
                peaks = 0
                for i in range(1, len(hist) - 1):
                    if hist[i] > hist[i - 1] and hist[i] > hist[i + 1]:
                        peaks += 1
                if peaks >= 2:
                    return "bimodal"
            except Exception:
                pass

        # Uniform heuristic
        try:
            _, p_uniform = stats.kstest(
                values,
                "uniform",
                args=(values.min(), values.max() - values.min()),
            )
            if p_uniform > 0.05:
                return "uniform"
        except Exception:
            pass

        if skewness > 1.0:
            return "skewed_right"
        if skewness < -1.0:
            return "skewed_left"

        return "normal"

    # -- scale classification --------------------------------------------------

    def _classify_scale(self, values: np.ndarray, col_name: str) -> str:
        """Classify the value scale: percentage, currency, count, id, rate,
        score, or generic."""
        vmin, vmax = float(np.nanmin(values)), float(np.nanmax(values))
        median_val = float(np.nanmedian(values))
        nunique = len(np.unique(values))
        is_integer = np.allclose(values, np.round(values))
        skewness = float(stats.skew(values))

        name_lower = col_name.lower()

        # Explicit name hints
        if any(kw in name_lower for kw in ("percent", "prozent", "pct", "anteil", "%")):
            return "percentage"
        if any(kw in name_lower for kw in ("price", "preis", "eur", "usd", "betrag", "cost", "revenue", "umsatz")):
            return "currency"

        # ID: high cardinality, integer, roughly sequential
        if is_integer and nunique > 0.9 * len(values) and nunique > 100:
            return "id"

        # Percentage: bounded 0-100
        if 0 <= vmin and vmax <= 100 and (vmax - vmin) > 1:
            if any(kw in name_lower for kw in ("rate", "quote", "margin", "marge")):
                return "percentage"

        # Rate: bounded 0-1
        if 0 <= vmin and vmax <= 1 and (vmax - vmin) > 0.01:
            return "rate"

        # Score: bounded integers in small range
        if is_integer and vmin >= 0 and vmax <= 10:
            return "score"
        if is_integer and vmin >= 0 and vmax <= 100 and nunique <= 20:
            return "score"

        # Count: small positive integers
        if is_integer and vmin >= 0 and median_val < 10000:
            return "count"

        # Currency heuristic: large values, right-skewed
        if median_val > 100 and skewness > 0.5:
            return "currency"

        return "generic"

    # -- business role inference ------------------------------------------------

    def _infer_business_role(
        self, series: pd.Series, col_name: str, scale: str, distribution: str
    ) -> str:
        """Infer the business role: revenue, cost, quantity, margin, rate, count,
        identifier, category, date, text, or unknown."""
        name = col_name

        if self._ID_PATTERNS.search(name):
            return "identifier"
        if self._DATE_PATTERNS.search(name):
            return "date"
        if self._REVENUE_PATTERNS.search(name):
            return "revenue"
        if self._COST_PATTERNS.search(name):
            return "cost"
        if self._MARGIN_PATTERNS.search(name):
            return "margin"
        if self._RATE_PATTERNS.search(name):
            return "rate"
        if self._QUANTITY_PATTERNS.search(name):
            return "quantity"
        if self._CATEGORY_PATTERNS.search(name):
            return "category"

        # Fall back to scale
        if scale == "currency":
            return "revenue"
        if scale == "percentage":
            return "rate"
        if scale == "count":
            return "count"
        if scale == "id":
            return "identifier"
        if scale == "rate":
            return "rate"
        if scale == "categorical":
            nunique = series.nunique()
            if nunique <= 50:
                return "category"
            return "text"

        return "unknown"


# ---------------------------------------------------------------------------
# Component 2: Industry Classification
# ---------------------------------------------------------------------------

INDUSTRY_SIGNATURES: dict[str, dict] = {
    "manufacturing": {
        "column_patterns": [
            "defect", "ausschuss", "maschine", "batch", "lieferzeit",
            "produktion", "schicht", "werkstück", "qualitaet", "qualität",
            "fertigung", "stueckzahl", "toleranz", "maschinentyp",
        ],
        "stat_signals": ["has_defect_rate", "has_batch_integers", "has_lead_time"],
    },
    "saas": {
        "column_patterns": [
            "mrr", "arr", "churn", "subscription", "user", "feature",
            "trial", "onboarding", "monthly_recurring", "cac", "ltv",
        ],
        "stat_signals": ["has_recurring_revenue", "has_churn_rate"],
    },
    "ecommerce": {
        "column_patterns": [
            "order", "bestellung", "cart", "warenkorb", "sku", "product",
            "produkt", "shipping", "versand", "customer", "kunde",
            "retoure", "return", "conversion",
        ],
        "stat_signals": ["has_order_value", "has_return_rate"],
    },
    "retail": {
        "column_patterns": [
            "store", "filiale", "pos", "sku", "inventory", "bestand",
            "artikel", "regalmeter", "kassenumsatz", "footfall",
        ],
        "stat_signals": ["has_inventory", "has_store_dimension"],
    },
    "finance": {
        "column_patterns": [
            "portfolio", "asset", "liability", "equity", "loan", "kredit",
            "zins", "interest", "risk", "var", "bilanz", "soll", "haben",
        ],
        "stat_signals": ["has_balance_sheet", "has_interest_rate"],
    },
    "healthcare": {
        "column_patterns": [
            "patient", "diagnosis", "diagnose", "treatment", "therapie",
            "icd", "drg", "verweildauer", "readmission", "fallzahl",
        ],
        "stat_signals": ["has_patient_id", "has_diagnosis_code"],
    },
    "logistics": {
        "column_patterns": [
            "shipment", "sendung", "route", "delivery", "lieferung",
            "warehouse", "lager", "tracking", "carrier", "spediteur",
        ],
        "stat_signals": ["has_delivery_time", "has_route_data"],
    },
    "services": {
        "column_patterns": [
            "project", "projekt", "client", "mandant", "hours", "stunden",
            "billable", "consultant", "berater", "engagement", "auftrag",
        ],
        "stat_signals": ["has_billable_hours", "has_project_id"],
    },
}


def _check_stat_signal(signal: str, fingerprints: dict) -> bool:
    """Check whether a given stat signal is present in the fingerprint map."""
    fp_list = list(fingerprints.values())
    roles = [f.get("business_role_hint", "") for f in fp_list]
    scales = [f.get("value_scale", "") for f in fp_list]
    distributions = [f.get("distribution_shape", "") for f in fp_list]

    mapping = {
        "has_defect_rate": lambda: any(r == "rate" for r in roles) and any(d == "zero_heavy" for d in distributions),
        "has_batch_integers": lambda: any(s == "count" for s in scales),
        "has_lead_time": lambda: any(s == "count" for s in scales),
        "has_recurring_revenue": lambda: any(r == "revenue" for r in roles),
        "has_churn_rate": lambda: any(r == "rate" for r in roles),
        "has_order_value": lambda: any(s == "currency" for s in scales),
        "has_return_rate": lambda: any(r == "rate" for r in roles),
        "has_inventory": lambda: any(r == "quantity" for r in roles),
        "has_store_dimension": lambda: any(r == "category" for r in roles),
        "has_balance_sheet": lambda: any(r in ("revenue", "cost") for r in roles),
        "has_interest_rate": lambda: any(r == "rate" for r in roles),
        "has_patient_id": lambda: any(r == "identifier" for r in roles),
        "has_diagnosis_code": lambda: any(r == "category" for r in roles),
        "has_delivery_time": lambda: any(s == "count" for s in scales),
        "has_route_data": lambda: any(r == "category" for r in roles),
        "has_billable_hours": lambda: any(s == "count" for s in scales),
        "has_project_id": lambda: any(r == "identifier" for r in roles),
    }
    checker = mapping.get(signal)
    return checker() if checker else False


def classify_industry(
    columns: list[dict], col_fingerprints: dict
) -> tuple[str, float]:
    """Return (industry_type, confidence_score) based on column names and
    statistical fingerprints."""
    col_names_lower = [c["name"].lower() for c in columns]

    scores: dict[str, float] = {}
    for industry, sig in INDUSTRY_SIGNATURES.items():
        col_hits = sum(
            1
            for pattern in sig["column_patterns"]
            if any(pattern in cn for cn in col_names_lower)
        )
        stat_hits = sum(
            1
            for signal in sig["stat_signals"]
            if _check_stat_signal(signal, col_fingerprints)
        )

        max_col = max(len(sig["column_patterns"]), 1)
        max_stat = max(len(sig["stat_signals"]), 1)

        score = 0.65 * (col_hits / max_col) + 0.35 * (stat_hits / max_stat)
        scores[industry] = score

    if not scores:
        return ("unknown", 0.0)

    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    confidence = round(min(scores[best] * 1.5, 1.0), 3)

    if confidence < 0.1:
        return ("unknown", confidence)
    return (best, confidence)


# ---------------------------------------------------------------------------
# Component 3: KPI Formula Library
# ---------------------------------------------------------------------------

KPI_LIBRARY: list[dict] = [
    # ===== Financial KPIs (13) ================================================
    {
        "id": "gross_margin",
        "name_de": "Rohertragsmarge",
        "name_en": "Gross Margin",
        "formula": "(revenue - cost) / revenue * 100",
        "required_roles": ["revenue", "cost"],
        "industries": ["manufacturing", "ecommerce", "retail", "services"],
        "unit": "%",
        "description_de": "Anteil des Rohertrags am Umsatz",
        "description_en": "Percentage of revenue remaining after cost of goods",
    },
    {
        "id": "net_profit_margin",
        "name_de": "Nettogewinnmarge",
        "name_en": "Net Profit Margin",
        "formula": "(revenue - total_cost) / revenue * 100",
        "required_roles": ["revenue", "cost"],
        "industries": ["manufacturing", "ecommerce", "retail", "services", "saas", "finance"],
        "unit": "%",
        "description_de": "Nettomarge nach Abzug aller Kosten",
        "description_en": "Profit as a percentage of total revenue",
    },
    {
        "id": "revenue_growth",
        "name_de": "Umsatzwachstum",
        "name_en": "Revenue Growth",
        "formula": "(current_revenue - previous_revenue) / previous_revenue * 100",
        "required_roles": ["revenue", "date"],
        "industries": ["manufacturing", "ecommerce", "retail", "services", "saas", "finance"],
        "unit": "%",
        "description_de": "Umsatzwachstum gegenüber Vorperiode",
        "description_en": "Period-over-period revenue growth rate",
    },
    {
        "id": "cost_ratio",
        "name_de": "Kostenquote",
        "name_en": "Cost Ratio",
        "formula": "cost / revenue * 100",
        "required_roles": ["revenue", "cost"],
        "industries": ["manufacturing", "ecommerce", "retail", "services"],
        "unit": "%",
        "description_de": "Verhältnis der Kosten zum Umsatz",
        "description_en": "Total cost as percentage of revenue",
    },
    {
        "id": "ebitda_margin",
        "name_de": "EBITDA-Marge",
        "name_en": "EBITDA Margin",
        "formula": "ebitda / revenue * 100",
        "required_roles": ["revenue", "margin"],
        "industries": ["manufacturing", "services", "saas", "finance"],
        "unit": "%",
        "description_de": "EBITDA als Anteil am Umsatz",
        "description_en": "EBITDA as percentage of revenue",
    },
    {
        "id": "return_on_equity",
        "name_de": "Eigenkapitalrendite",
        "name_en": "Return on Equity (ROE)",
        "formula": "net_income / equity * 100",
        "required_roles": ["margin", "revenue"],
        "industries": ["finance", "manufacturing", "services"],
        "unit": "%",
        "description_de": "Rendite auf das eingesetzte Eigenkapital",
        "description_en": "Net income returned as a percentage of shareholders equity",
    },
    {
        "id": "return_on_assets",
        "name_de": "Gesamtkapitalrendite",
        "name_en": "Return on Assets (ROA)",
        "formula": "net_income / total_assets * 100",
        "required_roles": ["margin", "revenue"],
        "industries": ["finance", "manufacturing"],
        "unit": "%",
        "description_de": "Rendite auf das Gesamtvermögen",
        "description_en": "How efficiently assets generate profit",
    },
    {
        "id": "operating_margin",
        "name_de": "Operative Marge",
        "name_en": "Operating Margin",
        "formula": "operating_income / revenue * 100",
        "required_roles": ["revenue", "cost"],
        "industries": ["manufacturing", "services", "retail", "ecommerce"],
        "unit": "%",
        "description_de": "Betriebsergebnis im Verhältnis zum Umsatz",
        "description_en": "Operating income as a percentage of revenue",
    },
    {
        "id": "working_capital_ratio",
        "name_de": "Working-Capital-Quote",
        "name_en": "Working Capital Ratio",
        "formula": "current_assets / current_liabilities",
        "required_roles": ["revenue", "cost"],
        "industries": ["finance", "manufacturing", "retail"],
        "unit": "x",
        "description_de": "Verhältnis Umlaufvermögen zu kurzfristigen Verbindlichkeiten",
        "description_en": "Current assets divided by current liabilities",
    },
    {
        "id": "debt_to_equity",
        "name_de": "Verschuldungsgrad",
        "name_en": "Debt-to-Equity Ratio",
        "formula": "total_debt / equity",
        "required_roles": ["cost", "revenue"],
        "industries": ["finance", "manufacturing"],
        "unit": "x",
        "description_de": "Fremdkapital im Verhältnis zum Eigenkapital",
        "description_en": "Total debt divided by total equity",
    },
    {
        "id": "cash_flow_margin",
        "name_de": "Cashflow-Marge",
        "name_en": "Cash Flow Margin",
        "formula": "operating_cash_flow / revenue * 100",
        "required_roles": ["revenue"],
        "industries": ["manufacturing", "services", "saas"],
        "unit": "%",
        "description_de": "Operativer Cashflow als Anteil am Umsatz",
        "description_en": "Operating cash flow as percentage of revenue",
    },
    {
        "id": "contribution_margin",
        "name_de": "Deckungsbeitrag",
        "name_en": "Contribution Margin",
        "formula": "(revenue - variable_cost) / revenue * 100",
        "required_roles": ["revenue", "cost"],
        "industries": ["manufacturing", "retail", "ecommerce"],
        "unit": "%",
        "description_de": "Umsatz abzüglich variable Kosten als Anteil am Umsatz",
        "description_en": "Revenue minus variable costs as percentage of revenue",
    },
    {
        "id": "break_even_point",
        "name_de": "Break-Even-Punkt",
        "name_en": "Break-Even Point",
        "formula": "fixed_cost / ((revenue - variable_cost) / quantity)",
        "required_roles": ["revenue", "cost", "quantity"],
        "industries": ["manufacturing", "retail", "ecommerce"],
        "unit": "units",
        "description_de": "Absatzmenge bei der Kosten und Erlöse gleich sind",
        "description_en": "Unit volume at which total revenue equals total cost",
    },

    # ===== Operations KPIs (11) ===============================================
    {
        "id": "defect_rate",
        "name_de": "Ausschussquote",
        "name_en": "Defect Rate",
        "formula": "defective_units / total_units * 100",
        "required_roles": ["quantity"],
        "industries": ["manufacturing"],
        "unit": "%",
        "description_de": "Anteil fehlerhafter Einheiten an der Gesamtproduktion",
        "description_en": "Percentage of units that fail quality standards",
    },
    {
        "id": "oee",
        "name_de": "Gesamtanlageneffektivität",
        "name_en": "Overall Equipment Effectiveness (OEE)",
        "formula": "availability * performance * quality",
        "required_roles": ["rate"],
        "industries": ["manufacturing"],
        "unit": "%",
        "description_de": "Kombination aus Verfügbarkeit, Leistung und Qualität",
        "description_en": "Product of availability, performance, and quality rates",
    },
    {
        "id": "lead_time",
        "name_de": "Durchlaufzeit",
        "name_en": "Lead Time",
        "formula": "delivery_date - order_date",
        "required_roles": ["date"],
        "industries": ["manufacturing", "logistics", "ecommerce"],
        "unit": "days",
        "description_de": "Zeit von der Bestellung bis zur Lieferung",
        "description_en": "Time from order placement to delivery",
    },
    {
        "id": "on_time_delivery",
        "name_de": "Termingerechte Lieferung",
        "name_en": "On-Time Delivery Rate",
        "formula": "on_time_deliveries / total_deliveries * 100",
        "required_roles": ["quantity", "date"],
        "industries": ["manufacturing", "logistics", "ecommerce"],
        "unit": "%",
        "description_de": "Anteil pünktlich gelieferter Bestellungen",
        "description_en": "Percentage of deliveries made on or before promised date",
    },
    {
        "id": "inventory_turnover",
        "name_de": "Lagerumschlag",
        "name_en": "Inventory Turnover",
        "formula": "cogs / average_inventory",
        "required_roles": ["cost", "quantity"],
        "industries": ["manufacturing", "retail", "ecommerce"],
        "unit": "x",
        "description_de": "Wie oft der Lagerbestand pro Periode umgeschlagen wird",
        "description_en": "Number of times inventory is sold and replaced per period",
    },
    {
        "id": "cycle_time",
        "name_de": "Zykluszeit",
        "name_en": "Cycle Time",
        "formula": "total_production_time / units_produced",
        "required_roles": ["quantity"],
        "industries": ["manufacturing"],
        "unit": "min",
        "description_de": "Durchschnittliche Zeit pro Produktionseinheit",
        "description_en": "Average time to produce one unit",
    },
    {
        "id": "capacity_utilization",
        "name_de": "Kapazitätsauslastung",
        "name_en": "Capacity Utilization",
        "formula": "actual_output / max_output * 100",
        "required_roles": ["quantity"],
        "industries": ["manufacturing", "services"],
        "unit": "%",
        "description_de": "Tatsächliche Produktion im Verhältnis zur maximalen Kapazität",
        "description_en": "Actual output as percentage of maximum possible output",
    },
    {
        "id": "scrap_rate",
        "name_de": "Verschnittquote",
        "name_en": "Scrap Rate",
        "formula": "scrap_material / total_material * 100",
        "required_roles": ["quantity"],
        "industries": ["manufacturing"],
        "unit": "%",
        "description_de": "Anteil des verschwendeten Materials",
        "description_en": "Percentage of raw material wasted in production",
    },
    {
        "id": "order_fulfillment_rate",
        "name_de": "Auftragserfüllungsrate",
        "name_en": "Order Fulfillment Rate",
        "formula": "fulfilled_orders / total_orders * 100",
        "required_roles": ["quantity"],
        "industries": ["ecommerce", "retail", "logistics"],
        "unit": "%",
        "description_de": "Anteil vollständig erfüllter Bestellungen",
        "description_en": "Percentage of orders completely fulfilled",
    },
    {
        "id": "return_rate",
        "name_de": "Retourenquote",
        "name_en": "Return Rate",
        "formula": "returned_units / sold_units * 100",
        "required_roles": ["quantity"],
        "industries": ["ecommerce", "retail"],
        "unit": "%",
        "description_de": "Anteil der retournierten Einheiten an verkauften Einheiten",
        "description_en": "Percentage of sold items returned by customers",
    },
    {
        "id": "first_pass_yield",
        "name_de": "Erstdurchlaufquote",
        "name_en": "First Pass Yield",
        "formula": "good_units_first_pass / total_units * 100",
        "required_roles": ["quantity"],
        "industries": ["manufacturing"],
        "unit": "%",
        "description_de": "Anteil der Einheiten, die beim ersten Durchlauf fehlerfrei sind",
        "description_en": "Percentage of units passing quality check on first attempt",
    },

    # ===== Finance / Controlling KPIs (7) =====================================
    {
        "id": "budget_variance",
        "name_de": "Budgetabweichung",
        "name_en": "Budget Variance",
        "formula": "(actual - budget) / budget * 100",
        "required_roles": ["revenue", "cost"],
        "industries": ["manufacturing", "services", "finance", "retail"],
        "unit": "%",
        "description_de": "Abweichung der Ist-Kosten vom Budget",
        "description_en": "Difference between actual and budgeted amounts",
    },
    {
        "id": "dso",
        "name_de": "Debitorenlaufzeit",
        "name_en": "Days Sales Outstanding (DSO)",
        "formula": "accounts_receivable / revenue * days_in_period",
        "required_roles": ["revenue"],
        "industries": ["manufacturing", "services", "finance"],
        "unit": "days",
        "description_de": "Durchschnittliche Dauer bis zum Zahlungseingang",
        "description_en": "Average number of days to collect payment after a sale",
    },
    {
        "id": "dpo",
        "name_de": "Kreditorenlaufzeit",
        "name_en": "Days Payable Outstanding (DPO)",
        "formula": "accounts_payable / cogs * days_in_period",
        "required_roles": ["cost"],
        "industries": ["manufacturing", "retail", "finance"],
        "unit": "days",
        "description_de": "Durchschnittliche Dauer bis zur Bezahlung von Lieferanten",
        "description_en": "Average days to pay suppliers",
    },
    {
        "id": "cash_conversion_cycle",
        "name_de": "Cash-Conversion-Zyklus",
        "name_en": "Cash Conversion Cycle",
        "formula": "dso + dio - dpo",
        "required_roles": ["revenue", "cost"],
        "industries": ["manufacturing", "retail", "finance"],
        "unit": "days",
        "description_de": "Zeitspanne zwischen Bezahlung der Lieferanten und Zahlungseingang",
        "description_en": "Time between paying suppliers and receiving payment from customers",
    },
    {
        "id": "overhead_rate",
        "name_de": "Gemeinkostenzuschlag",
        "name_en": "Overhead Rate",
        "formula": "overhead_cost / direct_cost * 100",
        "required_roles": ["cost"],
        "industries": ["manufacturing", "services"],
        "unit": "%",
        "description_de": "Gemeinkosten im Verhältnis zu den Einzelkosten",
        "description_en": "Overhead cost as percentage of direct cost",
    },
    {
        "id": "material_cost_ratio",
        "name_de": "Materialkostenquote",
        "name_en": "Material Cost Ratio",
        "formula": "material_cost / revenue * 100",
        "required_roles": ["cost", "revenue"],
        "industries": ["manufacturing"],
        "unit": "%",
        "description_de": "Materialkosten als Anteil am Umsatz",
        "description_en": "Material cost as percentage of revenue",
    },
    {
        "id": "roi",
        "name_de": "Kapitalrendite",
        "name_en": "Return on Investment (ROI)",
        "formula": "(gain - investment) / investment * 100",
        "required_roles": ["revenue", "cost"],
        "industries": ["finance", "manufacturing", "services", "saas"],
        "unit": "%",
        "description_de": "Rendite auf die getätigte Investition",
        "description_en": "Net profit as a percentage of total investment",
    },

    # ===== HR KPIs (4) ========================================================
    {
        "id": "employee_turnover",
        "name_de": "Mitarbeiterfluktuation",
        "name_en": "Employee Turnover Rate",
        "formula": "departures / average_headcount * 100",
        "required_roles": ["count"],
        "industries": ["manufacturing", "services", "saas", "retail"],
        "unit": "%",
        "description_de": "Anteil der Mitarbeiter, die das Unternehmen verlassen",
        "description_en": "Percentage of employees leaving over a period",
    },
    {
        "id": "revenue_per_employee",
        "name_de": "Umsatz pro Mitarbeiter",
        "name_en": "Revenue per Employee",
        "formula": "total_revenue / headcount",
        "required_roles": ["revenue", "count"],
        "industries": ["manufacturing", "services", "saas"],
        "unit": "€",
        "description_de": "Umsatz geteilt durch die Anzahl der Mitarbeiter",
        "description_en": "Total revenue divided by number of employees",
    },
    {
        "id": "absenteeism_rate",
        "name_de": "Fehlzeitenquote",
        "name_en": "Absenteeism Rate",
        "formula": "absent_days / total_workdays * 100",
        "required_roles": ["count"],
        "industries": ["manufacturing", "services"],
        "unit": "%",
        "description_de": "Anteil der Fehltage an den Gesamtarbeitstagen",
        "description_en": "Percentage of workdays lost to employee absence",
    },
    {
        "id": "training_hours_per_employee",
        "name_de": "Weiterbildungsstunden pro Mitarbeiter",
        "name_en": "Training Hours per Employee",
        "formula": "total_training_hours / headcount",
        "required_roles": ["count"],
        "industries": ["manufacturing", "services"],
        "unit": "h",
        "description_de": "Durchschnittliche Weiterbildungszeit pro Mitarbeiter",
        "description_en": "Average hours of training per employee",
    },

    # ===== Sales & Marketing KPIs (6) ========================================
    {
        "id": "conversion_rate",
        "name_de": "Konversionsrate",
        "name_en": "Conversion Rate",
        "formula": "conversions / visitors * 100",
        "required_roles": ["count", "rate"],
        "industries": ["ecommerce", "saas", "retail"],
        "unit": "%",
        "description_de": "Anteil der Besucher, die eine gewünschte Aktion ausführen",
        "description_en": "Percentage of visitors who complete a desired action",
    },
    {
        "id": "average_order_value",
        "name_de": "Durchschnittlicher Bestellwert",
        "name_en": "Average Order Value (AOV)",
        "formula": "total_revenue / number_of_orders",
        "required_roles": ["revenue", "count"],
        "industries": ["ecommerce", "retail"],
        "unit": "€",
        "description_de": "Durchschnittlicher Umsatz pro Bestellung",
        "description_en": "Average revenue per order",
    },
    {
        "id": "customer_acquisition_cost",
        "name_de": "Kundenakquisitionskosten",
        "name_en": "Customer Acquisition Cost (CAC)",
        "formula": "marketing_spend / new_customers",
        "required_roles": ["cost", "count"],
        "industries": ["ecommerce", "saas", "retail"],
        "unit": "€",
        "description_de": "Kosten für die Gewinnung eines neuen Kunden",
        "description_en": "Total cost to acquire one new customer",
    },
    {
        "id": "customer_lifetime_value",
        "name_de": "Kundenlebenszeitwert",
        "name_en": "Customer Lifetime Value (CLV)",
        "formula": "average_revenue_per_customer * average_retention_period",
        "required_roles": ["revenue", "rate"],
        "industries": ["ecommerce", "saas", "retail", "services"],
        "unit": "€",
        "description_de": "Erwarteter Gesamtumsatz eines Kunden über seine Lebensdauer",
        "description_en": "Predicted total revenue from a customer over their relationship",
    },
    {
        "id": "cac_ltv_ratio",
        "name_de": "CAC/LTV-Verhältnis",
        "name_en": "CAC to LTV Ratio",
        "formula": "cac / ltv",
        "required_roles": ["cost", "revenue"],
        "industries": ["ecommerce", "saas"],
        "unit": "x",
        "description_de": "Verhältnis Akquisitionskosten zu Kundenlebenszeitwert",
        "description_en": "Ratio of acquisition cost to customer lifetime value",
    },
    {
        "id": "basket_size",
        "name_de": "Warenkorbgröße",
        "name_en": "Average Basket Size",
        "formula": "total_items / number_of_orders",
        "required_roles": ["quantity", "count"],
        "industries": ["ecommerce", "retail"],
        "unit": "items",
        "description_de": "Durchschnittliche Anzahl der Artikel pro Bestellung",
        "description_en": "Average number of items per transaction",
    },

    # ===== SaaS KPIs (5) =====================================================
    {
        "id": "mrr",
        "name_de": "Monatlich wiederkehrender Umsatz",
        "name_en": "Monthly Recurring Revenue (MRR)",
        "formula": "sum(monthly_subscription_revenue)",
        "required_roles": ["revenue"],
        "industries": ["saas"],
        "unit": "€",
        "description_de": "Summe aller monatlich wiederkehrenden Umsätze",
        "description_en": "Total predictable revenue per month from subscriptions",
    },
    {
        "id": "churn_rate",
        "name_de": "Abwanderungsrate",
        "name_en": "Churn Rate",
        "formula": "lost_customers / start_customers * 100",
        "required_roles": ["count", "rate"],
        "industries": ["saas"],
        "unit": "%",
        "description_de": "Anteil der Kunden, die im Zeitraum abgewandert sind",
        "description_en": "Percentage of customers lost during a period",
    },
    {
        "id": "net_revenue_retention",
        "name_de": "Nettoumsatzbindung",
        "name_en": "Net Revenue Retention (NRR)",
        "formula": "(start_mrr + expansion - contraction - churn) / start_mrr * 100",
        "required_roles": ["revenue"],
        "industries": ["saas"],
        "unit": "%",
        "description_de": "Umsatz von Bestandskunden nach Expansion und Abwanderung",
        "description_en": "Revenue retained from existing customers including upsells and churn",
    },
    {
        "id": "arpu",
        "name_de": "Durchschnittlicher Umsatz pro Nutzer",
        "name_en": "Average Revenue per User (ARPU)",
        "formula": "total_revenue / active_users",
        "required_roles": ["revenue", "count"],
        "industries": ["saas"],
        "unit": "€",
        "description_de": "Durchschnittlicher Umsatz pro aktivem Nutzer",
        "description_en": "Average revenue generated per active user",
    },
    {
        "id": "payback_period",
        "name_de": "Amortisationszeit",
        "name_en": "CAC Payback Period",
        "formula": "cac / (arpu * gross_margin_pct)",
        "required_roles": ["cost", "revenue"],
        "industries": ["saas"],
        "unit": "months",
        "description_de": "Monate bis die Kundenakquisitionskosten amortisiert sind",
        "description_en": "Months to recover customer acquisition cost",
    },
]


def map_kpis(
    columns: list[dict], fingerprints: dict, industry: str
) -> list[dict]:
    """Auto-map KPIs to detected columns. Returns mapped KPIs with actual
    column references."""
    # Build role -> column map
    role_to_columns: dict[str, list[str]] = {}
    for col_name, fp in fingerprints.items():
        role = fp.get("business_role_hint", "unknown")
        if role != "unknown":
            role_to_columns.setdefault(role, []).append(col_name)

    available_roles = set(role_to_columns.keys())
    mapped: list[dict] = []

    for kpi in KPI_LIBRARY:
        # Must match industry (or be universal)
        if industry != "unknown" and industry not in kpi["industries"]:
            continue

        required = set(kpi["required_roles"])
        if not required.issubset(available_roles):
            continue

        # Build column mapping
        column_mapping: dict[str, str] = {}
        for role in kpi["required_roles"]:
            column_mapping[role] = role_to_columns[role][0]

        mapped.append({
            **kpi,
            "column_mapping": column_mapping,
            "status": "auto_mapped",
        })

    return mapped


# ---------------------------------------------------------------------------
# Component 4: Relationship Detection
# ---------------------------------------------------------------------------

def detect_relationships(
    engine: sqlalchemy.Engine, schema_tables: list[dict]
) -> list[dict]:
    """Detect FK relationships between tables via column name matching and
    cardinality analysis."""
    relationships: list[dict] = []
    table_columns: dict[str, list[str]] = {}

    for tbl in schema_tables:
        table_name = tbl.get("table_name") or tbl.get("name", "")
        cols = tbl.get("columns", [])
        col_names = [c["name"] if isinstance(c, dict) else c for c in cols]
        table_columns[table_name] = col_names

    table_names = list(table_columns.keys())

    for i, t1 in enumerate(table_names):
        for t2 in table_names[i + 1 :]:
            cols1 = table_columns[t1]
            cols2 = table_columns[t2]

            # Find matching columns
            for c1 in cols1:
                c1_lower = c1.lower()
                for c2 in cols2:
                    c2_lower = c2.lower()
                    is_match = False
                    direction = None

                    # Exact name match
                    if c1_lower == c2_lower:
                        is_match = True
                    # t1 has FK referencing t2 PK (e.g., kunden_id -> kunden.id)
                    elif c1_lower == f"{t2.lower()}_id" or c1_lower == f"{t2.lower()}id":
                        is_match = True
                        direction = (t1, t2)
                    elif c2_lower == f"{t1.lower()}_id" or c2_lower == f"{t1.lower()}id":
                        is_match = True
                        direction = (t2, t1)
                    # Suffix match for _id columns
                    elif c1_lower.endswith("_id") and c1_lower == c2_lower:
                        is_match = True

                    if not is_match:
                        continue

                    # Determine cardinality via sampling
                    rel_type = "one_to_many"
                    try:
                        with engine.connect() as conn:
                            n1 = conn.execute(
                                sqlalchemy.text(
                                    f'SELECT COUNT(DISTINCT "{c1}") FROM "{t1}" LIMIT 1'
                                )
                            ).scalar()
                            n2 = conn.execute(
                                sqlalchemy.text(
                                    f'SELECT COUNT(DISTINCT "{c2}") FROM "{t2}" LIMIT 1'
                                )
                            ).scalar()
                            count1 = conn.execute(
                                sqlalchemy.text(
                                    f'SELECT COUNT(*) FROM "{t1}" LIMIT 1'
                                )
                            ).scalar()
                            count2 = conn.execute(
                                sqlalchemy.text(
                                    f'SELECT COUNT(*) FROM "{t2}" LIMIT 1'
                                )
                            ).scalar()

                        if n1 and n2 and count1 and count2:
                            ratio1 = n1 / count1 if count1 else 1
                            ratio2 = n2 / count2 if count2 else 1
                            if ratio1 > 0.9 and ratio2 > 0.9:
                                rel_type = "one_to_one"
                            elif ratio1 > 0.9 and ratio2 < 0.5:
                                rel_type = "many_to_one"
                                direction = direction or (t1, t2)
                            elif ratio1 < 0.5 and ratio2 > 0.9:
                                rel_type = "one_to_many"
                                direction = direction or (t2, t1)
                            else:
                                rel_type = "many_to_many"
                    except Exception:
                        pass

                    source = direction[0] if direction else t1
                    target = direction[1] if direction else t2
                    source_col = c1 if source == t1 else c2
                    target_col = c2 if source == t1 else c1

                    relationships.append({
                        "source_table": source,
                        "target_table": target,
                        "source_col": source_col,
                        "target_col": target_col,
                        "type": rel_type,
                        "label_de": f"{source} → {target} über {source_col}",
                        "label_en": f"{source} → {target} via {source_col}",
                        "strength": 0.9 if direction else 0.6,
                    })

    # Deduplicate by (source_table, target_table, source_col, target_col)
    seen: set[tuple] = set()
    unique: list[dict] = []
    for rel in relationships:
        key = (rel["source_table"], rel["target_table"], rel["source_col"], rel["target_col"])
        if key not in seen:
            seen.add(key)
            unique.append(rel)
    return unique


# ---------------------------------------------------------------------------
# Component 5: Company Learning (Corrections)
# ---------------------------------------------------------------------------

def apply_corrections(graph_data: dict, corrections: list[dict]) -> dict:
    """Apply user corrections to graph data. Corrections override
    auto-detected mappings, labels, and edges."""
    if not corrections:
        return graph_data

    for correction in corrections:
        action = correction.get("action")
        target_type = correction.get("target_type")  # node, edge, kpi
        target_id = correction.get("target_id")

        if action == "update_label":
            # Update node or edge labels
            collection = "nodes" if target_type == "node" else "edges"
            for item in graph_data.get(collection, []):
                item_id = item.get("id") or f'{item.get("source")}_{item.get("target")}'
                if item_id == target_id:
                    if "label_de" in correction:
                        item["label_de"] = correction["label_de"]
                    if "label_en" in correction:
                        item["label_en"] = correction["label_en"]
                    if "label" in correction:
                        item["label"] = correction["label"]
                    item["corrected"] = True
                    break

        elif action == "remove":
            collection = "nodes" if target_type == "node" else "edges"
            graph_data[collection] = [
                item
                for item in graph_data.get(collection, [])
                if (item.get("id") or f'{item.get("source")}_{item.get("target")}') != target_id
            ]

        elif action == "add_edge":
            edge = {
                "source": correction.get("source"),
                "target": correction.get("target"),
                "type": correction.get("edge_type", "manual"),
                "label_de": correction.get("label_de", "Manuelle Verknüpfung"),
                "label_en": correction.get("label_en", "Manual link"),
                "weight": correction.get("weight", 1.0),
                "color": correction.get("color", "#6366f1"),
                "corrected": True,
            }
            graph_data.setdefault("edges", []).append(edge)

        elif action == "remap_kpi":
            for kpi in graph_data.get("kpis", []):
                if kpi["id"] == target_id:
                    kpi["column_mapping"] = correction.get("column_mapping", kpi.get("column_mapping", {}))
                    kpi["status"] = "user_mapped"
                    break

        elif action == "set_industry":
            graph_data["industry"] = {
                "type": correction.get("industry"),
                "confidence": 1.0,
            }

    return graph_data


# ---------------------------------------------------------------------------
# Main VIL Engine
# ---------------------------------------------------------------------------

# Color palette for edges
_EDGE_COLORS = {
    "correlation_strong": "#ef4444",
    "correlation_moderate": "#f97316",
    "correlation_weak": "#fbbf24",
    "relationship": "#6366f1",
    "kpi_dependency": "#10b981",
}


class VILEngine:
    """Build a complete verified intelligence graph from a data source."""

    def __init__(self):
        self.fingerprinter = StatisticalFingerprint()

    def build(
        self,
        connection_string: str,
        schema_tables: list[dict],
        source_id: str,
        project_id: str,
        corrections: Optional[list[dict]] = None,
    ) -> dict:
        """Build the complete VIL graph.

        Returns: {
            nodes, edges, industry, kpis, metadata
        }
        """
        engine = sqlalchemy.create_engine(
            connection_string, connect_args={"connect_timeout": 15}
        )

        # Step 1 -- sample each table (max 5000 rows)
        table_dfs: dict[str, pd.DataFrame] = {}
        all_columns: list[dict] = []
        all_fingerprints: dict[str, dict] = {}

        for tbl in schema_tables:
            table_name = tbl.get("table_name") or tbl.get("name", "")
            if not table_name:
                continue
            try:
                with engine.connect() as conn:
                    row_count = conn.execute(
                        sqlalchemy.text(f'SELECT COUNT(*) FROM "{table_name}"')
                    ).scalar()

                if row_count and row_count > 5000:
                    df = pd.read_sql(
                        f'SELECT * FROM "{table_name}" ORDER BY RANDOM() LIMIT 5000',
                        engine,
                    )
                else:
                    df = pd.read_sql(
                        f'SELECT * FROM "{table_name}"', engine
                    )

                table_dfs[table_name] = df

                # Step 2 -- fingerprint columns
                profiles = _quick_profile(df)
                for prof in profiles:
                    col_name = prof["name"]
                    qualified = f"{table_name}.{col_name}"
                    fp = self.fingerprinter.fingerprint_column(
                        df[col_name], col_name
                    )
                    fp["table"] = table_name
                    fp["semantic_role"] = prof.get("semantic_role", "unknown")
                    all_fingerprints[qualified] = fp
                    all_columns.append({
                        "name": col_name,
                        "qualified_name": qualified,
                        "table": table_name,
                        **prof,
                    })
            except Exception as exc:
                logger.warning("Failed to sample table %s: %s", table_name, exc)
                continue

        # Step 3 -- classify industry
        industry_type, industry_confidence = classify_industry(
            all_columns, all_fingerprints
        )

        # Step 4 -- map KPIs
        kpis = map_kpis(all_columns, all_fingerprints, industry_type)

        # Step 5 -- detect relationships
        relationships = detect_relationships(engine, schema_tables)

        # Step 6 -- build nodes
        nodes = self._build_nodes(all_columns, all_fingerprints, kpis, table_dfs)

        # Step 7 -- build edges
        edges = self._build_edges(
            all_columns, all_fingerprints, kpis, relationships, table_dfs
        )

        graph = {
            "nodes": nodes,
            "edges": edges,
            "industry": {
                "type": industry_type,
                "confidence": industry_confidence,
            },
            "kpis": kpis,
            "metadata": {
                "node_count": len(nodes),
                "edge_count": len(edges),
                "table_count": len(table_dfs),
                "column_count": len(all_columns),
                "source_id": source_id,
                "project_id": project_id,
                "built_at": datetime.now(timezone.utc).isoformat(),
            },
        }

        # Step 8 -- apply corrections
        if corrections:
            graph = apply_corrections(graph, corrections)

        return graph

    # -- node construction -----------------------------------------------------

    def _build_nodes(
        self,
        columns: list[dict],
        fingerprints: dict,
        kpis: list[dict],
        table_dfs: dict[str, pd.DataFrame],
    ) -> list[dict]:
        nodes: list[dict] = []
        seen_ids: set[str] = set()

        for col in columns:
            qname = col["qualified_name"]
            fp = fingerprints.get(qname, {})
            role = fp.get("business_role_hint", col.get("semantic_role", "unknown"))
            table_name = col["table"]
            col_name = col["name"]

            # Only create nodes for metrics, dimensions, and dates
            if role in ("identifier", "text", "unknown"):
                continue

            node_id = qname
            if node_id in seen_ids:
                continue
            seen_ids.add(node_id)

            node_type = "metric" if col.get("dtype") == "numeric" else "dimension"
            if role == "date":
                node_type = "date"

            # Compute summary value for metrics
            value = None
            trend = None
            if node_type == "metric" and table_name in table_dfs:
                series = table_dfs[table_name][col_name].dropna()
                if len(series) > 0:
                    value = round(float(series.mean()), 2)
                    if len(series) > 10:
                        mid = len(series) // 2
                        first_half = series.iloc[:mid].mean()
                        second_half = series.iloc[mid:].mean()
                        if first_half != 0:
                            trend = round(
                                (second_half - first_half) / abs(first_half) * 100, 1
                            )

            nodes.append({
                "id": node_id,
                "type": node_type,
                "label": col_name,
                "label_de": col_name,
                "label_en": col_name,
                "value": value,
                "trend": trend,
                "metadata": {
                    "table": table_name,
                    "distribution": fp.get("distribution_shape"),
                    "scale": fp.get("value_scale"),
                    "business_role": role,
                },
            })

        # Add KPI nodes
        for kpi in kpis:
            node_id = f"kpi_{kpi['id']}"
            if node_id in seen_ids:
                continue
            seen_ids.add(node_id)

            nodes.append({
                "id": node_id,
                "type": "kpi",
                "label": kpi["name_en"],
                "label_de": kpi["name_de"],
                "label_en": kpi["name_en"],
                "value": None,
                "trend": None,
                "metadata": {
                    "formula": kpi["formula"],
                    "unit": kpi["unit"],
                    "status": kpi.get("status", "auto_mapped"),
                },
            })

        return nodes

    # -- edge construction -----------------------------------------------------

    def _build_edges(
        self,
        columns: list[dict],
        fingerprints: dict,
        kpis: list[dict],
        relationships: list[dict],
        table_dfs: dict[str, pd.DataFrame],
    ) -> list[dict]:
        edges: list[dict] = []

        # A) Correlation edges between metrics within same table
        measure_by_table: dict[str, list[str]] = {}
        for col in columns:
            if col.get("dtype") == "numeric":
                fp = fingerprints.get(col["qualified_name"], {})
                role = fp.get("business_role_hint", "")
                if role not in ("identifier",):
                    measure_by_table.setdefault(col["table"], []).append(col["name"])

        for table_name, measures in measure_by_table.items():
            if len(measures) < 2 or table_name not in table_dfs:
                continue
            df = table_dfs[table_name]
            valid = [m for m in measures if m in df.columns]
            if len(valid) < 2:
                continue

            try:
                corr_matrix = df[valid].corr(method="pearson")
                for i, c1 in enumerate(valid):
                    for c2 in valid[i + 1 :]:
                        r = corr_matrix.loc[c1, c2]
                        if pd.isna(r):
                            continue
                        abs_r = abs(r)
                        if abs_r < 0.3:
                            continue

                        if abs_r >= 0.7:
                            strength = "strong"
                        elif abs_r >= 0.5:
                            strength = "moderate"
                        else:
                            strength = "weak"

                        direction = "positiv" if r > 0 else "negativ"
                        direction_en = "positive" if r > 0 else "negative"

                        edges.append({
                            "source": f"{table_name}.{c1}",
                            "target": f"{table_name}.{c2}",
                            "type": "correlation",
                            "label_de": f"{strength} {direction} Korrelation ({r:.2f})",
                            "label_en": f"{strength} {direction_en} correlation ({r:.2f})",
                            "weight": round(abs_r, 3),
                            "color": _EDGE_COLORS.get(
                                f"correlation_{strength}", "#fbbf24"
                            ),
                        })
            except Exception:
                continue

        # B) Relationship edges between tables
        for rel in relationships:
            edges.append({
                "source": f"{rel['source_table']}.{rel['source_col']}",
                "target": f"{rel['target_table']}.{rel['target_col']}",
                "type": "relationship",
                "label_de": rel["label_de"],
                "label_en": rel["label_en"],
                "weight": rel.get("strength", 0.8),
                "color": _EDGE_COLORS["relationship"],
            })

        # C) KPI dependency edges
        for kpi in kpis:
            kpi_node_id = f"kpi_{kpi['id']}"
            for role, col_name in kpi.get("column_mapping", {}).items():
                # Find the qualified name for this column
                target_qname = None
                for col in columns:
                    if col["name"] == col_name:
                        target_qname = col["qualified_name"]
                        break
                if target_qname:
                    edges.append({
                        "source": kpi_node_id,
                        "target": target_qname,
                        "type": "kpi_dependency",
                        "label_de": f"Benötigt {role}",
                        "label_en": f"Requires {role}",
                        "weight": 1.0,
                        "color": _EDGE_COLORS["kpi_dependency"],
                    })

        return edges


# Module-level singleton
vil_engine = VILEngine()
