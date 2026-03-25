"""
DataLaser VIL (Verified Intelligence Layer) -- Core intelligence engine.
Builds a semantic knowledge graph from raw data sources by combining
statistical fingerprinting, industry classification, KPI mapping,
relationship detection, and optional AI-powered column classification.
"""
import pandas as pd
import numpy as np
import scipy.stats as stats
import sqlalchemy
import warnings
import re
import json
import os
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional

from services.auto_analyzer import auto_analyzer
from routers.auto_analysis import _quick_profile

CLAUDE_API_KEY = os.getenv("ANTHROPIC_API_KEY")

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
            "mapped": True,
            "columns": list(column_mapping.values()),
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

                    # Only match on ID-like columns (not generic names like 'status', 'datum')
                    # Exact name match on _id columns only
                    if c1_lower == c2_lower and (c1_lower.endswith('_id') or c1_lower == 'id'):
                        is_match = True
                    # t1 has FK referencing t2 PK (e.g., kunden_id -> kunden.id)
                    elif c1_lower == f"{t2.lower()}_id" or c1_lower == f"{t2.lower()}id":
                        is_match = True
                        direction = (t1, t2)
                    elif c2_lower == f"{t1.lower()}_id" or c2_lower == f"{t1.lower()}id":
                        is_match = True
                        direction = (t2, t1)

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
# AI-powered Column Classification (statistical metadata only)
# ---------------------------------------------------------------------------

def classify_columns_with_ai_sync(columns_metadata: list[dict]) -> dict | None:
    """Classify columns using Claude from statistical metadata only.

    Input per column: name, dtype, min, max, mean, std, unique_count, null_rate, distribution
    Returns: {columns: [{business_role, business_category, label_de, label_en, importance}],
              categories: [{id, label_de, label_en, color}]}
    """
    if not CLAUDE_API_KEY:
        return None  # Fallback to regex

    col_descriptions = []
    for c in columns_metadata:
        desc = f"- {c['name']} ({c.get('dtype', 'unknown')})"
        if c.get('min') is not None:
            desc += f" range: {c['min']}-{c['max']}, mean: {c.get('mean', '?')}, std: {c.get('std', '?')}"
        desc += f" unique: {c.get('unique_count', '?')}, nulls: {c.get('null_rate', 0) * 100:.1f}%"
        if c.get('distribution'):
            desc += f" distribution: {c['distribution']}"
        col_descriptions.append(desc)

    prompt = f"""You are a business data analyst. Classify each database column by its business meaning.
You receive ONLY statistical metadata (column name, data type, value ranges, distribution shape).
Do NOT request or expect actual data values.

Columns:
{chr(10).join(col_descriptions)}

Return a JSON object with:
1. "columns": array of objects, one per input column:
   - "name": exact column name as provided
   - "business_role": specific role (revenue, cost, quantity, defect_rate, customer_id, product_name, etc.)
   - "business_category": one of 5-6 categories you detect for THIS business
   - "label_de": business-friendly German label
   - "label_en": business-friendly English label
   - "importance": 1-5 (5=most important for business decisions)

2. "categories": array of 5-6 business categories detected, each with:
   - "id": short identifier
   - "label_de": German name
   - "label_en": English name
   - "color": hex color (use: #10b981 green, #3b82f6 blue, #ef4444 red, #f59e0b amber, #7c3aed purple, #71717a gray)

3. "industry": detected industry type
4. "industry_confidence": 0.0-1.0

Return ONLY valid JSON, no explanation."""

    try:
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 4000,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30.0,
        )
        data = resp.json()
        text = data["content"][0]["text"].strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        logger.warning("Claude classification failed: %s, falling back to regex", e)
        return None


# ---------------------------------------------------------------------------
# Default business categories (fallback when AI is unavailable)
# ---------------------------------------------------------------------------

