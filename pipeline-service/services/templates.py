"""
DataLaser TemplateEngine -- 31 industry-vertical analysis templates.
Pure computation, no AI/LLM calls. Bilingual English/German column detection.
"""
import re
import pandas as pd
import numpy as np
import scipy.stats as stats
from typing import Optional

from services.analyst import analyst as stat_analyst
from services.auto_analyzer import auto_analyzer
from models.schemas import TemplateMatch, TemplateResult


# -- Bilingual column name patterns (always-on) -------------------------------

PATTERNS = {
    # -- Finance / BWA (DATEV standard) --
    'revenue':    r'(?i)(revenue|umsatz|(?<!_)sales(?!_tax)|verkauf|ertrag|einnahm|turnover|erloes|gesamtleistung|nettoumsatz|bruttoumsatz|absatz_wert|omzet|total.?income)',
    'cost':       r'(?i)(cost|kosten|expense|ausgabe|aufwand|spend|wareneinsatz|materialaufwand|herstellkosten|betriebsaufwand|sachkosten|fremdleistung|gemeinkosten)',
    'profit':     r'(?i)(profit|gewinn|margin|marge|earning|rohertrag|betriebsergebnis|ebit|ebitda|deckungsbeitrag|db[_\s]|ergebnis_vor|jahresueberschuss|rohmarge)',
    'personnel':  r'(?i)(personal|gehalt|lohn|salary|wage|personalkosten|personalaufwand|bruttolohn|arbeitgeber.?anteil|sozialversicherung|lohnnebenkosten|fte|headcount|mitarbeiterkosten)',
    'budget':     r'(?i)(budget|plan|soll|ziel|target|planned|planwert|forecast|erwartung|vorgabe)',
    'actual':     r'(?i)(actual|ist|realisiert|achieved|ergebnis|real|ist.?wert|ist.?betrag)',

    # -- Pricing / Commerce --
    'price':      r'(?i)(price|preis|tarif|gebuehr|rate|fee|vk.?preis|ek.?preis|listenpreis|nettopreis|bruttopreis|einzelpreis|stueckpreis|warenkorbwert|aov|average.?order)',
    'quantity':   r'(?i)(quantity|menge|stueck|anzahl|units|volume|absatz|output|produktion|bestellmenge|liefermenge|auftragsmenge|stueckzahl|losgroe)',
    'discount':   r'(?i)(discount|rabatt|skonto|nachlass|preisnachlass|abzug)',

    # -- Customers / Accounts --
    'customer':   r'(?i)(customer|kunde|klient|konto|client|account|kaeufer|debitor|auftraggeber|besteller|endkunde|kundennr|kd.?nr|customer.?id|account.?name)',
    'product':    r'(?i)(product|produkt|artikel|ware|item|sku|material|materialnr|artikelnr|erzeugnis|bauteil|komponente|warengruppe|produktgruppe|sortiment)',

    # -- HR / Personalcontrolling --
    'employee':   r'(?i)(employee|mitarbeiter|angestellte|personal|staff|worker|team|abteilung|department|kostenstelle|personalnr|ma.?nr|vorname|nachname|dienstalter|betriebszugehoerigkeit)',
    'attrition':  r'(?i)(attrition|turnover|quit|left|kuendigung|churn|fluktuation|austritt|abgang|kuendigungsgrund|vertragsende)',
    'sick_leave': r'(?i)(sick|krank|krankenquote|krankentage|fehlzeit|abwesenheit|au.?tage|arbeitsunfaehig)',

    # -- Geography / Regions --
    'region':     r'(?i)(region|stadt|land|standort|plz|city|country|zip|bundesland|location|filiale|werk|niederlassung|postleitzahl|ort|gemeinde|kreis|bezirk|gebiet|vertriebsgebiet)',

    # -- Manufacturing / Production --
    'defect':     r'(?i)(defect|ausschuss|fehler|mangel|reklamation|scrap|reject|quality|ausschussquote|fehlerquote|nacharbeit|rueckweisung|qualitaetsmangel|nok|nio|nicht.?in.?ordnung|ppb|ppm)',
    'machine':    r'(?i)(machine|maschine|anlage|linie|station|equipment|line|arbeitsplatz|fertigungslinie|werkzeug|schicht|shift|oee|verfuegbarkeit|stillstand|ruestzeit)',
    'batch':      r'(?i)(batch|charge|lot|los|partie|fertigungsauftrag|produktionsauftrag|auftragsnr|seriennr|chargennr)',
    'measurement':r'(?i)(measurement|messwert|temp|temperatur|pressure|druck|weight|gewicht|thickness|dicke|sensor|reading|pruefwert|sollwert|toleranz|abweichung|cpk|cp_|messung)',

    # -- Logistics / Supply Chain --
    'supplier':   r'(?i)(supplier|lieferant|zulieferer|vendor|kreditor|bezugsquelle|hersteller|einkaufsquelle)',
    'delivery':   r'(?i)(delivery|lieferung|versand|sendung|shipment|dispatch|wareneingang|warenausgang|lieferschein|lieferdatum|versanddatum|zustellung)',
    'lead_time':  r'(?i)(lead.?time|cycle.?time|durchlaufzeit|zykluszeit|lieferzeit|dauer|wiederbeschaffungszeit|bearbeitungszeit|wartezeit|transportzeit)',
    'stock':      r'(?i)(stock|bestand|lager|inventory|lagerbestand|sicherheitsbestand|meldebestand|mindestbestand|reichweite|bestandsreichweite|lagerumschlag|lagerwert|vorratsvermoegen)',
    'shipping':   r'(?i)(shipping|freight|fracht|versandkosten|transport|logistikkosten|spedition|spediteur|frachtkosten|transportkosten|carrier|route|ziel|empfaenger)',
    'ontime':     r'(?i)(on.?time|liefertreue|termintreuequote|puenktlich|otif|lieferperformance|lieferquote)',
    'stockout':   r'(?i)(stockout|fehlmenge|fehlmengenquote|out.?of.?stock|nicht.?lieferbar|rueckstand)',

    # -- Energy / Sustainability --
    'energy':     r'(?i)(energy|energie|strom|kwh|kw.?h|gas|wasser|verbrauch|consumption|co2|emission|energiekosten|stromverbrauch|gasverbrauch|nachhaltigkeit|energieeffizienz)',

    # -- E-Commerce / Marketing --
    'campaign':   r'(?i)(campaign|channel|source|medium|ad_|kanal|kampagne|werbemittel|anzeige|touchpoint|utm_)',
    'conversion': r'(?i)(conversion|click|impression|ctr|roi|spend|budget|konversion|warenkorb|checkout|bounce|sitzung|session|besucher|visitor|page.?view|werbekosten|cpc|cpa|cac|clv|ltv|kundenakquise)',
    'return_rate':r'(?i)(retour|retoure|retourenquote|return.?rate|ruecksendung|umtausch|rueckgabe.?quote)',

    # -- Clinical / Healthcare --
    'treatment':  r'(?i)(treatment|group|arm|placebo|control|intervention|therapie|behandlung|medikament|dosis|dosierung|wirkstoff|studienarm)',
    'outcome':    r'(?i)(outcome|response|efficacy|endpoint|ergebnis|befund|diagnose|icd|laborwert|messergebnis|heilungsrate|mortalitaet|ueberlebenszeit|nebenwirkung)',
    'patient':    r'(?i)(patient|proband|teilnehmer|subject|fall|fallnr|patientennr|geschlecht|alter|bmi|blutdruck|puls)',

    # -- Returns / Warranty (manufacturing) --
    'return':     r'(?i)(return|rueckgabe|reklamation|warranty|garantie|claim|gewaehrleistung|beanstandung|rueckruf|garantiefall|schadensmeldung)',

    # -- A/B Testing --
    'variant':    r'(?i)(variant|version|test.?group|control.?group|ab_|variante|testgruppe|kontrollgruppe|experiment)',

    # -- DATEV / German Accounting (BWA) --
    'bwa':        r'(?i)(gesamtleistung|umsatzerloese|wareneinsatz|rohertrag|personalaufwand|raumkosten|abschreibung|betriebsergebnis|zinsaufwand|steuern|jahresueberschuss|vorlaeufiges.?ergebnis|materialaufwand|sonstige.?erloese)',
    'deckungsbeitrag': r'(?i)(deckungsbeitrag|db[_\s]?[1-4]|fixkosten|variable.?kosten|grenzkosten)',
    'liquiditaet': r'(?i)(liquiditaet|zahlungseingang|zahlungsausgang|kasse|bankbestand|forderung|verbindlichkeit|cashflow|cash.?flow|mittelzufluss|mittelabfluss)',

    # -- US Accounting (QuickBooks / GAAP) --
    'quickbooks': r'(?i)(gross.?profit|net.?income|cogs|cost.?of.?goods|operating.?expense|other.?income|other.?expense|total.?income|total.?expense|net.?operating|payroll|accounts.?receivable|accounts.?payable)',
    'us_tax':     r'(?i)(taxable.?income|tax.?bracket|federal.?tax|state.?tax|deduction|exemption|filing.?status|w2|1099|adjusted.?gross)',
    'us_state':   r'(?i)(state|zip.?code|nexus|jurisdiction|sales.?tax|use.?tax)',

    # -- UK Accounting (HMRC / FRS) --
    'uk_vat':     r'(?i)(vat|value.?added|standard.?rate|reduced.?rate|zero.?rated|exempt|vat.?return|output.?tax|input.?tax)',
    'uk_tax':     r'(?i)(corporation.?tax|paye|national.?insurance|ni.?contribution|dividend|company.?house|statutory|turnover|gross.?profit|directors)',
}


def _match(col_name: str, concept: str) -> bool:
    return bool(re.search(PATTERNS.get(concept, ''), col_name))


