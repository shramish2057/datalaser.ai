import { describe, it, expect } from 'vitest'
import { translateFinding, translateFindings } from '@/lib/i18n/findingsMap'

describe('translateFinding', () => {
  describe('non-German locale passthrough', () => {
    it('returns original text when locale is "en"', () => {
      const text = 'Strongest correlation: A ↔ B (r=0.85, strong, p=0.001)'
      expect(translateFinding(text, 'en')).toBe(text)
    })

    it('returns original text when locale is "fr"', () => {
      const text = 'Some finding'
      expect(translateFinding(text, 'fr')).toBe(text)
    })
  })

  describe('unmatched strings', () => {
    it('returns original text for unmatched patterns in German', () => {
      const text = 'This does not match any pattern at all'
      expect(translateFinding(text, 'de')).toBe(text)
    })
  })

  describe('quality scorecard patterns', () => {
    it('translates dataset row/column completeness', () => {
      const input = 'Dataset has 1,234 rows across 12 columns — 10/12 columns are fully complete.'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Datensatz hat 1,234 Zeilen')
      expect(result).toContain('12 Spalten')
      expect(result).toContain('10/12 Spalten sind vollständig')
    })

    it('translates completeness score', () => {
      const input = 'Completeness score: 95.3% — average 4.7% null rate per column.'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Vollständigkeit: 95.3%')
      expect(result).toContain('4.7% Nullwerte pro Spalte')
    })

    it('translates consistency score', () => {
      const input = 'Consistency score: 87.5% — 3 columns have mixed data types.'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Konsistenz: 87.5%')
      expect(result).toContain('3 Spalten haben gemischte Datentypen')
    })

    it('translates validity score', () => {
      const input = 'Validity score: 92.1% — 2 columns contain statistical outliers.'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Validität: 92.1%')
      expect(result).toContain('2 Spalten enthalten statistische Ausreißer')
    })
  })

  describe('correlation patterns', () => {
    it('translates tested variable pairs', () => {
      const input = 'Tested 45 variable pairs — 12 statistically significant (p<0.05).'
      const result = translateFinding(input, 'de')
      expect(result).toContain('45 Variablenpaare getestet')
      expect(result).toContain('12 statistisch signifikant')
    })

    it('translates strongest correlation preserving numbers and column names', () => {
      const input = 'Strongest correlation: Revenue ↔ Customers (r=0.92, strong, p=0.001)'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Stärkste Korrelation: Revenue ↔ Customers')
      expect(result).toContain('r=0.92')
      expect(result).toContain('strong')
      expect(result).toContain('p=0.001')
    })

    it('translates second strongest correlation', () => {
      const input = 'Second strongest: Price ↔ Quantity (r=-0.78, moderate)'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Zweitstärkste: Price ↔ Quantity')
      expect(result).toContain('r=-0.78')
    })
  })

  describe('distribution patterns', () => {
    it('translates profiled numeric columns', () => {
      const input = 'Profiled 8 numeric columns — 5 normally distributed, 3 skewed'
      const result = translateFinding(input, 'de')
      expect(result).toContain('8 numerische Spalten analysiert')
      expect(result).toContain('5 normalverteilt')
      expect(result).toContain('3 schief')
    })

    it('translates most skewed column', () => {
      const input = 'Most skewed: Revenue (skewness=2.34, right-skewed) — median 150.5 vs mean 320.8'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Am schiefsten: Revenue')
      expect(result).toContain('Schiefe=2.34')
      expect(result).toContain('Median 150.5')
      expect(result).toContain('Mittelwert 320.8')
    })

    it('translates normality test failure', () => {
      const input = 'Revenue fails normality test (p=0.002)'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Revenue besteht den Normalitätstest nicht')
      expect(result).toContain('p=0.002')
    })
  })

  describe('outlier patterns', () => {
    it('translates total outliers found', () => {
      const input = 'Found 156 total outliers across 4 columns'
      const result = translateFinding(input, 'de')
      expect(result).toContain('156 Ausreißer insgesamt')
      expect(result).toContain('4 Spalten')
    })

    it('translates worst outlier column', () => {
      const input = 'Worst: Revenue — 42 outliers (3.5%) outside [10.5, 500.2]'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Auffälligster: Revenue')
      expect(result).toContain('42 Ausreißer')
      expect(result).toContain('3.5%')
    })

    it('translates HIGH severity columns', () => {
      const input = '3 columns have HIGH severity'
      const result = translateFinding(input, 'de')
      expect(result).toContain('3 Spalten mit HOHER Schwere')
    })
  })

  describe('segment comparison patterns', () => {
    it('translates dimension x measure pairs', () => {
      const input = 'Tested 20 dimension\u00d7measure pairs — 8 statistically significant'
      const result = translateFinding(input, 'de')
      expect(result).toContain('20 Dimension\u00d7Kennzahl-Paare getestet')
      expect(result).toContain('8 statistisch signifikant')
    })
  })

  describe('time trend patterns', () => {
    it('translates increasing trend', () => {
      const input = 'Trend is increasing — Revenue changed +15.3% from 100.0 to 115.3'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Trend ist steigend')
      expect(result).toContain('Revenue')
      expect(result).toContain('+15.3%')
    })

    it('translates decreasing trend', () => {
      const input = 'Trend is decreasing — Sales changed -8.2% from 200.0 to 183.6'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Trend ist fallend')
    })

    it('translates flat trend', () => {
      const input = 'Trend is flat — Margin changed +0.1% from 50.0 to 50.1'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Trend ist stabil')
    })
  })

  describe('auto-analyzer insight headlines', () => {
    it('translates correlation headline', () => {
      const input = 'Price and Quantity are strongly correlated (r=-0.85, p=0.001)'
      const result = translateFinding(input, 'de')
      // The regex captures (.+?)ly -> group 3 = "strong", output: "sind strong korreliert"
      expect(result).toContain('Price und Quantity sind strong korreliert')
      expect(result).toContain('r=-0.85')
    })

    it('translates clustering headline', () => {
      const input = 'Data naturally segments into 4 clusters'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Daten segmentieren sich natürlich in 4 Cluster')
    })

    it('translates trend headline with increasing', () => {
      const input = 'Revenue is increasing — +12.5% change over 24 data points'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Revenue ist steigend')
      expect(result).toContain('+12.5% Veränderung')
      expect(result).toContain('24 Datenpunkte')
    })

    it('translates dominance headline', () => {
      const input = "'Enterprise' dominates Revenue across Region — 65.2% of total"
      const result = translateFinding(input, 'de')
      expect(result).toContain("'Enterprise' dominiert Revenue")
      expect(result).toContain('65.2% des Gesamtwerts')
    })
  })

  describe('German special characters preservation', () => {
    it('translates Pareto finding with umlauts in output', () => {
      const input = '3 of 10 categories (30.0%) account for 80% of total Revenue.'
      const result = translateFinding(input, 'de')
      expect(result).toContain('3 von 10 Kategorien')
    })

    it('translates customer concentration with umlauts', () => {
      const input = 'Customer concentration risk: HIGH (HHI=0.25, Gini=0.65)'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Kundenkonzentrationsrisiko: HOCH')
      expect(result).toContain('HHI=0.25')
      expect(result).toContain('Gini=0.65')
    })

    it('translates profitability with Durchschnittliche', () => {
      const input = 'Average margin: 12.5% (median: 10.2%) across 5,000 transactions'
      const result = translateFinding(input, 'de')
      expect(result).toContain('Durchschnittliche Marge')
      expect(result).toContain('12.5%')
    })
  })

  describe('number preservation', () => {
    it('preserves all numeric values in correlation translation', () => {
      const input = 'Strongest correlation: A ↔ B (r=0.95, strong, p=0.0001)'
      const result = translateFinding(input, 'de')
      expect(result).toContain('0.95')
      expect(result).toContain('0.0001')
    })

    it('preserves negative numbers', () => {
      const input = 'Second strongest: X ↔ Y (r=-0.72, moderate)'
      const result = translateFinding(input, 'de')
      expect(result).toContain('-0.72')
    })
  })
})

describe('translateFindings', () => {
  it('translates an array of string findings', () => {
    const findings = [
      'Data naturally segments into 3 clusters',
      'This does not match any pattern',
    ]
    const results = translateFindings(findings, 'de')
    expect(results).toHaveLength(2)
    expect(results[0]).toContain('3 Cluster')
    expect(results[1]).toBe('This does not match any pattern')
  })

  it('translates an array of structured findings', () => {
    const findings = [
      { text: 'Data naturally segments into 5 clusters', key: 'cluster' },
    ]
    const results = translateFindings(findings, 'de')
    expect(results[0]).toContain('5 Cluster')
  })

  it('returns English for non-German locale', () => {
    const findings = ['Data naturally segments into 3 clusters']
    const results = translateFindings(findings, 'en')
    expect(results[0]).toBe('Data naturally segments into 3 clusters')
  })

  it('handles mixed string and structured findings', () => {
    const findings = [
      'This is plain text',
      { text: 'Data naturally segments into 2 clusters', key: 'test', args: {} },
    ]
    const results = translateFindings(findings, 'de')
    expect(results).toHaveLength(2)
  })
})
