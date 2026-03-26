#!/usr/bin/env python3
"""
Fetch public German business datasets for DataLaser ML training.
Downloads CSV data from GENESIS-Online (Destatis), Kaggle, UCI, and other sources.
Processes each through the pipeline to extract training features.

Usage:
    python scripts/fetch_training_data.py --output ./training_data
    python scripts/fetch_training_data.py --output ./training_data --process
"""

import os
import sys
import csv
import json
import time
import argparse
import logging
from pathlib import Path
from io import StringIO, BytesIO

import requests
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

OUTPUT_DIR = Path("training_data")


# ─── GENESIS-Online API (Destatis) ────────────────────────────────────────────

GENESIS_BASE = "https://www-genesis.destatis.de/genesisWS/rest/2020"

# Public tables with German business data (no auth needed for metadata, some for data)
GENESIS_TABLES = [
    # Manufacturing
    ("42111-0001", "manufacturing", "Betriebe, Beschäftigte, Umsatz im Bergbau und Verarbeitenden Gewerbe"),
    ("42111-0003", "manufacturing", "Betriebe, Beschäftigte, Umsatz nach Wirtschaftszweigen"),
    ("42131-0001", "manufacturing", "Auftragseingang im Verarbeitenden Gewerbe"),
    ("42153-0001", "manufacturing", "Produktionsindex im Produzierenden Gewerbe"),

    # Retail / Commerce
    ("45212-0001", "commerce", "Umsatz im Einzelhandel"),
    ("45212-0002", "commerce", "Umsatz und Beschäftigte im Einzelhandel"),
    ("45213-0001", "commerce", "Umsatz im Großhandel"),

    # Construction
    ("44111-0001", "manufacturing", "Bauhauptgewerbe: Betriebe, Beschäftigte, Umsatz"),

    # Energy
    ("43311-0001", "energy", "Energieversorgung: Betriebe, Beschäftigte, Umsatz"),

    # Agriculture
    ("41141-0001", "agriculture", "Landwirtschaftliche Betriebe und Flächen"),
    ("41241-0001", "agriculture", "Erntemengen und Erträge"),

    # Services
    ("47414-0001", "services", "Umsatz im Dienstleistungsbereich"),

    # Foreign Trade
    ("51000-0001", "commerce", "Aus- und Einfuhr (Außenhandel)"),

    # Employment
    ("12211-0001", "services", "Erwerbstätige nach Wirtschaftsbereichen"),
]


def fetch_genesis_table(table_code: str, output_dir: Path) -> Path | None:
    """
    Fetch a GENESIS table as CSV via the flat file API.
    Returns path to saved CSV or None on failure.
    """
    url = f"{GENESIS_BASE}/data/tablefile"
    params = {
        "name": table_code,
        "area": "all",
        "compress": "false",
        "format": "ffcsv",
        "language": "de",
    }

    try:
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code == 200 and len(resp.content) > 100:
            filepath = output_dir / f"genesis_{table_code}.csv"
            filepath.write_bytes(resp.content)
            logger.info("Downloaded GENESIS %s → %s (%d bytes)", table_code, filepath.name, len(resp.content))
            return filepath
        else:
            # Try alternative format
            params["format"] = "csv"
            resp2 = requests.get(url, params=params, timeout=30)
            if resp2.status_code == 200 and len(resp2.content) > 100:
                filepath = output_dir / f"genesis_{table_code}.csv"
                filepath.write_bytes(resp2.content)
                logger.info("Downloaded GENESIS %s (csv) → %s", table_code, filepath.name)
                return filepath
            logger.warning("GENESIS %s: status=%d, size=%d", table_code, resp.status_code, len(resp.content))
            return None
    except Exception as e:
        logger.warning("GENESIS %s failed: %s", table_code, e)
        return None


# ─── UCI / Direct CSV Downloads ───────────────────────────────────────────────