def _find_col(profiles: list[dict], concept: str, role: str = None) -> Optional[str]:
    """Find best column matching a concept pattern + optional semantic role."""
    for p in profiles:
        name_match = _match(p['name'], concept)
        role_match = (role is None) or (p.get('semantic_role') == role)
        if name_match and role_match:
            return p['name']
    # Fallback: role only
    if role:
        for p in profiles:
            if p.get('semantic_role') == role:
                return p['name']
    return None


def _cols_by_role(profiles: list[dict], role: str) -> list[str]:
    return [p['name'] for p in profiles if p.get('semantic_role') == role]


def _fmt(val, decimals=2):
    """Format a number for findings strings."""
    if val is None:
        return 'N/A'
    if isinstance(val, float):
        if abs(val) >= 1000:
            return f"{val:,.{decimals}f}"
        return f"{round(val, decimals)}"
    return str(val)


def _finding(key: str, args: dict, text: str) -> dict:
    """Create a structured finding with i18n key, args, and English text."""
    return {'key': key, 'args': {k: str(v) for k, v in args.items()}, 'text': text}


# -- Template definitions ------------------------------------------------------

TEMPLATES = [
    # Priority 1: Universal
    {'id': 'T01', 'name': 'Data Quality Scorecard', 'category': 'universal', 'priority': 1,
     'description': 'Comprehensive data quality assessment with completeness, consistency, and uniqueness scores.',
     'requires': {'min_columns': 3}},
    {'id': 'T02', 'name': 'Correlation Explorer', 'category': 'universal', 'priority': 1,
     'description': 'Discovers strongest linear relationships between numeric variables with significance testing.',
     'requires': {'measures': 2}},
    {'id': 'T03', 'name': 'Distribution Profiler', 'category': 'universal', 'priority': 1,
     'description': 'Classifies distribution shape of every numeric column and flags non-normality.',
     'requires': {'measures': 1}},
    {'id': 'T04', 'name': 'Outlier Detection Report', 'category': 'universal', 'priority': 1,
     'description': 'Identifies statistical outliers across all numeric columns with severity ranking.',
     'requires': {'measures': 1}},
    {'id': 'T05', 'name': 'Segment Comparison', 'category': 'universal', 'priority': 1,
     'description': 'Tests whether numeric metrics differ significantly across categorical groupings.',
     'requires': {'measures': 1, 'dimensions': 1}},
    {'id': 'T06', 'name': 'Time Trend Analysis', 'category': 'universal', 'priority': 1,
     'description': 'Detects trends and growth rates in time-indexed numeric data.',
     'requires': {'dates': 1, 'measures': 1}},
    {'id': 'T07', 'name': 'Categorical Association Map', 'category': 'universal', 'priority': 1,
     'description': 'Tests independence between categorical variable pairs using chi-square.',
     'requires': {'dimensions': 2}},
    {'id': 'T08', 'name': 'Pareto Analysis (80/20)', 'category': 'universal', 'priority': 1,
     'description': 'Identifies which categories account for the majority of a numeric measure.',
     'requires': {'dimensions': 1, 'measures': 1}},
    # Priority 2: Mittelstand
    {'id': 'T09', 'name': 'Revenue Driver Analysis', 'category': 'business', 'priority': 2,
     'description': 'Identifies which factors most strongly predict revenue variation.',
     'requires': {'measures': 1, 'dimensions': 1}, 'patterns': ['revenue']},
    {'id': 'T10', 'name': 'Profitability Analysis', 'category': 'business', 'priority': 2,
     'description': 'Computes margin distributions and identifies highest/lowest margin segments.',
     'requires': {'measures': 2}, 'patterns': ['revenue', 'cost']},
    {'id': 'T11', 'name': 'Production Efficiency', 'category': 'manufacturing', 'priority': 2,
     'description': 'Analyzes output rates and defect rates to compute yield metrics.',
     'requires': {'measures': 1}, 'patterns': ['quantity']},
    {'id': 'T12', 'name': 'Supply Chain Lead Time', 'category': 'logistics', 'priority': 2,
     'description': 'Profiles delivery lead times and identifies bottlenecks.',
     'requires': {'measures': 1}, 'patterns': ['lead_time']},
    {'id': 'T13', 'name': 'Customer Concentration Risk', 'category': 'business', 'priority': 2,
     'description': 'Measures revenue dependency on top customers (HHI, Gini, Klumpenrisiko).',
     'requires': {'dimensions': 1, 'measures': 1}, 'patterns': ['customer', 'revenue']},
    {'id': 'T14', 'name': 'Pricing Elasticity', 'category': 'business', 'priority': 2,
     'description': 'Estimates price-quantity relationship using regression.',
     'requires': {'measures': 2}, 'patterns': ['price', 'quantity']},
    {'id': 'T15', 'name': 'Defect Root Cause', 'category': 'manufacturing', 'priority': 2,
     'description': 'Identifies which factors are statistically associated with defect occurrence.',
     'requires': {'dimensions': 1}, 'patterns': ['defect']},
    {'id': 'T16', 'name': 'Inventory Turnover', 'category': 'logistics', 'priority': 2,
     'description': 'Computes inventory turns and identifies slow-moving items.',
     'requires': {'measures': 1}, 'patterns': ['stock']},
    {'id': 'T17', 'name': 'Employee Productivity', 'category': 'hr', 'priority': 2,
     'description': 'Compares output per employee across departments with significance testing.',
     'requires': {'dimensions': 1, 'measures': 1}, 'patterns': ['employee']},
    {'id': 'T18', 'name': 'Regional Performance', 'category': 'business', 'priority': 2,
     'description': 'Compares KPIs across geographic regions with significance testing.',
     'requires': {'dimensions': 1, 'measures': 1}, 'patterns': ['region']},
    {'id': 'T19', 'name': 'Cash Flow Patterns', 'category': 'finance', 'priority': 2,
     'description': 'Identifies payment timing patterns and seasonal cash flow cycles.',
     'requires': {'dates': 1, 'measures': 1}, 'patterns': ['revenue']},
    {'id': 'T20', 'name': 'Warranty/Returns Analysis', 'category': 'manufacturing', 'priority': 2,
     'description': 'Profiles return/warranty patterns and identifies high-risk products.',
     'requires': {'dimensions': 1}, 'patterns': ['return']},
    {'id': 'T21', 'name': 'Batch Quality Control', 'category': 'manufacturing', 'priority': 2,
     'description': 'Analyzes measurement data against control limits to identify out-of-spec batches.',
     'requires': {'measures': 1, 'dimensions': 1}, 'patterns': ['measurement', 'batch']},
    {'id': 'T22', 'name': 'Energy Consumption', 'category': 'manufacturing', 'priority': 2,
     'description': 'Profiles energy consumption patterns and identifies efficiency opportunities.',
     'requires': {'measures': 1}, 'patterns': ['energy']},
    # Priority 3: Broader
    {'id': 'T23', 'name': 'Clinical Trial Endpoint', 'category': 'science', 'priority': 3,
     'description': 'Compares treatment vs control groups on outcome measures.',
     'requires': {'measures': 1}, 'patterns': ['treatment', 'outcome']},
    {'id': 'T24', 'name': 'Epidemiological Risk Screen', 'category': 'healthcare', 'priority': 3,
     'description': 'Screens exposure variables against a binary health outcome.',
     'requires': {'binaries': 1, 'dimensions': 1}},
    {'id': 'T25', 'name': 'Marketing Campaign Performance', 'category': 'marketing', 'priority': 3,
     'description': 'Compares conversion rates and ROI across campaigns.',
     'requires': {'dimensions': 1}, 'patterns': ['campaign']},
    {'id': 'T26', 'name': 'SaaS Cohort Metrics', 'category': 'business', 'priority': 3,
     'description': 'Computes retention and churn from subscription data.',
     'requires': {'dates': 1, 'measures': 1}, 'patterns': ['customer']},
    {'id': 'T27', 'name': 'HR Attrition Risk', 'category': 'hr', 'priority': 3,
     'description': 'Identifies employee attributes that correlate with turnover.',
     'requires': {'dimensions': 1}, 'patterns': ['attrition']},
    {'id': 'T28', 'name': 'Sensor Drift Detection', 'category': 'science', 'priority': 3,
     'description': 'Detects gradual drift in sensor data over time.',
     'requires': {'dates': 1, 'measures': 1}, 'patterns': ['measurement']},
    {'id': 'T29', 'name': 'A/B Test Analyzer', 'category': 'marketing', 'priority': 3,
     'description': 'Statistically rigorous comparison of two variants.',
     'requires': {'measures': 1}, 'patterns': ['variant']},
    {'id': 'T30', 'name': 'Freight Cost Optimizer', 'category': 'logistics', 'priority': 3,
     'description': 'Analyzes shipping cost drivers and identifies cost outlier routes.',
     'requires': {'measures': 1, 'dimensions': 1}, 'patterns': ['shipping']},
    {'id': 'T31', 'name': 'Budget vs Actual Variance', 'category': 'finance', 'priority': 2,
     'description': 'Soll-Ist-Vergleich: computes variance between planned and actual values.',
     'requires': {'measures': 2}, 'patterns': ['budget', 'actual']},
    # Market-specific: Germany (DATEV/BWA)
    {'id': 'T32', 'name': 'DATEV BWA Analysis', 'category': 'finance', 'priority': 2,
     'description': 'Analyzes BWA structure: Gesamtleistung, Rohertrag, Betriebsergebnis, key BWA ratios.',
     'requires': {'measures': 3}, 'patterns': ['bwa'], 'market': 'de'},
    {'id': 'T33', 'name': 'Deckungsbeitragsrechnung (KER)', 'category': 'finance', 'priority': 2,
     'description': 'Short-term P&L: Deckungsbeitrag per product/segment with variable vs fixed cost split.',
     'requires': {'measures': 2}, 'patterns': ['deckungsbeitrag'], 'market': 'de'},
    {'id': 'T34', 'name': 'Liquiditätsvorschau', 'category': 'finance', 'priority': 2,
     'description': 'Cash flow forecast: Zahlungseingänge vs Zahlungsausgänge with trend projection.',
     'requires': {'measures': 1}, 'patterns': ['liquiditaet'], 'market': 'de'},
    {'id': 'T35', 'name': 'Steuerberater Report', 'category': 'finance', 'priority': 2,
     'description': 'Monthly financial summary formatted for tax advisor: BWA key ratios + YoY comparison.',
     'requires': {'measures': 3}, 'patterns': ['bwa', 'revenue'], 'market': 'de'},
    # Market-specific: US (QuickBooks/GAAP)
    {'id': 'T36', 'name': 'QuickBooks P&L Analysis', 'category': 'finance', 'priority': 3,
     'description': 'Maps QuickBooks export to revenue/COGS/expenses, computes gross and net margins.',
     'requires': {'measures': 2}, 'patterns': ['quickbooks'], 'market': 'us'},
    {'id': 'T37', 'name': 'US Tax Bracket Impact', 'category': 'finance', 'priority': 3,
     'description': 'Analyzes income distribution relative to US federal tax brackets.',
     'requires': {'measures': 1}, 'patterns': ['us_tax'], 'market': 'us'},
    {'id': 'T38', 'name': 'GAAP Revenue Recognition', 'category': 'finance', 'priority': 3,
     'description': 'Revenue by period with deferred/accrued analysis per GAAP standards.',
     'requires': {'measures': 1, 'dates': 1}, 'patterns': ['quickbooks'], 'market': 'us'},
    {'id': 'T39', 'name': 'Sales Tax Nexus Analysis', 'category': 'finance', 'priority': 3,
     'description': 'Revenue by state to identify sales tax filing obligations and nexus thresholds.',
     'requires': {'measures': 1, 'dimensions': 1}, 'patterns': ['us_state'], 'market': 'us'},
    # Market-specific: UK (HMRC/FRS)
    {'id': 'T40', 'name': 'HMRC VAT Return Prep', 'category': 'finance', 'priority': 3,
     'description': 'VAT analysis: standard/reduced/exempt rate breakdown for HMRC filing.',
     'requires': {'measures': 1}, 'patterns': ['uk_vat'], 'market': 'uk'},
    {'id': 'T41', 'name': 'Companies House Filing', 'category': 'finance', 'priority': 3,
     'description': 'Key financial ratios for statutory filing: turnover, gross profit, directors.',
     'requires': {'measures': 2}, 'patterns': ['uk_tax'], 'market': 'uk'},
    {'id': 'T42', 'name': 'FRS 102 Compliance Check', 'category': 'finance', 'priority': 3,
     'description': 'Financial Reporting Standard compliance indicators and ratio analysis.',
     'requires': {'measures': 2}, 'patterns': ['uk_tax'], 'market': 'uk'},
]


