/**
 * German translations for engine-generated findings.
 * The backend returns English text. This maps patterns to German equivalents.
 * Pattern matching preserves all numbers, column names, and statistical values.
 */

type FindingTranslator = (text: string) => string | null

/**
 * Each translator tries to match a pattern and returns the German version,
 * or null if it doesn't match. First match wins.
 */
const GERMAN_TRANSLATORS: FindingTranslator[] = [
  // Quality scorecard
  (t) => {
    const m = t.match(/^Dataset has ([\d,]+) rows across (\d+) columns — (\d+)\/(\d+) columns are fully complete\./)
    return m ? `Datensatz hat ${m[1]} Zeilen über ${m[2]} Spalten — ${m[3]}/${m[4]} Spalten sind vollständig.` : null
  },
  (t) => {
    const m = t.match(/^Completeness score: ([\d.]+)% — average ([\d.]+)% null rate per column\./)
    return m ? `Vollständigkeit: ${m[1]}% — durchschnittlich ${m[2]}% Nullwerte pro Spalte.` : null
  },
  (t) => {
    const m = t.match(/^Consistency score: ([\d.]+)% — (\d+) columns have mixed data types\./)
    return m ? `Konsistenz: ${m[1]}% — ${m[2]} Spalten haben gemischte Datentypen.` : null
  },
  (t) => {
    const m = t.match(/^Validity score: ([\d.]+)% — (\d+) columns contain statistical outliers\./)
    return m ? `Validität: ${m[1]}% — ${m[2]} Spalten enthalten statistische Ausreißer.` : null
  },

  // Correlation
  (t) => {
    const m = t.match(/^Tested (\d+) variable pairs — (\d+) statistically significant/)
    return m ? `${m[1]} Variablenpaare getestet — ${m[2]} statistisch signifikant (p<0,05).` : null
  },
  (t) => {
    const m = t.match(/^Strongest correlation: (.+?) ↔ (.+?) \(r=([-\d.]+), (\w+), p=([^)]+)\)/)
    return m ? `Stärkste Korrelation: ${m[1]} ↔ ${m[2]} (r=${m[3]}, ${m[4]}, p=${m[5]}).` : null
  },
  (t) => {
    const m = t.match(/^Second strongest: (.+?) ↔ (.+?) \(r=([-\d.]+), (\w+)\)/)
    return m ? `Zweitstärkste: ${m[1]} ↔ ${m[2]} (r=${m[3]}, ${m[4]}).` : null
  },

  // Distribution
  (t) => {
    const m = t.match(/^Profiled (\d+) numeric columns — (\d+) normally distributed, (\d+) skewed/)
    return m ? `${m[1]} numerische Spalten analysiert — ${m[2]} normalverteilt, ${m[3]} schief.` : null
  },
  (t) => {
    const m = t.match(/^Most skewed: (.+?) \(skewness=([-\d.]+), (.+?)\) — median ([\d.]+) vs mean ([\d.]+)/)
    return m ? `Am schiefsten: ${m[1]} (Schiefe=${m[2]}, ${m[3]}) — Median ${m[4]} vs Mittelwert ${m[5]}.` : null
  },
  (t) => {
    const m = t.match(/^(.+?) fails normality test \(p=([\d.]+)\)/)
    return m ? `${m[1]} besteht den Normalitätstest nicht (p=${m[2]}) — nicht-parametrische Tests empfohlen.` : null
  },

  // Outliers
  (t) => {
    const m = t.match(/^Found ([\d,]+) total outliers across (\d+) columns/)
    return m ? `${m[1]} Ausreißer insgesamt in ${m[2]} Spalten gefunden.` : null
  },
  (t) => {
    const m = t.match(/^Worst: (.+?) — ([\d,]+) outliers \(([\d.]+)%\) outside \[([^\]]+)\]/)
    return m ? `Auffälligster: ${m[1]} — ${m[2]} Ausreißer (${m[3]}%) außerhalb [${m[4]}].` : null
  },
  (t) => {
    const m = t.match(/^(\d+) columns have HIGH severity/)
    return m ? `${m[1]} Spalten mit HOHER Schwere (>5% Ausreißer).` : null
  },

  // Segment comparison
  (t) => {
    const m = t.match(/^Tested (\d+) dimension×measure pairs — (\d+) statistically significant/)
    return m ? `${m[1]} Dimension×Kennzahl-Paare getestet — ${m[2]} statistisch signifikant (p<0,05).` : null
  },
  (t) => {
    const m = t.match(/^(.+?) differs significantly across (.+?) \(F=([\d.]+), p=([^,]+), effect=(\w+)\)/)
    return m ? `${m[1]} unterscheidet sich signifikant nach ${m[2]} (F=${m[3]}, p=${m[4]}, Effekt=${m[5]}).` : null
  },
  (t) => {
    const m = t.match(/^Highest: (.+?) \(mean=([\d.]+)\) — Lowest: (.+?) \(mean=([\d.]+)\) — ([\d.]+)x difference/)
    return m ? `Höchster: ${m[1]} (Mittelwert=${m[2]}) — Niedrigster: ${m[3]} (Mittelwert=${m[4]}) — ${m[5]}x Unterschied.` : null
  },

  // Time trend
  (t) => {
    const m = t.match(/^Trend is (increasing|decreasing|flat) — (.+?) changed ([+-][\d.]+)% from ([\d.]+) to ([\d.]+)/)
    const dir: Record<string, string> = { increasing: 'steigend', decreasing: 'fallend', flat: 'stabil' }
    return m ? `Trend ist ${dir[m[1]] || m[1]} — ${m[2]} veränderte sich um ${m[3]}% von ${m[4]} auf ${m[5]}.` : null
  },

  // Association
  (t) => {
    const m = t.match(/^Strongest association: (.+?) × (.+?) \(Cramér's V=([\d.]+), (\w+), p=([^)]+)\)/)
    return m ? `Stärkste Assoziation: ${m[1]} × ${m[2]} (Cramérs V=${m[3]}, ${m[4]}, p=${m[5]}).` : null
  },

  // Pareto
  (t) => {
    const m = t.match(/^(\d+) of (\d+) categories \(([\d.]+)%\) account for 80% of total (.+?)\./)
    return m ? `${m[1]} von ${m[2]} Kategorien (${m[3]}%) machen 80% des gesamten ${m[4]} aus.` : null
  },
  (t) => {
    const m = t.match(/^Top category '(.+?)' alone accounts for ([\d.]+)% of total \(([\d,.]+)\)/)
    return m ? `Top-Kategorie '${m[1]}' macht allein ${m[2]}% des Gesamtwerts (${m[3]}) aus.` : null
  },

  // Revenue driver
  (t) => {
    const m = t.match(/^Analyzed (\d+) dimensions as potential (.+?) drivers — (\d+) significant/)
    return m ? `${m[1]} Dimensionen als potenzielle ${m[2]}-Treiber analysiert — ${m[3]} signifikant.` : null
  },
  (t) => {
    const m = t.match(/^Strongest driver: (.+?) \(η²=([\d.]+), (\w+) effect\) — (.+?) averages ([\d,.]+) vs (.+?) at ([\d,.]+)/)
    return m ? `Stärkster Treiber: ${m[1]} (η²=${m[2]}, ${m[3]} Effekt) — ${m[4]} durchschnittlich ${m[5]} vs ${m[6]} bei ${m[7]}.` : null
  },

  // Profitability
  (t) => {
    const m = t.match(/^Average margin: ([\d.]+)% \(median: ([\d.]+)%\) across ([\d,]+) transactions/)
    return m ? `Durchschnittliche Marge: ${m[1]}% (Median: ${m[2]}%) über ${m[3]} Transaktionen.` : null
  },
  (t) => {
    const m = t.match(/^([\d.]+)% of transactions have negative margins/)
    return m ? `${m[1]}% der Transaktionen haben negative Margen (Verlustgeschäfte).` : null
  },
  (t) => {
    const m = t.match(/^Best margin segment: (.+?) \(([\d.]+)%\) — Worst: (.+?) \(([\d.]+)%\)/)
    return m ? `Bestes Margensegment: ${m[1]} (${m[2]}%) — Schlechtestes: ${m[3]} (${m[4]}%).` : null
  },

  // Customer concentration
  (t) => {
    const m = t.match(/^Customer concentration risk: (HIGH|MODERATE|LOW) \(HHI=([\d.]+), Gini=([\d.]+)\)/)
    const risk: Record<string, string> = { HIGH: 'HOCH', MODERATE: 'MITTEL', LOW: 'NIEDRIG' }
    return m ? `Kundenkonzentrationsrisiko: ${risk[m[1]] || m[1]} (HHI=${m[2]}, Gini=${m[3]}).` : null
  },
  (t) => {
    const m = t.match(/^Top 3 customers account for ([\d.]+)% of total (.+?) \(([\d,.]+) total across ([\d,]+) customers\)/)
    return m ? `Die 3 größten Kunden machen ${m[1]}% des gesamten ${m[2]} aus (${m[3]} insgesamt bei ${m[4]} Kunden).` : null
  },
  (t) => {
    const m = t.match(/^Largest customer '(.+?)' alone represents ([\d.]+)% of revenue/)
    return m ? `Größter Kunde '${m[1]}' allein repräsentiert ${m[2]}% des Umsatzes.` : null
  },

  // Budget vs Actual
  (t) => {
    const m = t.match(/^Total variance: ([\d,.+-]+) \(([+-][\d.]+)%\) — Budget: ([\d,.]+), Actual: ([\d,.]+)/)
    return m ? `Gesamtabweichung: ${m[1]} (${m[2]}%) — Soll: ${m[3]}, Ist: ${m[4]}.` : null
  },
  (t) => {
    const m = t.match(/^([\d.]+)% of line items exceed budget/)
    return m ? `${m[1]}% der Positionen überschreiten das Budget.` : null
  },

  // Generic ANOVA
  (t) => {
    const m = t.match(/^ANOVA: (.+?) by (.+?) — F=([\d.]+), p=([^,]+), η²=([\d.]+) \((\w+) effect\)/)
    return m ? `ANOVA: ${m[1]} nach ${m[2]} — F=${m[3]}, p=${m[4]}, η²=${m[5]} (${m[6]} Effekt).` : null
  },
  (t) => {
    const m = t.match(/^Highest: (.+?) \(mean=([\d.]+), n=(\d+)\) — Lowest: (.+?) \(mean=([\d.]+), n=(\d+)\)/)
    return m ? `Höchster: ${m[1]} (Mittelwert=${m[2]}, n=${m[3]}) — Niedrigster: ${m[4]} (Mittelwert=${m[5]}, n=${m[6]}).` : null
  },

  // Generic measure
  (t) => {
    const m = t.match(/^(.+?): mean=([\d,.]+), median=([\d,.]+), std=([\d,.]+) across ([\d,]+) values/)
    return m ? `${m[1]}: Mittelwert=${m[2]}, Median=${m[3]}, Std=${m[4]} über ${m[5]} Werte.` : null
  },
  (t) => {
    const m = t.match(/^Range: ([\d,.]+) to ([\d,.]+)/)
    return m ? `Bereich: ${m[1]} bis ${m[2]}.` : null
  },
  (t) => {
    const m = t.match(/^Outliers: ([\d,]+) values \(([\d.]+)%\) outside \[([^\]]+)\]/)
    return m ? `Ausreißer: ${m[1]} Werte (${m[2]}%) außerhalb [${m[3]}].` : null
  },
  (t) => {
    const m = t.match(/^Distribution shape: (.+?) \(skewness=([-\d.]+)\)/)
    return m ? `Verteilungsform: ${m[1]} (Schiefe=${m[2]}).` : null
  },

  // Auto-analyzer insight headlines
  (t) => {
    const m = t.match(/^(.+?) and (.+?) are (.+?)ly correlated \(r=([-\d.]+), p=([^)]+)\)/)
    return m ? `${m[1]} und ${m[2]} sind ${m[3]} korreliert (r=${m[4]}, p=${m[5]}).` : null
  },
  (t) => {
    const m = t.match(/^(.+?) differs significantly across (.+?) — (.+?) averages ([\d.]+) vs (.+?) at ([\d.]+) \(([\d.]+)x\)/)
    return m ? `${m[1]} unterscheidet sich signifikant nach ${m[2]} — ${m[3]} durchschnittlich ${m[4]} vs ${m[5]} bei ${m[6]} (${m[7]}x).` : null
  },
  (t) => {
    const m = t.match(/^(.+?) has (\d+) outliers \(([\d.]+)% of values\) outside \[([^\]]+)\]/)
    return m ? `${m[1]} hat ${m[2]} Ausreißer (${m[3]}% der Werte) außerhalb [${m[4]}].` : null
  },
  (t) => {
    const m = t.match(/^(.+?) is (.+?) \(skewness=([-\d.]+)\) — median ([\d.]+) vs mean ([\d.]+)/)
    return m ? `${m[1]} ist ${m[2]} (Schiefe=${m[3]}) — Median ${m[4]} vs Mittelwert ${m[5]}.` : null
  },
  (t) => {
    const m = t.match(/^(.+?) and (.+?) are significantly associated \(Cramer's V=([\d.]+), p=([^)]+)\)/)
    return m ? `${m[1]} und ${m[2]} sind signifikant assoziiert (Cramérs V=${m[3]}, p=${m[4]}).` : null
  },
  (t) => {
    const m = t.match(/^'(.+?)' dominates (.+?) across (.+?) — ([\d.]+)% of total/)
    return m ? `'${m[1]}' dominiert ${m[2]} über ${m[3]} — ${m[4]}% des Gesamtwerts.` : null
  },
  (t) => {
    const m = t.match(/^(.+?) strongly influences (.+?) — '(.+?)' has ([\d.]+)% rate vs '(.+?)' at ([\d.]+)%/)
    return m ? `${m[1]} beeinflusst ${m[2]} stark — '${m[3]}' hat ${m[4]}% Rate vs '${m[5]}' bei ${m[6]}%.` : null
  },
  (t) => {
    const m = t.match(/^(.+?) is (increasing|decreasing|flat) — ([+-][\d.]+)% change over (\d+) data points/)
    const dir: Record<string, string> = { increasing: 'steigend', decreasing: 'fallend', flat: 'stabil' }
    return m ? `${m[1]} ist ${dir[m[2]] || m[2]} — ${m[3]}% Veränderung über ${m[4]} Datenpunkte.` : null
  },
  (t) => {
    const m = t.match(/^Data naturally segments into (\d+) clusters/)
    return m ? `Daten segmentieren sich natürlich in ${m[1]} Cluster.` : null
  },
  (t) => {
    const m = t.match(/^(.+?) peaks on (.+?) \(avg=([\d.]+)\) and dips on (.+?) \(avg=([\d.]+)\)/)
    return m ? `${m[1]} erreicht Höchstwerte am ${m[2]} (Ø=${m[3]}) und Tiefstwerte am ${m[4]} (Ø=${m[5]}).` : null
  },
  (t) => {
    const m = t.match(/^'(.+?)' is the top contributor to (.+?) by (.+?) — ([\d.]+)% of total/)
    return m ? `'${m[1]}' ist der größte Beitrag zu ${m[2]} nach ${m[3]} — ${m[4]}% des Gesamtwerts.` : null
  },
  (t) => {
    const m = t.match(/^(.+?) is forecast to (increase|decrease)/)
    const dir: Record<string, string> = { increase: 'steigen', decrease: 'fallen' }
    return m ? t.replace(`is forecast to ${m[2]}`, `wird voraussichtlich ${dir[m[2]] || m[2]}`) : null
  },
  (t) => {
    const m = t.match(/^(.+?) leads (.+?) by (\d+) periods/)
    return m ? t.replace('leads', 'führt').replace('periods', 'Perioden').replace('at lag vs', 'bei Verzögerung vs').replace('at zero', 'bei Null').replace('stronger', 'stärker') : null
  },
  (t) => {
    const m = t.match(/^(.+?) shows a significant shift/)
    return m ? t.replace('shows a significant shift at index', 'zeigt einen signifikanten Wechsel bei Index').replace('mean changed from', 'Mittelwert änderte sich von').replace('to', 'auf') : null
  },
  (t) => {
    const m = t.match(/^(.+?) shows recurring pattern/)
    return m ? t.replace('shows recurring pattern with period', 'zeigt wiederkehrendes Muster mit Periode').replace('autocorrelation', 'Autokorrelation') : null
  },
]

/**
 * Translate an English finding to German using pattern matching.
 * Returns the original text if no pattern matches.
 */
export function translateFinding(text: string | unknown, locale: string): string {
  if (typeof text !== 'string') return String(text ?? '')
  if (locale !== 'de') return text

  for (const translator of GERMAN_TRANSLATORS) {
    const result = translator(text)
    if (result !== null) return result
  }

  // Fallback: return English (better than broken German)
  return text
}

/**
 * Translate an array of findings. Handles both plain strings and structured {text, key, args} objects.
 */
export function translateFindings(findings: (string | { text: string; key?: string; args?: Record<string, string> })[], locale: string): string[] {
  return findings.map(f => {
    const text = typeof f === 'string' ? f : f.text
    return translateFinding(text, locale)
  })
}