DIRECT_DOWNLOADS = [
    {
        "name": "german_credit_data",
        "url": "https://archive.ics.uci.edu/ml/machine-learning-databases/statlog/german/german.data",
        "domain": "finance",
        "description": "UCI German Credit Data — 1000 records, 20 attributes",
        "separator": " ",
        "columns": [
            "kontostatus", "laufzeit_monate", "kreditgeschichte", "verwendungszweck",
            "kreditbetrag", "sparkonto", "beschaeftigung_seit", "ratenzahlung_prozent",
            "familienstand_geschlecht", "buerge", "wohnsitz_seit", "vermoegen",
            "alter", "weitere_raten", "wohnung", "bestehende_kredite",
            "beruf", "unterhaltspflichtige", "telefon", "auslaendischer_arbeitnehmer", "kreditrisiko"
        ],
    },
    {
        "name": "south_german_credit",
        "url": "https://archive.ics.uci.edu/ml/machine-learning-databases/00522/SouthGermanCredit.asc",
        "domain": "finance",
        "description": "South German Credit — corrected version, 1000 records",
        "separator": " ",
        "columns": None,  # has header
    },
]


def fetch_direct_csv(item: dict, output_dir: Path) -> Path | None:
    """Download a CSV from a direct URL."""
    try:
        resp = requests.get(item["url"], timeout=30)
        if resp.status_code != 200:
            logger.warning("Direct download %s failed: %d", item["name"], resp.status_code)
            return None

        filepath = output_dir / f"{item['name']}.csv"

        # Parse and re-save as proper CSV
        sep = item.get("separator", ",")
        lines = resp.text.strip().split("\n")

        if item.get("columns"):
            # Add header
            with open(filepath, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(item["columns"])
                for line in lines:
                    writer.writerow(line.split(sep))
        else:
            filepath.write_text(resp.text)

        logger.info("Downloaded %s → %s (%d lines)", item["name"], filepath.name, len(lines))
        return filepath
    except Exception as e:
        logger.warning("Direct download %s failed: %s", item["name"], e)
        return None


# ─── Synthetic German Business Datasets ───────────────────────────────────────

def generate_synthetic_datasets(output_dir: Path) -> list[Path]:
    """
    Generate synthetic German business datasets with realistic German column names.
    These provide guaranteed training data while waiting for real public data.
    """
    import numpy as np
    np.random.seed(42)
    generated = []

    # 1. Manufacturing — Fertigungsaufträge
    n = 500
    df = pd.DataFrame({
        "auftrags_id": range(1, n + 1),
        "produkt_id": np.random.randint(1, 50, n),
        "maschine": np.random.choice(["CNC-01", "CNC-02", "Dreh-A", "Fräse-B", "Montage-1"], n),
        "menge_produziert": np.random.randint(10, 500, n),
        "ausschuss": np.random.randint(0, 20, n),
        "durchlaufzeit_std": np.round(np.random.exponential(3, n), 2),
        "energieverbrauch_kwh": np.round(np.random.normal(150, 30, n), 1),
        "produktionsdatum": pd.date_range("2024-01-01", periods=n, freq="4h").strftime("%Y-%m-%d"),
        "schicht": np.random.choice(["Früh", "Spät", "Nacht"], n),
        "qualitaetsscore": np.round(np.random.uniform(85, 100, n), 1),
    })
    path = output_dir / "synth_fertigungsauftraege.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 2. Commerce — Bestellungen
    n = 800
    df = pd.DataFrame({
        "bestell_id": range(10001, 10001 + n),
        "kunden_id": np.random.randint(1, 200, n),
        "produkt_id": np.random.randint(1, 100, n),
        "menge": np.random.randint(1, 20, n),
        "umsatz": np.round(np.random.lognormal(8, 1.5, n), 2),
        "kosten": np.round(np.random.lognormal(7.5, 1.5, n), 2),
        "rabatt_prozent": np.round(np.random.choice([0, 0, 0, 5, 10, 15, 20], n).astype(float), 1),
        "bestelldatum": pd.date_range("2024-01-01", periods=n, freq="8h").strftime("%Y-%m-%d"),
        "status": np.random.choice(["geliefert", "in_bearbeitung", "storniert"], n, p=[0.85, 0.10, 0.05]),
        "zahlungsmethode": np.random.choice(["Lastschrift", "Kreditkarte", "Überweisung", "PayPal"], n),
    })
    path = output_dir / "synth_bestellungen.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 3. Finance — Kostenstellenrechnung
    n = 300
    kostenstellen = ["Fertigung", "Vertrieb", "Verwaltung", "IT", "Logistik", "F&E", "Personal"]
    df = pd.DataFrame({
        "buchungs_id": range(1, n + 1),
        "kostenstelle": np.random.choice(kostenstellen, n),
        "kostenart": np.random.choice(["Personalkosten", "Materialkosten", "Abschreibungen", "Miete", "Energie", "Fremdleistungen"], n),
        "betrag_eur": np.round(np.random.lognormal(9, 1, n), 2),
        "plankosten_eur": np.round(np.random.lognormal(9, 0.8, n), 2),
        "abweichung_prozent": np.round(np.random.normal(0, 15, n), 1),
        "buchungsdatum": pd.date_range("2024-01-01", periods=n, freq="D").strftime("%Y-%m-%d")[:n],
        "periode": np.random.choice(["Q1", "Q2", "Q3", "Q4"], n),
    })
    path = output_dir / "synth_kostenstellenrechnung.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 4. HR — Personalstammdaten
    n = 150
    df = pd.DataFrame({
        "mitarbeiter_id": range(1, n + 1),
        "abteilung": np.random.choice(["Fertigung", "Vertrieb", "Verwaltung", "IT", "Logistik", "F&E"], n),
        "position": np.random.choice(["Sachbearbeiter", "Teamleiter", "Abteilungsleiter", "Facharbeiter", "Ingenieur"], n),
        "gehalt_brutto": np.round(np.random.normal(4500, 1200, n), 0).astype(int),
        "eintrittsdatum": pd.date_range("2015-01-01", periods=n, freq="25D").strftime("%Y-%m-%d"),
        "betriebszugehoerigkeit_jahre": np.random.randint(1, 25, n),
        "kranktage_jahr": np.random.poisson(8, n),
        "ueberstunden_monat": np.round(np.random.exponential(5, n), 1),
        "standort": np.random.choice(["München", "Stuttgart", "Hamburg", "Berlin", "Düsseldorf"], n),
    })
    path = output_dir / "synth_personalstammdaten.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 5. Quality — Reklamationen
    n = 200
    df = pd.DataFrame({
        "reklamation_id": range(1, n + 1),
        "bestell_id": np.random.randint(10001, 10800, n),
        "grund": np.random.choice(["Lieferschaden", "Qualitätsmangel", "Falschlieferung", "Fehlmenge", "Verspätung"], n),
        "kosten_eur": np.round(np.random.lognormal(5, 1.5, n), 2),
        "schweregrad": np.random.choice(["gering", "mittel", "hoch", "kritisch"], n, p=[0.4, 0.3, 0.2, 0.1]),
        "status": np.random.choice(["offen", "in_bearbeitung", "abgeschlossen"], n, p=[0.2, 0.3, 0.5]),
        "datum": pd.date_range("2024-01-01", periods=n, freq="2D").strftime("%Y-%m-%d"),
        "bearbeiter": np.random.choice(["Müller", "Schmidt", "Weber", "Fischer", "Meyer"], n),
    })
    path = output_dir / "synth_reklamationen.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 6. Logistics — Lieferungen
    n = 600
    df = pd.DataFrame({
        "liefer_id": range(1, n + 1),
        "lieferant_id": np.random.randint(1, 30, n),
        "artikel_id": np.random.randint(1, 100, n),
        "liefermenge": np.random.randint(10, 1000, n),
        "lieferwert_eur": np.round(np.random.lognormal(8, 1, n), 2),
        "lieferdatum": pd.date_range("2024-01-01", periods=n, freq="10h").strftime("%Y-%m-%d"),
        "soll_lieferdatum": pd.date_range("2024-01-01", periods=n, freq="10h").strftime("%Y-%m-%d"),
        "verspaetung_tage": np.random.choice([0, 0, 0, 0, 1, 2, 3, 5, 7], n),
        "transportart": np.random.choice(["LKW", "Bahn", "Luftfracht", "Seefracht"], n, p=[0.6, 0.2, 0.1, 0.1]),
        "lager": np.random.choice(["Lager-Nord", "Lager-Süd", "Lager-Ost", "Außenlager"], n),
    })
    path = output_dir / "synth_lieferungen.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 7. Energy — Energieverbrauch
    n = 365
    df = pd.DataFrame({
        "datum": pd.date_range("2024-01-01", periods=n, freq="D").strftime("%Y-%m-%d"),
        "stromverbrauch_kwh": np.round(np.random.normal(5000, 800, n) + np.sin(np.arange(n) / 365 * 2 * np.pi) * 500, 1),
        "gasverbrauch_kwh": np.round(np.random.normal(3000, 600, n) + np.cos(np.arange(n) / 365 * 2 * np.pi) * 1000, 1),
        "wasserverbrauch_m3": np.round(np.random.normal(50, 10, n), 1),
        "kosten_strom_eur": np.round(np.random.normal(1500, 250, n), 2),
        "kosten_gas_eur": np.round(np.random.normal(900, 200, n), 2),
        "co2_emissionen_kg": np.round(np.random.normal(2000, 400, n), 1),
        "standort": np.random.choice(["Werk-A", "Werk-B", "Verwaltung"], n, p=[0.5, 0.3, 0.2]),
    })
    path = output_dir / "synth_energieverbrauch.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 8. Chemical / Pharma — Chargenprotokoll
    n = 400
    df = pd.DataFrame({
        "chargen_nr": [f"CH-{i:05d}" for i in range(1, n + 1)],
        "produkt": np.random.choice(["Wirkstoff-A", "Wirkstoff-B", "Grundstoff-C", "Reagenz-D"], n),
        "temperatur_celsius": np.round(np.random.normal(25, 3, n), 1),
        "druck_bar": np.round(np.random.normal(1.5, 0.3, n), 2),
        "reaktionszeit_min": np.round(np.random.exponential(45, n), 1),
        "ausbeute_prozent": np.round(np.random.normal(92, 4, n), 1),
        "reinheit_prozent": np.round(np.clip(np.random.normal(99.2, 0.5, n), 95, 100), 2),
        "ph_wert": np.round(np.random.normal(7.0, 0.5, n), 2),
        "pruefstatus": np.random.choice(["freigegeben", "gesperrt", "in_prüfung"], n, p=[0.85, 0.05, 0.10]),
        "produktionsdatum": pd.date_range("2024-01-01", periods=n, freq="16h").strftime("%Y-%m-%d"),
    })
    path = output_dir / "synth_chargenprotokoll.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 9. Retail — Filialumsätze
    n = 500
    filialen = ["Berlin-Mitte", "München-Zentrum", "Hamburg-Hafen", "Köln-Dom", "Frankfurt-Main", "Stuttgart-City"]
    df = pd.DataFrame({
        "filiale": np.random.choice(filialen, n),
        "datum": pd.date_range("2024-01-01", periods=n, freq="12h").strftime("%Y-%m-%d"),
        "umsatz_brutto": np.round(np.random.lognormal(9, 0.8, n), 2),
        "umsatz_netto": np.round(np.random.lognormal(8.8, 0.8, n), 2),
        "kundenanzahl": np.random.randint(50, 500, n),
        "durchschnittlicher_warenkorb": np.round(np.random.normal(45, 15, n), 2),
        "retourenquote_prozent": np.round(np.random.exponential(3, n), 1),
        "mitarbeiter_anzahl": np.random.randint(5, 25, n),
        "warengruppe": np.random.choice(["Lebensmittel", "Bekleidung", "Elektronik", "Haushalt", "Drogerie"], n),
    })
    path = output_dir / "synth_filialumsaetze.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    # 10. Banking — Kreditportfolio
    n = 350
    df = pd.DataFrame({
        "kredit_id": range(1, n + 1),
        "kreditnehmer_typ": np.random.choice(["Privat", "Gewerbe", "Selbständig"], n, p=[0.5, 0.35, 0.15]),
        "kreditbetrag_eur": np.round(np.random.lognormal(10, 1.5, n), 0).astype(int),
        "zinssatz_prozent": np.round(np.random.uniform(1.5, 8.5, n), 2),
        "laufzeit_monate": np.random.choice([12, 24, 36, 48, 60, 84, 120], n),
        "tilgungsrate_eur": np.round(np.random.lognormal(7, 1, n), 2),
        "restschuld_eur": np.round(np.random.lognormal(9.5, 1.5, n), 0).astype(int),
        "bonitaetsscore": np.random.randint(300, 850, n),
        "zahlungsverzug_tage": np.random.choice([0, 0, 0, 0, 0, 7, 14, 30, 60, 90], n),
        "sicherheit": np.random.choice(["Immobilie", "Bürgschaft", "Keine", "Spareinlage"], n),
    })
    path = output_dir / "synth_kreditportfolio.csv"
    df.to_csv(path, index=False)
    generated.append(path)

    logger.info("Generated %d synthetic datasets", len(generated))
    return generated


# ─── Process datasets through pipeline ────────────────────────────────────────

def process_dataset(filepath: Path, domain: str, pipeline_url: str, admin_key: str):
    """Upload a CSV to the pipeline for ML training."""
    try:
        with open(filepath, "rb") as f:
            resp = requests.post(
                f"{pipeline_url}/admin/ml/process-dataset",
                files={"file": (filepath.name, f, "text/csv")},
                data={"industry_type": domain, "use_claude": "false"},
                headers={"x-admin-key": admin_key},
                timeout=60,
            )
        if resp.status_code == 200:
            data = resp.json()
            logger.info("Processed %s: %d columns, %d rows, %d samples saved",
                        filepath.name, data.get("columns", 0), data.get("rows", 0), data.get("samples_saved", 0))
            return True
        else:
            logger.warning("Process failed for %s: %s", filepath.name, resp.text[:200])
            return False
    except Exception as e:
        logger.warning("Process error for %s: %s", filepath.name, e)
        return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch German business datasets for ML training")
    parser.add_argument("--output", default="training_data", help="Output directory for CSVs")
    parser.add_argument("--process", action="store_true", help="Process datasets through pipeline after download")
    parser.add_argument("--pipeline-url", default="http://localhost:8001", help="Pipeline service URL")
    parser.add_argument("--admin-key", default="datalaser-admin-dev", help="Admin API key")
    parser.add_argument("--skip-genesis", action="store_true", help="Skip GENESIS downloads (may require auth)")
    parser.add_argument("--synthetic-only", action="store_true", help="Only generate synthetic datasets")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)

    all_files: list[tuple[Path, str]] = []  # (filepath, domain)

    # 1. Generate synthetic datasets (guaranteed to work)
    logger.info("=== Generating synthetic German business datasets ===")
    synthetic = generate_synthetic_datasets(output_dir)
    domain_map = {
        "synth_fertigungsauftraege.csv": "manufacturing",
        "synth_bestellungen.csv": "commerce",
        "synth_kostenstellenrechnung.csv": "finance",
        "synth_personalstammdaten.csv": "services",
        "synth_reklamationen.csv": "manufacturing",
        "synth_lieferungen.csv": "commerce",
        "synth_energieverbrauch.csv": "energy",
        "synth_chargenprotokoll.csv": "life_sciences",
        "synth_filialumsaetze.csv": "commerce",
        "synth_kreditportfolio.csv": "finance",
    }
    for f in synthetic:
        all_files.append((f, domain_map.get(f.name, "services")))

    if not args.synthetic_only:
        # 2. Direct CSV downloads
        logger.info("=== Downloading direct CSV sources ===")
        for item in DIRECT_DOWNLOADS:
            path = fetch_direct_csv(item, output_dir)
            if path:
                all_files.append((path, item["domain"]))
            time.sleep(1)

        # 3. GENESIS downloads
        if not args.skip_genesis:
            logger.info("=== Downloading GENESIS-Online tables ===")
            for table_code, domain, description in GENESIS_TABLES:
                path = fetch_genesis_table(table_code, output_dir)
                if path:
                    all_files.append((path, domain))
                time.sleep(2)  # rate limit

    logger.info("=== Downloaded %d datasets total ===", len(all_files))

    # 4. Process through pipeline
    if args.process:
        logger.info("=== Processing datasets through pipeline ===")
        success = 0
        for filepath, domain in all_files:
            if process_dataset(filepath, domain, args.pipeline_url, args.admin_key):
                success += 1
            time.sleep(0.5)
        logger.info("=== Processed %d/%d datasets ===", success, len(all_files))
    else:
        logger.info("Datasets saved to %s. Run with --process to upload to pipeline.", output_dir)
        for filepath, domain in all_files:
            logger.info("  %s [%s]", filepath.name, domain)


if __name__ == "__main__":
    main()