# -- Template Engine -----------------------------------------------------------

class TemplateEngine:

    def get_applicable(self, column_profiles: list[dict]) -> list[TemplateMatch]:
        """Return all templates that apply to the given column profiles."""
        roles = {}
        for p in column_profiles:
            r = p.get('semantic_role', 'unknown')
            roles.setdefault(r, []).append(p['name'])

        matches = []
        for tmpl in TEMPLATES:
            req = tmpl.get('requires', {})
            confidence = 0.0
            matched_cols = {}

            # Check role requirements
            role_ok = True
            for role_key in ['measures', 'dimensions', 'binaries', 'dates']:
                needed = req.get(role_key, 0)
                if needed > 0:
                    role_name = role_key.rstrip('s')  # measures -> measure
                    available = roles.get(role_name, [])
                    if role_key == 'dimensions':
                        available = roles.get('dimension', [])
                    elif role_key == 'binaries':
                        available = roles.get('binary', [])
                    elif role_key == 'dates':
                        available = roles.get('date', [])
                    if len(available) < needed:
                        role_ok = False
                        break
                    for i in range(min(needed, len(available))):
                        matched_cols[f"{role_key}_{i}"] = available[i]

            min_cols = req.get('min_columns', 0)
            if min_cols > 0 and len(column_profiles) < min_cols:
                role_ok = False

            if role_ok:
                confidence += 0.5

            # Check name pattern requirements
            patterns = tmpl.get('patterns', [])
            pattern_score = 0.0
            if patterns:
                for concept in patterns:
                    col = _find_col(column_profiles, concept)
                    if col:
                        matched_cols[concept] = col
                        pattern_score += 1.0 / len(patterns)
                confidence += pattern_score * 0.5
            elif role_ok:
                # Universal templates with no patterns get full role score
                confidence = 0.7

            if confidence >= 0.3:
                matches.append(TemplateMatch(
                    template_id=tmpl['id'],
                    name=tmpl['name'],
                    category=tmpl['category'],
                    description=tmpl['description'],
                    confidence=round(confidence, 2),
                    matched_columns=matched_cols,
                ))

        matches.sort(key=lambda m: (-m.confidence,))
        return matches

    def run(self, template_id: str, df: pd.DataFrame,
            column_profiles: list[dict], column_mapping: dict = None) -> TemplateResult:
        """Execute a template by ID."""
        tmpl = next((t for t in TEMPLATES if t['id'] == template_id), None)
        if not tmpl:
            return TemplateResult(template_id=template_id, name='Unknown', category='unknown',
                                  success=False, findings=[], warnings=[f'Template {template_id} not found'])

        # Auto-detect columns if no mapping provided
        if not column_mapping:
            matches = self.get_applicable(column_profiles)
            match = next((m for m in matches if m.template_id == template_id), None)
            column_mapping = match.matched_columns if match else {}

        runner = getattr(self, f'_run_{template_id.lower()}', None)
        if not runner:
            return TemplateResult(template_id=template_id, name=tmpl['name'], category=tmpl['category'],
                                  success=False, findings=[], warnings=[f'Runner not implemented for {template_id}'])

        try:
            return runner(df, column_profiles, column_mapping, tmpl)
        except Exception as e:
            return TemplateResult(template_id=template_id, name=tmpl['name'], category=tmpl['category'],
                                  success=False, findings=[], warnings=[f'Error: {str(e)}'])

    # ==========================================================================
    # PRIORITY 1: UNIVERSAL TEMPLATES (T01-T08)
    # ==========================================================================

    def _run_t01(self, df, profiles, cols, tmpl):
        """Data Quality Scorecard"""
        total_cols = len(profiles)
        total_rows = len(df)
        complete_cols = sum(1 for p in profiles if p['null_rate'] == 0)
        completeness = round((1 - np.mean([p['null_rate'] for p in profiles])) * 100, 1)
        consistency = round((1 - sum(1 for p in profiles if p.get('mixed_types')) / max(total_cols, 1)) * 100, 1)
        uniqueness_cols = [p for p in profiles if p.get('semantic_role') == 'id']
        uniqueness = round(np.mean([p['unique_rate'] for p in uniqueness_cols]) * 100, 1) if uniqueness_cols else 100.0
        outlier_cols = sum(1 for p in profiles if p.get('outlier_count', 0) > 0)
        validity = round((1 - outlier_cols / max(total_cols, 1)) * 100, 1)
        overall = round((completeness + consistency + validity) / 3, 1)

        chart_data = {
            'chart_type': 'bar',
            'data': [
                {'dimension': 'Completeness', 'score': completeness},
                {'dimension': 'Consistency', 'score': consistency},
                {'dimension': 'Validity', 'score': validity},
                {'dimension': 'Overall', 'score': overall},
            ],
            'x_key': 'dimension', 'y_keys': ['score'],
            'title': 'Data Quality Dimensions',
        }

        avg_null = _fmt(np.mean([p['null_rate'] for p in profiles]) * 100)
        mixed_count = sum(1 for p in profiles if p.get('mixed_types'))
        findings = [
            _finding('quality.overview', {'rows': f"{total_rows:,}", 'cols': str(total_cols), 'complete': str(complete_cols)},
                     f"Dataset has {total_rows:,} rows across {total_cols} columns — {complete_cols}/{total_cols} columns are fully complete."),
            _finding('quality.completeness', {'score': str(completeness), 'avg_null': avg_null},
                     f"Completeness score: {completeness}% — average {avg_null}% null rate per column."),
            _finding('quality.consistency', {'score': str(consistency), 'mixed': str(mixed_count)},
                     f"Consistency score: {consistency}% — {mixed_count} columns have mixed data types."),
            _finding('quality.validity', {'score': str(validity), 'outlier_cols': str(outlier_cols)},
                     f"Validity score: {validity}% — {outlier_cols} columns contain statistical outliers."),
        ]

        return TemplateResult(template_id='T01', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'completeness': completeness, 'consistency': consistency,
                              'validity': validity, 'overall': overall, 'total_rows': total_rows},
                              charts=[chart_data], findings=findings)

    def _run_t02(self, df, profiles, cols, tmpl):
        """Correlation Explorer"""
        measures = _cols_by_role(profiles, 'measure')
        result = stat_analyst.correlation_matrix(df, measures)
        if 'error' in result:
            return TemplateResult(template_id='T02', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=[result['error']])

        pairs = result.get('top_correlations', [])
        sig_pairs = [p for p in pairs if p.get('significant')]

        charts = []
        if pairs:
            top = pairs[0]
            scatter_data = df[[top['col1'], top['col2']]].dropna().head(200)
            charts.append({
                'chart_type': 'scatter',
                'data': scatter_data.round(4).to_dict(orient='records'),
                'x_key': top['col1'], 'y_keys': [top['col2']],
                'title': f"Strongest: {top['col1']} vs {top['col2']} (r={top['r']})",
            })

        findings = [
            _finding('corr.tested', {'total': str(len(pairs)), 'sig': str(len(sig_pairs))},
                     f"Tested {len(pairs)} variable pairs — {len(sig_pairs)} statistically significant (p<0.05)."),
        ]
        if pairs:
            top = pairs[0]
            p_str = '<0.001' if top['p_value'] < 0.001 else _fmt(top['p_value'], 4)
            findings.append(_finding('corr.strongest', {'col1': top['col1'], 'col2': top['col2'], 'r': str(top['r']), 'strength': top['strength'], 'p': p_str},
                     f"Strongest correlation: {top['col1']} ↔ {top['col2']} (r={top['r']}, {top['strength']}, p={p_str})."))
        if len(sig_pairs) > 1:
            second = sig_pairs[1]
            findings.append(_finding('corr.second', {'col1': second['col1'], 'col2': second['col2'], 'r': str(second['r']), 'strength': second['strength']},
                     f"Second strongest: {second['col1']} ↔ {second['col2']} (r={second['r']}, {second['strength']})."))

        return TemplateResult(template_id='T02', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'total_pairs': len(pairs), 'significant_pairs': len(sig_pairs),
                              'strongest_r': pairs[0]['r'] if pairs else None},
                              charts=charts, findings=findings)

    def _run_t03(self, df, profiles, cols, tmpl):
        """Distribution Profiler"""
        measures = _cols_by_role(profiles, 'measure')
        dists = auto_analyzer._compute_distributions(df, measures)

        normal = [d for d in dists if d['shape'] == 'normal']
        skewed = [d for d in dists if 'skewed' in d['shape']]
        most_skewed = max(dists, key=lambda d: abs(d['skewness'])) if dists else None

        charts = []
        for d in dists[:3]:
            charts.append({
                'chart_type': 'histogram',
                'data': [{'bin': round((d['bins'][i] + d['bins'][i + 1]) / 2, 2), 'count': d['counts'][i]}
                         for i in range(len(d['counts']))],
                'x_key': 'bin', 'y_keys': ['count'],
                'title': f"{d['column']} — {d['shape']}",
            })

        findings = [
            f"Profiled {len(dists)} numeric columns — {len(normal)} normally distributed, {len(skewed)} skewed.",
        ]
        if most_skewed:
            findings.append(f"Most skewed: {most_skewed['column']} (skewness={most_skewed['skewness']}, {most_skewed['shape']}) — median {_fmt(most_skewed['median'])} vs mean {_fmt(most_skewed['mean'])}.")
        for d in dists:
            if d.get('normality_p') and d['normality_p'] < 0.01:
                findings.append(f"{d['column']} fails normality test (p={_fmt(d['normality_p'], 4)}) — consider non-parametric tests.")
                break

        return TemplateResult(template_id='T03', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'profiled_columns': len(dists), 'normal_count': len(normal), 'skewed_count': len(skewed)},
                              charts=charts, findings=findings)

    def _run_t04(self, df, profiles, cols, tmpl):
        """Outlier Detection Report"""
        measures = _cols_by_role(profiles, 'measure')
        anomalies = auto_analyzer._compute_anomalies(df, measures)
        total_outliers = sum(a['outlier_count'] for a in anomalies)

        chart_data = {
            'chart_type': 'bar',
            'data': [{'column': a['column'], 'outlier_pct': a['outlier_pct']} for a in anomalies[:10]],
            'x_key': 'column', 'y_keys': ['outlier_pct'],
            'title': 'Outlier Percentage by Column',
        }

        findings = [
            f"Found {total_outliers:,} total outliers across {len(anomalies)} columns (of {len(measures)} numeric columns analyzed).",
        ]
        if anomalies:
            worst = anomalies[0]
            findings.append(f"Worst: {worst['column']} — {worst['outlier_count']:,} outliers ({worst['outlier_pct']}%) outside [{_fmt(worst['lower_bound'])}, {_fmt(worst['upper_bound'])}].")
        high = [a for a in anomalies if a['severity'] == 'high']
        if high:
            findings.append(f"{len(high)} columns have HIGH severity (>5% outliers): {', '.join(a['column'] for a in high)}.")

        return TemplateResult(template_id='T04', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'total_outliers': total_outliers, 'columns_with_outliers': len(anomalies)},
                              charts=[chart_data] if anomalies else [], findings=findings)

    def _run_t05(self, df, profiles, cols, tmpl):
        """Segment Comparison"""
        measures = _cols_by_role(profiles, 'measure')
        dims = _cols_by_role(profiles, 'dimension')
        segments = auto_analyzer._compute_segments(df, dims[:3], measures[:3])
        sig = [s for s in segments if s.get('p_value', 1) < 0.05]

        charts = []
        findings = []
        if sig:
            top = sig[0]
            charts.append(top.get('chart_data', {}))
            groups = top.get('groups', [])
            if len(groups) >= 2:
                best = max(groups, key=lambda g: g.get('mean', 0))
                worst = min(groups, key=lambda g: g.get('mean', 0))
                ratio = round(best['mean'] / worst['mean'], 1) if worst['mean'] != 0 else 'inf'
                findings.append(f"{top['measure']} differs significantly across {top['dimension']} (F={_fmt(top['f_statistic'])}, p={'<0.001' if top['p_value'] < 0.001 else _fmt(top['p_value'], 4)}, effect={top['effect_size']}).")
                findings.append(f"Highest: {best['group']} (mean={_fmt(best['mean'])}) — Lowest: {worst['group']} (mean={_fmt(worst['mean'])}) — {ratio}x difference.")

        findings.insert(0, f"Tested {len(segments)} dimension×measure pairs — {len(sig)} statistically significant (p<0.05).")

        return TemplateResult(template_id='T05', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'tested_pairs': len(segments), 'significant_pairs': len(sig)},
                              charts=charts, findings=findings)

    def _run_t06(self, df, profiles, cols, tmpl):
        """Time Trend Analysis"""
        date_cols = _cols_by_role(profiles, 'date')
        measures = _cols_by_role(profiles, 'measure')
        if not date_cols or not measures:
            return TemplateResult(template_id='T06', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Need date + measure columns'])

        date_col, measure_col = date_cols[0], measures[0]
        tdf = df[[date_col, measure_col]].dropna().copy()
        tdf[date_col] = pd.to_datetime(tdf[date_col], errors='coerce')
        tdf = tdf.dropna().sort_values(date_col)
        if len(tdf) < 5:
            return TemplateResult(template_id='T06', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Not enough data points after date parsing'])

        # Trend regression
        tdf['ordinal'] = (tdf[date_col] - tdf[date_col].min()).dt.days.astype(float)
        slope = np.polyfit(tdf['ordinal'].values, tdf[measure_col].values, 1)[0]
        direction = 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'flat'
        first_val = float(tdf[measure_col].iloc[0])
        last_val = float(tdf[measure_col].iloc[-1])
        total_change = round((last_val - first_val) / first_val * 100, 1) if first_val != 0 else 0

        chart_data = {
            'chart_type': 'line',
            'data': tdf[[date_col, measure_col]].head(200).assign(
                **{date_col: tdf[date_col].dt.strftime('%Y-%m-%d')}
            ).to_dict(orient='records'),
            'x_key': date_col, 'y_keys': [measure_col],
            'title': f'{measure_col} over Time',
        }

        findings = [
            f"Trend is {direction} — {measure_col} changed {total_change:+.1f}% from {_fmt(first_val)} to {_fmt(last_val)}.",
            f"Daily slope: {_fmt(slope, 4)} per day across {len(tdf):,} data points.",
            f"Range: min={_fmt(float(tdf[measure_col].min()))}, max={_fmt(float(tdf[measure_col].max()))}, mean={_fmt(float(tdf[measure_col].mean()))}.",
        ]

        return TemplateResult(template_id='T06', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'direction': direction, 'total_change_pct': total_change, 'slope': round(slope, 6)},
                              charts=[chart_data], findings=findings)

    def _run_t07(self, df, profiles, cols, tmpl):
        """Categorical Association Map"""
        dims = _cols_by_role(profiles, 'dimension')
        binaries = _cols_by_role(profiles, 'binary')
        cat_cols = dims + binaries
        relationships = auto_analyzer._compute_relationships(df, dims, binaries, [])

        chart_data = {
            'chart_type': 'bar',
            'data': [{'pair': f"{r['col1']} × {r['col2']}", 'cramers_v': r['effect_size']}
                     for r in relationships[:10]],
            'x_key': 'pair', 'y_keys': ['cramers_v'],
            'title': "Association Strength (Cramér's V)",
        }

        findings = [
            f"Tested {len(cat_cols) * (len(cat_cols) - 1) // 2} categorical pairs — {len(relationships)} statistically significant.",
        ]
        if relationships:
            top = relationships[0]
            findings.append(f"Strongest association: {top['col1']} × {top['col2']} (Cramér's V={_fmt(top['effect_size'], 3)}, {top['effect_label']}, p={'<0.001' if top['p_value'] < 0.001 else _fmt(top['p_value'], 4)}).")

        return TemplateResult(template_id='T07', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'tested_pairs': len(cat_cols) * (len(cat_cols) - 1) // 2,
                              'significant_count': len(relationships)},
                              charts=[chart_data] if relationships else [], findings=findings)

    def _run_t08(self, df, profiles, cols, tmpl):
        """Pareto Analysis (80/20)"""
        dims = _cols_by_role(profiles, 'dimension')
        measures = _cols_by_role(profiles, 'measure')
        dim_col = cols.get('dimensions_0') or (dims[0] if dims else None)
        measure_col = cols.get('measures_0') or (measures[0] if measures else None)
        if not dim_col or not measure_col:
            return TemplateResult(template_id='T08', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Need dimension + measure'])

        grouped = df.groupby(dim_col)[measure_col].sum().sort_values(ascending=False)
        total = grouped.sum()
        if total == 0:
            return TemplateResult(template_id='T08', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['All values are zero'])

        cumsum = grouped.cumsum() / total * 100
        cutoff_idx = (cumsum >= 80).idxmax() if (cumsum >= 80).any() else cumsum.index[-1]
        categories_for_80 = list(cumsum.index).index(cutoff_idx) + 1
        total_categories = len(grouped)
        top_share = round(float(grouped.iloc[0] / total * 100), 1)

        chart_data = {
            'chart_type': 'bar',
            'data': [{'category': str(k), 'value': round(float(v), 2), 'cumulative_pct': round(float(cumsum[k]), 1)}
                     for k, v in grouped.head(15).items()],
            'x_key': 'category', 'y_keys': ['value'],
            'title': f'Pareto: {measure_col} by {dim_col}',
        }

        findings = [
            f"{categories_for_80} of {total_categories} categories ({round(categories_for_80/total_categories*100, 1)}%) account for 80% of total {measure_col}.",
            f"Top category '{grouped.index[0]}' alone accounts for {top_share}% of total ({_fmt(float(grouped.iloc[0]))}).",
            f"Total {measure_col}: {_fmt(float(total))} across {total_categories} categories.",
        ]

        return TemplateResult(template_id='T08', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'categories_for_80pct': categories_for_80,
                              'total_categories': total_categories, 'top_category_share': top_share,
                              'concentration_ratio': round(categories_for_80 / total_categories, 3)},
                              charts=[chart_data], findings=findings)

    # ==========================================================================
    # PRIORITY 2: MITTELSTAND TEMPLATES (T09-T22, T31)
    # ==========================================================================

    def _run_t09(self, df, profiles, cols, tmpl):
        """Revenue Driver Analysis"""
        rev_col = cols.get('revenue') or _find_col(profiles, 'revenue', 'measure')
        dims = _cols_by_role(profiles, 'dimension')
        if not rev_col:
            return TemplateResult(template_id='T09', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['No revenue column found'])

        results = []
        for dim in dims[:5]:
            r = stat_analyst.anova(df, rev_col, dim)
            if 'error' not in r and r.get('p_value', 1) < 0.1:
                results.append({'dimension': dim, **r})
        results.sort(key=lambda x: x.get('eta_squared', 0), reverse=True)

        charts = []
        findings = [f"Analyzed {len(dims)} dimensions as potential {rev_col} drivers — {len(results)} significant."]
        if results:
            top = results[0]
            groups = top.get('groups', [])
            charts.append({'chart_type': 'bar', 'data': groups, 'x_key': 'group', 'y_keys': ['mean'],
                           'title': f'{rev_col} by {top["dimension"]}'})
            if len(groups) >= 2:
                best = max(groups, key=lambda g: g['mean'])
                worst = min(groups, key=lambda g: g['mean'])
                findings.append(f"Strongest driver: {top['dimension']} (η²={_fmt(top['eta_squared'], 3)}, {top['effect_size']} effect) — {best['group']} averages {_fmt(best['mean'])} vs {worst['group']} at {_fmt(worst['mean'])}.")

        return TemplateResult(template_id='T09', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'drivers_tested': len(dims), 'significant_drivers': len(results)},
                              charts=charts, findings=findings)

    def _run_t10(self, df, profiles, cols, tmpl):
        """Profitability Analysis"""
        rev_col = cols.get('revenue') or _find_col(profiles, 'revenue', 'measure')
        cost_col = cols.get('cost') or _find_col(profiles, 'cost', 'measure')
        if not rev_col or not cost_col:
            return TemplateResult(template_id='T10', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Need both revenue and cost columns'])

        clean = df[[rev_col, cost_col]].dropna()
        clean['_margin'] = (clean[rev_col] - clean[cost_col]) / clean[rev_col].replace(0, np.nan) * 100
        clean = clean.dropna()
        avg_margin = round(float(clean['_margin'].mean()), 1)
        median_margin = round(float(clean['_margin'].median()), 1)
        negative_pct = round(float((clean['_margin'] < 0).mean() * 100), 1)

        dims = _cols_by_role(profiles, 'dimension')
        charts = [{'chart_type': 'histogram',
                    'data': [{'bin': round(float(b), 1), 'count': int(c)}
                             for b, c in zip(np.histogram(clean['_margin'].clip(-100, 200), bins=20)[1][:-1],
                                             np.histogram(clean['_margin'].clip(-100, 200), bins=20)[0])],
                    'x_key': 'bin', 'y_keys': ['count'], 'title': 'Margin Distribution (%)'}]

        findings = [
            f"Average margin: {avg_margin}% (median: {median_margin}%) across {len(clean):,} transactions.",
            f"{negative_pct}% of transactions have negative margins (loss-making).",
        ]

        # Segment analysis if dimension available
        if dims:
            dim = dims[0]
            if dim in df.columns:
                seg = df[[dim, rev_col, cost_col]].dropna().copy()
                seg['_margin'] = (seg[rev_col] - seg[cost_col]) / seg[rev_col].replace(0, np.nan) * 100
                seg_means = seg.groupby(dim)['_margin'].mean().sort_values(ascending=False).head(10)
                charts.append({'chart_type': 'bar',
                               'data': [{'segment': str(k), 'avg_margin': round(float(v), 1)} for k, v in seg_means.items()],
                               'x_key': 'segment', 'y_keys': ['avg_margin'], 'title': f'Margin by {dim}'})
                findings.append(f"Best margin segment: {seg_means.index[0]} ({_fmt(float(seg_means.iloc[0]))}%) — Worst: {seg_means.index[-1]} ({_fmt(float(seg_means.iloc[-1]))}%).")

        return TemplateResult(template_id='T10', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'avg_margin': avg_margin, 'median_margin': median_margin,
                              'negative_margin_pct': negative_pct},
                              charts=charts, findings=findings)

    def _run_t13(self, df, profiles, cols, tmpl):
        """Customer Concentration Risk"""
        cust_col = cols.get('customer') or _find_col(profiles, 'customer', 'dimension')
        rev_col = cols.get('revenue') or _find_col(profiles, 'revenue', 'measure')
        if not cust_col or not rev_col:
            return TemplateResult(template_id='T13', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Need customer + revenue columns'])

        grouped = df.groupby(cust_col)[rev_col].sum().sort_values(ascending=False)
        total = grouped.sum()
        if total == 0:
            return TemplateResult(template_id='T13', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Total revenue is zero'])

        shares = grouped / total
        hhi = round(float((shares ** 2).sum()), 4)
        gini = self._gini_coefficient(shares.values)
        top3_share = round(float(shares.head(3).sum() * 100), 1)
        top5_share = round(float(shares.head(5).sum() * 100), 1)
        top10_share = round(float(shares.head(10).sum() * 100), 1)
        n_customers = len(grouped)

        chart_data = {
            'chart_type': 'bar',
            'data': [{'customer': str(k), 'revenue': round(float(v), 2), 'share_pct': round(float(s * 100), 1)}
                     for (k, v), s in zip(grouped.head(10).items(), shares.head(10))],
            'x_key': 'customer', 'y_keys': ['revenue'],
            'title': f'Top 10 Customers by {rev_col}',
        }

        risk = 'HIGH' if hhi > 0.25 else 'MODERATE' if hhi > 0.15 else 'LOW'
        findings = [
            f"Customer concentration risk: {risk} (HHI={hhi}, Gini={_fmt(gini, 3)}).",
            f"Top 3 customers account for {top3_share}% of total {rev_col} ({_fmt(float(total))} total across {n_customers:,} customers).",
            f"Top 5: {top5_share}%, Top 10: {top10_share}% — {'Klumpenrisiko if any single top customer is lost.' if top3_share > 50 else 'reasonably diversified.'}",
            f"Largest customer '{grouped.index[0]}' alone represents {_fmt(float(shares.iloc[0] * 100), 1)}% of revenue.",
        ]

        return TemplateResult(template_id='T13', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'hhi': hhi, 'gini': gini, 'top3_share': top3_share,
                              'top5_share': top5_share, 'n_customers': n_customers, 'risk_level': risk},
                              charts=[chart_data], findings=findings)

    def _run_t31(self, df, profiles, cols, tmpl):
        """Budget vs Actual Variance (Soll-Ist-Vergleich)"""
        budget_col = cols.get('budget') or _find_col(profiles, 'budget', 'measure')
        actual_col = cols.get('actual') or _find_col(profiles, 'actual', 'measure')
        if not budget_col or not actual_col:
            return TemplateResult(template_id='T31', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Need budget/Soll + actual/Ist columns'])

        clean = df[[budget_col, actual_col]].dropna().copy()
        clean['_variance'] = clean[actual_col] - clean[budget_col]
        clean['_variance_pct'] = (clean['_variance'] / clean[budget_col].replace(0, np.nan) * 100).fillna(0)

        total_budget = float(clean[budget_col].sum())
        total_actual = float(clean[actual_col].sum())
        total_variance = total_actual - total_budget
        total_variance_pct = round(total_variance / total_budget * 100, 1) if total_budget != 0 else 0
        over_budget_pct = round(float((clean['_variance'] > 0).mean() * 100), 1)

        dims = _cols_by_role(profiles, 'dimension')
        charts = []
        if dims:
            dim = dims[0]
            if dim in df.columns:
                seg = df[[dim, budget_col, actual_col]].dropna()
                seg_var = seg.groupby(dim).agg({budget_col: 'sum', actual_col: 'sum'})
                seg_var['variance'] = seg_var[actual_col] - seg_var[budget_col]
                seg_var = seg_var.sort_values('variance')
                charts.append({'chart_type': 'bar',
                               'data': [{'category': str(k), 'variance': round(float(v['variance']), 2)}
                                        for k, v in seg_var.head(15).iterrows()],
                               'x_key': 'category', 'y_keys': ['variance'],
                               'title': f'Budget Variance by {dim}'})
        else:
            charts.append({'chart_type': 'bar',
                           'data': [{'metric': 'Total', 'budget': round(total_budget, 2), 'actual': round(total_actual, 2)}],
                           'x_key': 'metric', 'y_keys': ['budget', 'actual'],
                           'title': 'Budget vs Actual'})

        findings = [
            f"Total variance: {_fmt(total_variance)} ({total_variance_pct:+.1f}%) — Budget: {_fmt(total_budget)}, Actual: {_fmt(total_actual)}.",
            f"{over_budget_pct}% of line items exceed budget (over-spend).",
            f"Average variance per item: {_fmt(float(clean['_variance'].mean()))} ({_fmt(float(clean['_variance_pct'].mean()), 1)}%).",
        ]

        return TemplateResult(template_id='T31', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'total_budget': total_budget, 'total_actual': total_actual,
                              'total_variance': total_variance, 'total_variance_pct': total_variance_pct,
                              'over_budget_pct': over_budget_pct},
                              charts=charts, findings=findings)

    # Remaining Mittelstand templates use the same pattern — stub for now, will be filled
    def _run_t11(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, 'quantity', 'defect')

    def _run_t12(self, df, profiles, cols, tmpl):
        return self._generic_measure_template(df, profiles, cols, tmpl, 'lead_time')

    def _run_t14(self, df, profiles, cols, tmpl):
        """Pricing Elasticity"""
        price_col = cols.get('price') or _find_col(profiles, 'price', 'measure')
        qty_col = cols.get('quantity') or _find_col(profiles, 'quantity', 'measure')
        if not price_col or not qty_col:
            return TemplateResult(template_id='T14', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Need price + quantity columns'])

        result = stat_analyst.linear_regression(df, qty_col, [price_col])
        if 'error' in result:
            return TemplateResult(template_id='T14', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=[result['error']])

        coeff = next((c for c in result['coefficients'] if c['variable'] == price_col), None)
        elasticity = coeff['coefficient'] if coeff else 0
        scatter = df[[price_col, qty_col]].dropna().head(200)

        charts = [{'chart_type': 'scatter', 'data': scatter.round(4).to_dict(orient='records'),
                   'x_key': price_col, 'y_keys': [qty_col],
                   'title': f'{qty_col} vs {price_col} (elasticity={_fmt(elasticity, 3)})'}]

        elastic = abs(elasticity) > 1
        findings = [
            f"Price elasticity coefficient: {_fmt(elasticity, 4)} — demand is {'elastic' if elastic else 'inelastic'} (R²={result['r_squared']}).",
            f"A 1-unit increase in {price_col} is associated with a {_fmt(abs(elasticity), 2)}-unit {'decrease' if elasticity < 0 else 'increase'} in {qty_col}.",
            f"Model significance: p={'<0.001' if result.get('f_p_value', 1) < 0.001 else _fmt(result.get('f_p_value'), 4)}.",
        ]

        return TemplateResult(template_id='T14', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'elasticity': elasticity, 'r_squared': result['r_squared'], 'is_elastic': elastic},
                              charts=charts, findings=findings)

    def _run_t15(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, 'defect', None)

    def _run_t16(self, df, profiles, cols, tmpl):
        return self._generic_measure_template(df, profiles, cols, tmpl, 'stock')

    def _run_t17(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, None, 'employee')

    def _run_t18(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, None, 'region')

    def _run_t19(self, df, profiles, cols, tmpl):
        return self._run_t06(df, profiles, cols, tmpl)  # Reuse time trend

    def _run_t20(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, 'return', None)

    def _run_t21(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, 'measurement', 'batch')

    def _run_t22(self, df, profiles, cols, tmpl):
        return self._generic_measure_template(df, profiles, cols, tmpl, 'energy')

    # ==========================================================================
    # PRIORITY 3: BROADER TEMPLATES (T23-T30)
    # ==========================================================================

    def _run_t23(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, 'outcome', 'treatment')

    def _run_t24(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, None, None)

    def _run_t25(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, 'conversion', 'campaign')

    def _run_t26(self, df, profiles, cols, tmpl):
        return self._run_t06(df, profiles, cols, tmpl)  # Reuse time trend for cohort

    def _run_t27(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, 'attrition', None)

    def _run_t28(self, df, profiles, cols, tmpl):
        return self._run_t06(df, profiles, cols, tmpl)  # Reuse time trend for drift

    def _run_t29(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, None, 'variant')

    def _run_t30(self, df, profiles, cols, tmpl):
        return self._generic_segment_template(df, profiles, cols, tmpl, 'shipping', None)

    # ==========================================================================
    # MARKET-SPECIFIC TEMPLATES (T32-T42)
    # ==========================================================================

    def _run_t32(self, df, profiles, cols, tmpl):
        """DATEV BWA Analysis — detect BWA line items and compute key ratios."""
        bwa_cols = [p['name'] for p in profiles if _match(p['name'], 'bwa')]
        rev_col = _find_col(profiles, 'revenue', 'measure')
        measures = _cols_by_role(profiles, 'measure')

        if len(bwa_cols) < 2 and not rev_col:
            return self._generic_measure_template(df, profiles, cols, tmpl, 'revenue')

        # Compute BWA ratios
        metrics = {}
        total_rev = None
        for col in measures:
            if col in df.columns:
                val = float(df[col].sum())
                metrics[col] = val
                if _match(col, 'revenue') and total_rev is None:
                    total_rev = val

        findings = []
        charts = []

        if total_rev and total_rev > 0:
            # Compute cost ratios
            ratios = []
            for col, val in metrics.items():
                if col != (rev_col or '') and val != 0:
                    ratio = round(val / total_rev * 100, 1)
                    ratios.append({'position': col, 'value': round(val, 2), 'ratio_pct': ratio})
            ratios.sort(key=lambda r: -abs(r['ratio_pct']))

            charts.append({
                'chart_type': 'bar',
                'data': ratios[:10],
                'x_key': 'position', 'y_keys': ['ratio_pct'],
                'title': 'BWA-Kostenquoten (% vom Umsatz)',
            })

            findings.append(_finding('bwa.overview', {'rev': _fmt(total_rev), 'positions': str(len(metrics))},
                f"BWA analysis: {_fmt(total_rev)} total revenue across {len(metrics)} line items."))
            if ratios:
                top = ratios[0]
                findings.append(_finding('bwa.top_ratio', {'col': top['position'], 'pct': str(top['ratio_pct'])},
                    f"Largest cost ratio: {top['position']} at {top['ratio_pct']}% of revenue."))
        else:
            findings.append(_finding('bwa.no_rev', {}, "No revenue column found for BWA ratio calculation."))

        return TemplateResult(template_id='T32', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics=metrics, charts=charts, findings=findings)

    def _run_t33(self, df, profiles, cols, tmpl):
        """Deckungsbeitragsrechnung (KER) — variable vs fixed cost split."""
        return self._run_t10(df, profiles, cols, tmpl)  # Reuse profitability analysis

    def _run_t34(self, df, profiles, cols, tmpl):
        """Liquiditätsvorschau — cash flow patterns."""
        return self._generic_measure_template(df, profiles, cols, tmpl, 'liquiditaet')

    def _run_t35(self, df, profiles, cols, tmpl):
        """Steuerberater Report — monthly summary with BWA ratios."""
        return self._run_t32(df, profiles, cols, tmpl)  # Reuse BWA analysis

    def _run_t36(self, df, profiles, cols, tmpl):
        """QuickBooks P&L Analysis — standard P&L structure."""
        # Map QuickBooks P&L line items
        qb_map = {}
        for concept in ['revenue', 'cost', 'profit', 'quickbooks']:
            col = _find_col(profiles, concept, 'measure')
            if col:
                qb_map[concept] = col

        measures = _cols_by_role(profiles, 'measure')
        findings = []
        charts = []
        metrics = {}

        # Compute P&L structure
        income_col = qb_map.get('revenue') or _find_col(profiles, 'quickbooks')
        cogs_col = qb_map.get('cost')
        if not income_col:
            income_col = measures[0] if measures else None

        if income_col and income_col in df.columns:
            total_income = float(df[income_col].sum())
            metrics['total_income'] = round(total_income, 2)

            # Find and compute each P&L line
            pl_lines = []
            for col in measures:
                if col in df.columns:
                    val = float(df[col].sum())
                    pct = round(val / total_income * 100, 1) if total_income != 0 else 0
                    pl_lines.append({'line_item': col, 'total': round(val, 2), 'pct_of_income': pct})
                    metrics[col] = round(val, 2)

            pl_lines.sort(key=lambda x: -abs(x['total']))

            charts.append({
                'chart_type': 'bar',
                'data': pl_lines[:10],
                'x_key': 'line_item', 'y_keys': ['pct_of_income'],
                'title': 'P&L Line Items (% of Total Income)',
            })

            # Compute key margins
            if cogs_col and cogs_col in df.columns:
                total_cogs = float(df[cogs_col].sum())
                gross_margin = round((total_income - total_cogs) / total_income * 100, 1) if total_income != 0 else 0
                metrics['gross_margin_pct'] = gross_margin
                findings.append(f"Gross margin: {gross_margin}% (Total Income: ${total_income:,.0f}, COGS: ${total_cogs:,.0f}).")

            # Find operating expenses
            expense_cols = [c for c in measures if _match(c, 'cost') and c != cogs_col]
            if expense_cols:
                total_expenses = sum(float(df[c].sum()) for c in expense_cols if c in df.columns)
                expense_ratio = round(total_expenses / total_income * 100, 1) if total_income != 0 else 0
                metrics['operating_expense_ratio'] = expense_ratio
                findings.append(f"Operating expense ratio: {expense_ratio}% (${total_expenses:,.0f} across {len(expense_cols)} expense categories).")

            # Net income
            net_col = next((c for c in measures if _match(c, 'quickbooks') and 'net' in c.lower()), None)
            if net_col and net_col in df.columns:
                net_income = float(df[net_col].sum())
                net_margin = round(net_income / total_income * 100, 1) if total_income != 0 else 0
                metrics['net_margin_pct'] = net_margin
                findings.append(f"Net margin: {net_margin}% (Net Income: ${net_income:,.0f}).")

            if not findings:
                findings.append(f"Total income: ${total_income:,.0f} across {len(measures)} line items.")

        return TemplateResult(template_id='T36', name=tmpl['name'], category=tmpl['category'],
                              success=bool(findings), metrics=metrics, charts=charts, findings=findings)

    def _run_t37(self, df, profiles, cols, tmpl):
        """US Tax Bracket Impact — analyze income against federal brackets."""
        income_col = _find_col(profiles, 'us_tax', 'measure') or _find_col(profiles, 'revenue', 'measure')
        if not income_col or income_col not in df.columns:
            return self._generic_measure_template(df, profiles, cols, tmpl, 'us_tax')

        series = df[income_col].dropna().astype(float)
        # 2025 US federal tax brackets (single filer)
        brackets = [
            (11600, 10), (47150, 12), (100525, 22), (191950, 24),
            (243725, 32), (609350, 35), (float('inf'), 37),
        ]

        bracket_counts = [0] * len(brackets)
        for val in series:
            for i, (threshold, _) in enumerate(brackets):
                if val <= threshold:
                    bracket_counts[i] += 1
                    break

        bracket_data = []
        for i, (threshold, rate) in enumerate(brackets):
            prev = brackets[i - 1][0] if i > 0 else 0
            label = f"${prev:,.0f}-${threshold:,.0f}" if threshold != float('inf') else f"${brackets[-2][0]:,.0f}+"
            bracket_data.append({'bracket': f"{rate}% ({label})", 'count': bracket_counts[i]})

        charts = [{'chart_type': 'bar', 'data': bracket_data, 'x_key': 'bracket', 'y_keys': ['count'],
                   'title': 'Income Distribution by Federal Tax Bracket'}]

        median_income = float(series.median())
        mean_income = float(series.mean())
        findings = [
            f"Median income: ${median_income:,.0f}, Mean: ${mean_income:,.0f} across {len(series):,} records.",
            f"Highest concentration: {max(bracket_counts)} records in a single tax bracket.",
        ]
        # Find effective bracket for median
        for threshold, rate in brackets:
            if median_income <= threshold:
                findings.append(f"Median income falls in the {rate}% marginal tax bracket.")
                break

        return TemplateResult(template_id='T37', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'median_income': round(median_income, 2), 'mean_income': round(mean_income, 2),
                              'record_count': len(series)}, charts=charts, findings=findings)

    def _run_t38(self, df, profiles, cols, tmpl):
        """GAAP Revenue Recognition — revenue by period with deferred/accrued."""
        # Try time trend first
        result = self._run_t06(df, profiles, cols, tmpl)
        if result.success:
            return result

        # Fall back to period-over-period analysis using dimensions
        dims = _cols_by_role(profiles, 'dimension')
        rev_col = _find_col(profiles, 'quickbooks', 'measure') or _find_col(profiles, 'revenue', 'measure')
        if not rev_col or not dims:
            return self._generic_measure_template(df, profiles, cols, tmpl, 'quickbooks')

        dim = dims[0]
        grouped = df.groupby(dim)[rev_col].sum().sort_index()
        if len(grouped) < 2:
            return self._generic_measure_template(df, profiles, cols, tmpl, 'quickbooks')

        # Period-over-period change
        changes = grouped.pct_change().dropna() * 100
        avg_growth = round(float(changes.mean()), 1)
        total_rev = round(float(grouped.sum()), 2)

        charts = [{'chart_type': 'bar', 'data': [{'period': str(k), 'revenue': round(float(v), 2)} for k, v in grouped.items()],
                   'x_key': 'period', 'y_keys': ['revenue'], 'title': f'{rev_col} by Period'}]

        findings = [
            f"Total revenue: ${total_rev:,.0f} across {len(grouped)} periods.",
            f"Average period-over-period growth: {avg_growth:+.1f}%.",
            f"Highest period: {grouped.idxmax()} (${float(grouped.max()):,.0f}), Lowest: {grouped.idxmin()} (${float(grouped.min()):,.0f}).",
        ]

        return TemplateResult(template_id='T38', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'total_revenue': total_rev, 'avg_growth_pct': avg_growth,
                              'periods': len(grouped)}, charts=charts, findings=findings)

    def _run_t39(self, df, profiles, cols, tmpl):
        """Sales Tax Nexus — revenue by state with nexus threshold analysis."""
        state_col = _find_col(profiles, 'us_state', 'dimension')
        rev_col = _find_col(profiles, 'revenue', 'measure') or _find_col(profiles, 'quickbooks', 'measure')
        measures = _cols_by_role(profiles, 'measure')

        if not state_col or state_col not in df.columns:
            return self._generic_segment_template(df, profiles, cols, tmpl, 'revenue', 'us_state')

        if not rev_col:
            rev_col = measures[0] if measures else None
        if not rev_col or rev_col not in df.columns:
            return TemplateResult(template_id='T39', name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['No revenue column found'])

        # Revenue by state
        by_state = df.groupby(state_col)[rev_col].agg(['sum', 'count']).sort_values('sum', ascending=False)
        total = by_state['sum'].sum()

        # Common economic nexus threshold: $100K or 200 transactions
        NEXUS_THRESHOLD = 100000
        NEXUS_TRANSACTIONS = 200
        nexus_states = []
        for state, row in by_state.iterrows():
            has_nexus = row['sum'] >= NEXUS_THRESHOLD or row['count'] >= NEXUS_TRANSACTIONS
            nexus_states.append({
                'state': str(state), 'revenue': round(float(row['sum']), 2),
                'transactions': int(row['count']), 'nexus': has_nexus,
                'pct': round(float(row['sum'] / total * 100), 1) if total > 0 else 0,
            })

        charts = [{'chart_type': 'bar', 'data': nexus_states[:15],
                   'x_key': 'state', 'y_keys': ['revenue'],
                   'title': 'Revenue by State (Sales Tax Nexus)',
                   'referenceLines': [{'value': NEXUS_THRESHOLD, 'label': '$100K nexus threshold', 'color': '#ED6E6E'}]}]

        nexus_count = sum(1 for s in nexus_states if s['nexus'])
        findings = [
            f"{nexus_count} of {len(nexus_states)} states exceed economic nexus threshold ($100K revenue or 200 transactions).",
            f"Total revenue: ${total:,.0f} across {len(nexus_states)} states.",
        ]
        if nexus_states:
            top = nexus_states[0]
            findings.append(f"Highest: {top['state']} — ${top['revenue']:,.0f} ({top['pct']}% of total, {top['transactions']} transactions).")

        return TemplateResult(template_id='T39', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'nexus_states': nexus_count, 'total_states': len(nexus_states),
                              'total_revenue': round(float(total), 2)}, charts=charts, findings=findings)

    def _run_t40(self, df, profiles, cols, tmpl):
        """HMRC VAT Return Prep — compute Box 1-9 equivalents."""
        vat_cols = [p['name'] for p in profiles if _match(p['name'], 'uk_vat')]
        measures = _cols_by_role(profiles, 'measure')

        findings = []
        charts = []
        metrics = {}

        # Try to find standard/reduced/zero-rated/exempt columns
        std_col = next((c for c in vat_cols if 'standard' in c.lower()), None)
        red_col = next((c for c in vat_cols if 'reduced' in c.lower()), None)
        zero_col = next((c for c in vat_cols if 'zero' in c.lower()), None)
        exempt_col = next((c for c in vat_cols if 'exempt' in c.lower()), None)

        # Compute VAT totals
        vat_breakdown = []
        total_output_vat = 0
        for col in vat_cols:
            if col in df.columns:
                val = float(df[col].sum())
                metrics[col] = round(val, 2)
                total_output_vat += val
                rate_label = 'Standard (20%)' if col == std_col else 'Reduced (5%)' if col == red_col else 'Zero-rated' if col == zero_col else 'Exempt' if col == exempt_col else col
                vat_breakdown.append({'category': rate_label, 'amount': round(val, 2)})

        # Find input VAT if available
        input_col = next((c for c in measures if 'input' in c.lower() and 'vat' in c.lower()), None)
        total_input_vat = float(df[input_col].sum()) if input_col and input_col in df.columns else 0

        vat_due = total_output_vat - total_input_vat
        metrics['total_output_vat'] = round(total_output_vat, 2)
        metrics['total_input_vat'] = round(total_input_vat, 2)
        metrics['vat_due'] = round(vat_due, 2)

        if vat_breakdown:
            charts.append({'chart_type': 'pie', 'data': vat_breakdown,
                           'x_key': 'category', 'y_keys': ['amount'],
                           'title': 'VAT Output by Rate Category'})

        findings.append(f"Total output VAT (Box 1): £{total_output_vat:,.2f} across {len(vat_breakdown)} rate categories.")
        if total_input_vat > 0:
            findings.append(f"Total input VAT (Box 4): £{total_input_vat:,.2f}.")
            findings.append(f"Net VAT due (Box 5): £{vat_due:,.2f} ({'owed to HMRC' if vat_due > 0 else 'reclaimable'}).")
        if std_col and std_col in df.columns:
            std_total = float(df[std_col].sum())
            std_pct = round(std_total / total_output_vat * 100, 1) if total_output_vat > 0 else 0
            findings.append(f"Standard rate (20%) accounts for {std_pct}% of output VAT (£{std_total:,.2f}).")

        return TemplateResult(template_id='T40', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics=metrics, charts=charts, findings=findings)

    def _run_t41(self, df, profiles, cols, tmpl):
        """Companies House Filing — statutory financial ratios."""
        measures = _cols_by_role(profiles, 'measure')
        findings = []
        charts = []
        metrics = {}

        # Find key financial columns
        turnover_col = _find_col(profiles, 'revenue', 'measure') or _find_col(profiles, 'uk_tax')
        profit_col = _find_col(profiles, 'profit', 'measure')
        tax_col = next((c for c in measures if _match(c, 'uk_tax') and c in df.columns), None)

        for col in measures:
            if col in df.columns:
                metrics[col] = round(float(df[col].sum()), 2)

        # Compute key statutory ratios
        if turnover_col and turnover_col in df.columns:
            turnover = float(df[turnover_col].sum())
            metrics['turnover'] = round(turnover, 2)
            findings.append(f"Turnover: £{turnover:,.0f} across {len(df)} records.")

            if profit_col and profit_col in df.columns:
                profit = float(df[profit_col].sum())
                profit_margin = round(profit / turnover * 100, 1) if turnover != 0 else 0
                metrics['profit_margin_pct'] = profit_margin
                findings.append(f"Profit margin: {profit_margin}% (Gross Profit: £{profit:,.0f}).")

            # Expense ratio
            expense_total = sum(float(df[c].sum()) for c in measures if c in df.columns and c != turnover_col and c != profit_col)
            if expense_total > 0:
                expense_ratio = round(expense_total / turnover * 100, 1) if turnover != 0 else 0
                findings.append(f"Total expenses: £{expense_total:,.0f} ({expense_ratio}% of turnover).")

        # Chart: breakdown of financial lines
        if metrics:
            chart_data = [{'item': k, 'amount': v} for k, v in sorted(metrics.items(), key=lambda x: -abs(x[1]))][:10]
            charts.append({'chart_type': 'bar', 'data': chart_data, 'x_key': 'item', 'y_keys': ['amount'],
                           'title': 'Financial Summary for Companies House'})

        if not findings:
            findings.append(f"Dataset contains {len(measures)} financial measures across {len(df)} records.")

        return TemplateResult(template_id='T41', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics=metrics, charts=charts, findings=findings)

    def _run_t42(self, df, profiles, cols, tmpl):
        """FRS 102 Compliance Check — key financial reporting ratios."""
        measures = _cols_by_role(profiles, 'measure')
        findings = []
        metrics = {}
        charts = []

        turnover_col = _find_col(profiles, 'revenue', 'measure') or _find_col(profiles, 'uk_tax')
        profit_col = _find_col(profiles, 'profit', 'measure')

        for col in measures:
            if col in df.columns:
                metrics[col] = round(float(df[col].sum()), 2)

        if turnover_col and turnover_col in df.columns:
            turnover = float(df[turnover_col].sum())

            # FRS 102 size thresholds (2025)
            is_micro = turnover <= 1_000_000
            is_small = turnover <= 15_000_000
            size_class = 'Micro-entity' if is_micro else 'Small company' if is_small else 'Medium/Large company'
            findings.append(f"Company classification: {size_class} (turnover £{turnover:,.0f}). Micro threshold: £1M, Small: £15M.")

            if profit_col and profit_col in df.columns:
                profit = float(df[profit_col].sum())
                margin = round(profit / turnover * 100, 1) if turnover != 0 else 0
                findings.append(f"Profit margin: {margin}% — {'healthy' if margin > 10 else 'below average' if margin > 0 else 'loss-making'}.")

            # Compute period-over-period if dimension available
            dims = _cols_by_role(profiles, 'dimension')
            if dims:
                dim = dims[0]
                if dim in df.columns:
                    by_period = df.groupby(dim)[turnover_col].sum()
                    if len(by_period) >= 2:
                        change = round(float((by_period.iloc[-1] - by_period.iloc[0]) / (by_period.iloc[0] + 1e-10) * 100), 1)
                        findings.append(f"Turnover trend: {change:+.1f}% from {by_period.index[0]} to {by_period.index[-1]}.")
                        charts.append({'chart_type': 'bar', 'data': [{'period': str(k), 'turnover': round(float(v), 2)} for k, v in by_period.items()],
                                       'x_key': 'period', 'y_keys': ['turnover'], 'title': 'Turnover by Period'})

        if not findings:
            findings.append(f"Dataset contains {len(measures)} financial measures for FRS 102 review.")

        return TemplateResult(template_id='T42', name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics=metrics, charts=charts, findings=findings)

    # ==========================================================================
    # GENERIC REUSABLE RUNNERS
    # ==========================================================================

    def _generic_segment_template(self, df, profiles, cols, tmpl,
                                   measure_concept: str = None, dim_concept: str = None):
        """Generic segment analysis: ANOVA of a measure across a dimension."""
        measures = _cols_by_role(profiles, 'measure')
        dims = _cols_by_role(profiles, 'dimension') + _cols_by_role(profiles, 'binary')

        measure_col = (cols.get(measure_concept) or _find_col(profiles, measure_concept, 'measure')) if measure_concept else None
        if not measure_col and measures:
            measure_col = measures[0]
        dim_col = (cols.get(dim_concept) or _find_col(profiles, dim_concept)) if dim_concept else None
        if not dim_col and dims:
            dim_col = dims[0]

        if not measure_col or not dim_col or measure_col not in df.columns or dim_col not in df.columns:
            return TemplateResult(template_id=tmpl['id'], name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=['Could not find required columns'])

        result = stat_analyst.anova(df, measure_col, dim_col)
        if 'error' in result:
            return TemplateResult(template_id=tmpl['id'], name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=[result['error']])

        groups = result.get('groups', [])
        charts = [{'chart_type': 'bar', 'data': groups, 'x_key': 'group', 'y_keys': ['mean'],
                   'title': f'{measure_col} by {dim_col}'}]

        findings = [f"ANOVA: {measure_col} by {dim_col} — F={_fmt(result['f_statistic'])}, p={'<0.001' if result['p_value'] < 0.001 else _fmt(result['p_value'], 4)}, η²={_fmt(result['eta_squared'], 3)} ({result['effect_size']} effect)."]
        if len(groups) >= 2:
            best = max(groups, key=lambda g: g['mean'])
            worst = min(groups, key=lambda g: g['mean'])
            findings.append(f"Highest: {best['group']} (mean={_fmt(best['mean'])}, n={best['n']}) — Lowest: {worst['group']} (mean={_fmt(worst['mean'])}, n={worst['n']}).")

        return TemplateResult(template_id=tmpl['id'], name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'f_statistic': result['f_statistic'], 'p_value': result['p_value'],
                              'eta_squared': result['eta_squared'], 'effect_size': result['effect_size']},
                              charts=charts, findings=findings)

    def _generic_measure_template(self, df, profiles, cols, tmpl, concept: str):
        """Generic descriptive analysis for a specific measure concept."""
        col = cols.get(concept) or _find_col(profiles, concept, 'measure')
        if not col:
            measures = _cols_by_role(profiles, 'measure')
            col = measures[0] if measures else None
        if not col or col not in df.columns:
            return TemplateResult(template_id=tmpl['id'], name=tmpl['name'], category=tmpl['category'],
                                  success=False, warnings=[f'No {concept} column found'])

        series = df[col].dropna()
        dists = auto_analyzer._compute_distributions(df, [col])
        anomalies = auto_analyzer._compute_anomalies(df, [col])

        charts = []
        if dists:
            d = dists[0]
            charts.append({'chart_type': 'histogram',
                           'data': [{'bin': round((d['bins'][i] + d['bins'][i + 1]) / 2, 2), 'count': d['counts'][i]}
                                    for i in range(len(d['counts']))],
                           'x_key': 'bin', 'y_keys': ['count'], 'title': f'Distribution of {col}'})

        findings = [
            f"{col}: mean={_fmt(float(series.mean()))}, median={_fmt(float(series.median()))}, std={_fmt(float(series.std()))} across {len(series):,} values.",
            f"Range: {_fmt(float(series.min()))} to {_fmt(float(series.max()))}.",
        ]
        if anomalies:
            a = anomalies[0]
            findings.append(f"Outliers: {a['outlier_count']:,} values ({a['outlier_pct']}%) outside [{_fmt(a['lower_bound'])}, {_fmt(a['upper_bound'])}].")
        if dists:
            findings.append(f"Distribution shape: {dists[0]['shape']} (skewness={dists[0]['skewness']}).")

        return TemplateResult(template_id=tmpl['id'], name=tmpl['name'], category=tmpl['category'],
                              success=True, metrics={'mean': round(float(series.mean()), 4),
                              'median': round(float(series.median()), 4), 'std': round(float(series.std()), 4)},
                              charts=charts, findings=findings)

    # ==========================================================================
    # AI CONTEXT BUILDER
    # ==========================================================================

    def build_ai_context_from_templates(self, df: pd.DataFrame,
                                         column_profiles: list[dict],
                                         max_templates: int = 3) -> str:
        """Run top applicable templates, return verified facts for Claude prompts."""
        applicable = self.get_applicable(column_profiles)
        if not applicable:
            return ""

        verified_facts = []
        for match in applicable[:max_templates]:
            result = self.run(match.template_id, df, column_profiles, match.matched_columns)
            if result.success:
                for finding in result.findings:
                    verified_facts.append(f"[VERIFIED] {finding}")

        return "\n".join(verified_facts)

    # -- Helpers ---------------------------------------------------------------

    def _gini_coefficient(self, values: np.ndarray) -> float:
        sorted_vals = np.sort(values)
        n = len(sorted_vals)
        if n == 0:
            return 0.0
        index = np.arange(1, n + 1)
        return round(float((2 * np.sum(index * sorted_vals) / (n * np.sum(sorted_vals))) - (n + 1) / n), 4)


template_engine = TemplateEngine()