DEFAULT_CATEGORIES = [
    {"id": "revenue", "label_de": "Umsatz", "label_en": "Revenue", "color": "#10b981"},
    {"id": "production", "label_de": "Produktion", "label_en": "Production", "color": "#3b82f6"},
    {"id": "quality", "label_de": "Qualität", "label_en": "Quality", "color": "#ef4444"},
    {"id": "logistics", "label_de": "Logistik", "label_en": "Logistics", "color": "#f59e0b"},
    {"id": "entity", "label_de": "Stammdaten", "label_en": "Master Data", "color": "#71717a"},
]


# ---------------------------------------------------------------------------
# Main VIL Engine
# ---------------------------------------------------------------------------

# Color palette for edges
_EDGE_COLORS = {
    "correlation_strong": "#ef4444",
    "correlation_moderate": "#f97316",
    "correlation_weak": "#fbbf24",
    "relationship": "#52525b",
    "hierarchy": "#333333",
    "kpi_dependency": "#7c3aed",
}

# Roles that should be excluded from metric nodes
_EXCLUDED_ROLES = {"identifier", "text", "unknown", "date", "category"}

# Business importance ordering for metric selection
_METRIC_PRIORITY = {
    "revenue": 0,
    "cost": 1,
    "margin": 2,
    "rate": 3,
    "quantity": 4,
    "count": 5,
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

        # Step 3b -- AI-powered column classification (statistical metadata only)
        ai_categories = None
        ai_result = None
        columns_metadata = []
        for qname, fp in all_fingerprints.items():
            columns_metadata.append({
                'name': qname.split('.')[-1],
                'table': qname.split('.')[0],
                'qualified_name': qname,
                'dtype': fp.get('dtype', 'unknown'),
                'min': fp.get('min_value'),
                'max': fp.get('max_value'),
                'mean': fp.get('mean_value'),
                'std': fp.get('std_value'),
                'unique_count': fp.get('unique_count', 0),
                'null_rate': fp.get('null_rate', 0),
                'distribution': fp.get('distribution_shape', ''),
            })

        ai_result = classify_columns_with_ai_sync(columns_metadata)
        if ai_result:
            for ai_col in ai_result.get('columns', []):
                # Find matching fingerprint and enrich it
                for qname, fp in all_fingerprints.items():
                    if qname.endswith(f".{ai_col['name']}"):
                        fp['business_role_hint'] = ai_col['business_role']
                        fp['business_category'] = ai_col['business_category']
                        fp['label_de'] = ai_col['label_de']
                        fp['label_en'] = ai_col['label_en']
                        fp['importance'] = ai_col['importance']

            # Store AI-detected categories for graph coloring
            ai_categories = ai_result.get('categories', [])
            ai_industry = ai_result.get('industry', industry_type)
            ai_confidence = ai_result.get('industry_confidence', industry_confidence)
            # Override industry if AI is more confident
            if ai_confidence > industry_confidence:
                industry_type = ai_industry
                industry_confidence = ai_confidence

        # Step 4 -- map KPIs
        kpis = map_kpis(all_columns, all_fingerprints, industry_type)

        # Step 5 -- detect relationships
        relationships = detect_relationships(engine, schema_tables)

        # Step 6 -- build table-centric nodes
        nodes = self._build_nodes(
            all_columns, all_fingerprints, kpis, table_dfs, engine, schema_tables
        )

        # Step 7 -- build edges
        edges = self._build_edges(
            all_columns, all_fingerprints, kpis, relationships, nodes
        )

        # Step 9 -- generate business narrative from aggregates only
        narrative = self._generate_narrative(
            industry_type, industry_confidence,
            nodes, edges, table_dfs
        )

        graph = {
            "nodes": nodes,
            "edges": edges,
            "industry": {
                "type": industry_type,
                "confidence": industry_confidence,
            },
            "kpis": kpis,
            "categories": ai_categories if ai_result else DEFAULT_CATEGORIES,
            "narrative_de": narrative.get("de", ""),
            "narrative_en": narrative.get("en", ""),
            "metadata": {
                "node_count": len(nodes),
                "edge_count": len(edges),
                "table_count": len(table_dfs),
                "column_count": len(all_columns),
                "source_id": source_id,
                "project_id": project_id,
                "built_at": datetime.now(timezone.utc).isoformat(),
                "ai_enriched": ai_result is not None,
            },
        }

        # Step 8 -- apply corrections
        if corrections:
            graph = apply_corrections(graph, corrections)

        return graph

    # -- helper methods --------------------------------------------------------

    def _classify_table_role(self, table_name: str, fingerprints: list) -> str:
        """Classify what business role this table plays."""
        name = table_name.lower()
        has_revenue = any(f.get("business_role_hint") == "revenue" for f in fingerprints)
        has_cost = any(f.get("business_role_hint") == "cost" for f in fingerprints)
        has_defect = any(
            f.get("business_role_hint") in ("defect_rate", "quality")
            for f in fingerprints
        )

        if "kunde" in name or "customer" in name:
            return "entity_table"
        if "produkt" in name or "product" in name:
            return "entity_table"
        if "produktion" in name or "production" in name:
            return "production_table"
        if "reklamation" in name or "complaint" in name:
            return "quality_table"
        if has_revenue and has_cost:
            return "transaction_table"
        if has_revenue:
            return "revenue_table"
        if has_defect:
            return "quality_table"
        return "data_table"

    def _compute_aggregate(self, df, col, scale):
        """Compute the right aggregate for a column based on its scale."""
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(series) == 0:
            return None
        if scale in ("currency", "count"):
            return round(float(series.sum()), 2)
        else:
            return round(float(series.mean()), 2)

    def _compute_trend(self, df, col):
        """Compute % change between first half and second half of data."""
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(series) <= 10:
            return None
        mid = len(series) // 2
        first_half = series.iloc[:mid].mean()
        second_half = series.iloc[mid:].mean()
        if first_half == 0:
            return None
        return round((second_half - first_half) / abs(first_half) * 100, 1)

    def _business_label(self, col_name, fingerprint):
        """Convert column name to business-friendly label."""
        label = col_name.replace("_", " ").title()
        return label

    def _compute_kpi_value(self, kpi: dict, table_dfs: dict) -> float | None:
        """Compute KPI value from actual data using VIL-detected column mappings."""
        try:
            col_mapping = kpi.get("column_mapping", {})
            if not col_mapping:
                return None

            # Resolve each role to its actual column sum
            role_values: dict[str, float] = {}
            for role, qualified_name in col_mapping.items():
                parts = qualified_name.split(".", 1)
                if len(parts) != 2:
                    continue
                table, col = parts
                if table not in table_dfs or col not in table_dfs[table].columns:
                    continue
                series = pd.to_numeric(table_dfs[table][col], errors="coerce").dropna()
                if len(series) == 0:
                    continue
                role_values[role] = float(series.sum())

            if not role_values:
                return None

            kpi_id = kpi["id"]
            unit = kpi.get("unit", "")

            # Margin formulas: (revenue - cost) / revenue * 100
            if "revenue" in role_values and "cost" in role_values:
                rev, cost = role_values["revenue"], role_values["cost"]
                if "margin" in kpi_id or "margin" in kpi.get("formula", ""):
                    return round((rev - cost) / rev * 100, 1) if rev else None
                if "ratio" in kpi_id:
                    return round(cost / rev * 100, 1) if rev else None
                if "contribution" in kpi_id:
                    return round(rev - cost, 2)
                if "revenue_growth" in kpi_id or "growth" in kpi_id:
                    return None  # Need time series, can't compute from sum

            # Rate formulas: numerator / denominator * 100
            if len(role_values) == 2:
                keys = list(role_values.keys())
                num, den = role_values[keys[0]], role_values[keys[1]]
                if unit == "%" and den != 0:
                    return round(num / den * 100, 1)

            # Single-value KPIs (totals, averages)
            if len(role_values) == 1:
                val = list(role_values.values())[0]
                if unit == "%":
                    return round(val, 1)
                return round(val, 2)

            return None
        except Exception:
            return None

    def _is_row_id(self, df, col_name):
        """Check if a column is just a sequential row ID."""
        series = pd.to_numeric(df[col_name], errors="coerce").dropna()
        if len(series) == 0:
            return False
        nunique = series.nunique()
        unique_rate = nunique / len(series) if len(series) > 0 else 0
        return unique_rate > 0.95

    # -- node construction -----------------------------------------------------

    def _build_nodes(
        self,
        columns: list[dict],
        fingerprints: dict,
        kpis: list[dict],
        table_dfs: dict[str, pd.DataFrame],
        engine: sqlalchemy.Engine,
        schema_tables: list[dict],
    ) -> list[dict]:
        nodes: list[dict] = []
        seen_ids: set[str] = set()

        # Group columns by table
        cols_by_table: dict[str, list[dict]] = {}
        for col in columns:
            cols_by_table.setdefault(col["table"], []).append(col)

        # Level 1 -- Table nodes
        for tbl in schema_tables:
            table_name = tbl.get("table_name") or tbl.get("name", "")
            if not table_name or table_name not in table_dfs:
                continue

            df = table_dfs[table_name]
            row_count = len(df)

            # Get actual row count from DB if possible
            try:
                with engine.connect() as conn:
                    actual_count = conn.execute(
                        sqlalchemy.text(f'SELECT COUNT(*) FROM "{table_name}"')
                    ).scalar()
                    if actual_count is not None:
                        row_count = int(actual_count)
            except Exception:
                pass

            table_cols = cols_by_table.get(table_name, [])
            table_fps = [
                fingerprints.get(c["qualified_name"], {}) for c in table_cols
            ]
            table_role = self._classify_table_role(table_name, table_fps)

            table_node_id = f"table:{table_name}"
            if table_node_id not in seen_ids:
                seen_ids.add(table_node_id)
                pretty = table_name.replace("_", " ").title()
                nodes.append({
                    "id": table_node_id,
                    "type": "table",
                    "label": pretty,
                    "label_de": pretty,
                    "label_en": pretty,
                    "value": row_count,
                    "trend": None,
                    "metadata": {
                        "role": table_role,
                        "columns": len(table_cols),
                        "table": table_name,
                    },
                })

            # Level 2 -- Key metric nodes (max 4 per table)
            # Filter to numeric, non-excluded columns
            metric_candidates = []
            for col in table_cols:
                qname = col["qualified_name"]
                fp = fingerprints.get(qname, {})
                role = fp.get("business_role_hint", col.get("semantic_role", "unknown"))
                scale = fp.get("value_scale", "generic")
                col_name = col["name"]

                # Skip excluded roles
                if role in _EXCLUDED_ROLES:
                    continue
                # Skip non-numeric columns
                if col.get("dtype") != "numeric":
                    continue
                # Skip all-null columns
                if col_name in df.columns and df[col_name].dropna().empty:
                    continue
                # Skip sequential row IDs (but not if VIL identified a business role)
                known_business_roles = {"revenue", "cost", "margin", "rate", "quantity", "price", "amount"}
                if role not in known_business_roles:
                    if col_name in df.columns and scale == "id":
                        continue
                    if col_name in df.columns and self._is_row_id(df, col_name):
                        continue

                priority = _METRIC_PRIORITY.get(role, 6)
                metric_candidates.append((priority, col_name, qname, fp, role, scale))

            # Sort by business importance, take top 4
            metric_candidates.sort(key=lambda x: x[0])
            top_metrics = metric_candidates[:4]

            for _prio, col_name, qname, fp, role, scale in top_metrics:
                node_id = f"{table_name}.{col_name}"
                if node_id in seen_ids:
                    continue
                seen_ids.add(node_id)

                agg_value = self._compute_aggregate(df, col_name, scale)
                trend = self._compute_trend(df, col_name)

                nodes.append({
                    "id": node_id,
                    "type": "metric",
                    "label": fp.get("label_de", self._business_label(col_name, fp)),
                    "label_en": fp.get("label_en", self._business_label(col_name, fp)),
                    "value": agg_value,
                    "trend": trend,
                    "parent": table_node_id,
                    "metadata": {
                        "table": table_name,
                        "column": col_name,
                        "business_role": role,
                        "business_category": fp.get("business_category", ""),
                        "scale": scale,
                        "distribution": fp.get("distribution_shape", "unknown"),
                        "importance": fp.get("importance"),
                    },
                })

            # Level 2b -- Key dimension nodes (max 2 per table)
            dim_candidates = [c for c in table_cols
                              if c.get('semantic_role') == 'dimension'
                              and c['name'] in df.columns]

            for dim_col in dim_candidates[:2]:
                col_name = dim_col['name']
                node_id = f"{table_name}.{col_name}"
                if node_id in seen_ids:
                    continue
                try:
                    with engine.connect() as conn:
                        top_vals = conn.execute(sqlalchemy.text(f'''
                            SELECT "{col_name}"::text, COUNT(*) as cnt
                            FROM "{table_name}" WHERE "{col_name}" IS NOT NULL
                            GROUP BY "{col_name}" ORDER BY cnt DESC LIMIT 5
                        ''')).fetchall()
                    unique_count = df[col_name].nunique()

                    fp = fingerprints.get(f"{table_name}.{col_name}", {})
                    category = fp.get('business_category', 'entity')

                    seen_ids.add(node_id)
                    nodes.append({
                        'id': node_id,
                        'type': 'dimension',
                        'label': fp.get('label_de', col_name.replace('_', ' ').title()),
                        'label_en': fp.get('label_en', col_name.replace('_', ' ').title()),
                        'value': f'{unique_count} values',
                        'parent': table_node_id,
                        'metadata': {
                            'table': table_name,
                            'column': col_name,
                            'unique_count': unique_count,
                            'top_values': [{'value': str(r[0]), 'count': int(r[1])} for r in top_vals],
                            'business_category': category,
                        },
                    })
                except Exception:
                    pass

        # Level 3 -- KPI nodes (only mapped ones with computed values)
        for kpi in kpis:
            if not kpi.get("mapped"):
                continue
            # Try to compute KPI value from available data
            kpi_value = self._compute_kpi_value(kpi, table_dfs)
            if kpi_value is None:
                continue  # Skip KPIs we can't compute

            node_id = f"kpi:{kpi['id']}"
            if node_id in seen_ids:
                continue
            seen_ids.add(node_id)

            nodes.append({
                "id": node_id,
                "type": "kpi",
                "label": kpi["name_de"],
                "label_en": kpi["name_en"],
                "value": kpi_value,
                "metadata": {
                    "formula": kpi["formula"],
                    "unit": kpi["unit"],
                },
            })

        return nodes

    # -- narrative generation --------------------------------------------------

    def _generate_narrative(self, industry, confidence, nodes, edges, table_dfs):
        """Generate 3-sentence executive summary from aggregated metrics only."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return {"de": "", "en": ""}

        # Build summary from nodes (only aggregated values, never raw data)
        metric_summary = []
        for n in nodes:
            if n['type'] == 'metric' and n.get('value') is not None:
                metric_summary.append(f"{n['label']}: {n['value']}")

        table_summary = []
        for n in nodes:
            if n['type'] == 'table':
                table_summary.append(f"{n['label']} ({n['value']} rows)")

        # Also compute key ratios for the narrative
        ratio_hints = []
        metric_map = {n['label'].lower(): n.get('value', 0) for n in nodes if n['type'] == 'metric' and n.get('value')}
        for n in nodes:
            if n['type'] == 'table' and 'reklamation' in n['label'].lower():
                orders_table = next((t for t in nodes if t['type'] == 'table' and 'bestell' in t['label'].lower()), None)
                if orders_table and orders_table.get('value'):
                    rate = round(n['value'] / orders_table['value'] * 100, 1)
                    ratio_hints.append(f"Complaint rate: {rate}% ({n['value']} complaints / {orders_table['value']} orders)")

        prompt = f"""You are the Head of Controlling at a German Mittelstand company writing a brief for the CEO.
Industry: {industry} ({confidence * 100:.0f}% confidence)
Data overview:
  Tables: {', '.join(table_summary)}
  Key metrics (aggregated from live database): {', '.join(metric_summary[:10])}
  Table relationships: {len([e for e in edges if e['type'] == 'relationship'])} connections
  {'Computed ratios: ' + ', '.join(ratio_hints) if ratio_hints else ''}

Write EXACTLY 3 sentences. Rules:
- Sentence 1: What this business does, with key volume numbers (orders, customers, revenue)
- Sentence 2: The MOST CRITICAL finding that needs CEO attention. Name the specific entity (product, region, machine, customer) causing the issue. Include a EUR or % number.
- Sentence 3: The biggest opportunity with a specific EUR estimate.

Be concrete. Not "revenue is concentrated" but "Mueller GmbH und Schmidt AG machen 45% des Umsatzes aus, Klumpenrisiko €5,6M."
Not "defect rate is high" but "Maschine M-300 verursacht 67% aller Ausschussteile, Kosten ca. €23.400/Monat."

Return JSON: {{"de": "3 sentences in German", "en": "3 sentences in English"}}
Return ONLY valid JSON."""

        try:
            resp = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 1000,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30.0,
            )
            text = resp.json()["content"][0]["text"].strip()
            if text.startswith("```"):
                text = text.split("```")[1].lstrip("json\n")
            return json.loads(text)
        except Exception as e:
            logger.warning("Narrative generation failed: %s", e)
            return {"de": "", "en": ""}

    # -- edge construction -----------------------------------------------------

    def _build_edges(
        self,
        columns: list[dict],
        fingerprints: dict,
        kpis: list[dict],
        relationships: list[dict],
        nodes: list[dict],
    ) -> list[dict]:
        edges: list[dict] = []

        # Build a set of existing node IDs for validation
        node_ids = {n["id"] for n in nodes}

        # A) Table-to-table relationship edges (from FK detection, deduplicated)
        seen_edges: set[str] = set()
        for rel in relationships:
            source_id = f"table:{rel['source_table']}"
            target_id = f"table:{rel['target_table']}"
            # Deduplicate: only one edge per table pair (use sorted key)
            edge_key = tuple(sorted([source_id, target_id]))
            if edge_key in seen_edges:
                continue
            seen_edges.add(edge_key)
            if source_id in node_ids and target_id in node_ids:
                edges.append({
                    "source": source_id,
                    "target": target_id,
                    "type": "relationship",
                    "label": rel["label_en"],
                    "label_de": rel["label_de"],
                    "label_en": rel["label_en"],
                    "weight": rel.get("strength", 0.5),
                    "color": _EDGE_COLORS["relationship"],
                })

        # B) Metric/dimension-to-table hierarchy edges
        for node in nodes:
            if node["type"] in ("metric", "dimension") and node.get("parent"):
                edges.append({
                    "source": node["id"],
                    "target": node["parent"],
                    "type": "hierarchy",
                    "weight": 0.3,
                    "color": _EDGE_COLORS["hierarchy"],
                })

        # C) KPI dependency edges (KPI -> source metrics)
        for kpi in kpis:
            kpi_node_id = f"kpi:{kpi['id']}"
            if kpi_node_id not in node_ids:
                continue
            for role, col_name in kpi.get("column_mapping", {}).items():
                # Find the qualified name for this column and check it
                # exists as a metric node
                for col in columns:
                    if col["name"] == col_name:
                        target_id = f"{col['table']}.{col_name}"
                        if target_id in node_ids:
                            edges.append({
                                "source": kpi_node_id,
                                "target": target_id,
                                "type": "kpi_dependency",
                                "weight": 0.3,
                                "color": _EDGE_COLORS["kpi_dependency"],
                            })
                        break

        return edges


# Module-level singleton
vil_engine = VILEngine()
