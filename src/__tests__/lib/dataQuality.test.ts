import { describe, it, expect } from 'vitest'
import { assessDataQuality } from '@/lib/dataQuality'
import type { DataQualityReport, ColumnWarning } from '@/lib/dataQuality'

function makeColumn(overrides: Partial<{
  name: string
  dtype: string
  nullRate: number
  uniqueRate: number
  mixedTypes: boolean
  formatIssues: boolean
  totalValues: number
}> = {}) {
  return {
    name: overrides.name ?? 'col1',
    dtype: overrides.dtype ?? 'string',
    nullRate: overrides.nullRate ?? 0,
    uniqueRate: overrides.uniqueRate ?? 1,
    mixedTypes: overrides.mixedTypes ?? false,
    formatIssues: overrides.formatIssues ?? false,
    totalValues: overrides.totalValues ?? 1000,
  }
}

describe('assessDataQuality', () => {
  describe('clean data', () => {
    it('returns "good" level for clean columns', () => {
      const columns = [
        makeColumn({ name: 'id', nullRate: 0 }),
        makeColumn({ name: 'name', nullRate: 0.01 }),
      ]
      const report = assessDataQuality(columns, 1000)
      expect(report.level).toBe('good')
      expect(report.score).toBe(100)
      expect(report.warnings).toHaveLength(0)
      expect(report.canProceed).toBe(true)
      expect(report.upgradePrompt).toBeUndefined()
    })

    it('returns correct summary for good data', () => {
      const report = assessDataQuality([makeColumn()], 1000)
      expect(report.summary).toBe('Your data looks clean. Analysis should be accurate.')
    })
  })

  describe('missing values thresholds', () => {
    it('yellow severity for nullRate > 0.05 and <= 0.2', () => {
      const columns = [makeColumn({ name: 'col1', nullRate: 0.1 })]
      const report = assessDataQuality(columns, 1000)
      const warning = report.warnings.find((w) => w.column === 'col1' && w.issue === 'missing_values')
      expect(warning).toBeDefined()
      expect(warning!.severity).toBe('yellow')
      expect(warning!.detail).toBe('10% of values are missing')
      expect(warning!.affectedRows).toBe(100)
    })

    it('amber severity for nullRate > 0.2 and <= 0.6', () => {
      const columns = [makeColumn({ name: 'col1', nullRate: 0.4 })]
      const report = assessDataQuality(columns, 1000)
      const warning = report.warnings.find((w) => w.column === 'col1' && w.issue === 'missing_values')
      expect(warning).toBeDefined()
      expect(warning!.severity).toBe('amber')
      expect(warning!.detail).toBe('40% of values are missing')
    })

    it('red severity for nullRate > 0.6', () => {
      const columns = [makeColumn({ name: 'col1', nullRate: 0.7 })]
      const report = assessDataQuality(columns, 1000)
      const warning = report.warnings.find((w) => w.column === 'col1' && w.issue === 'missing_values')
      expect(warning).toBeDefined()
      expect(warning!.severity).toBe('red')
    })

    it('no warning for nullRate <= 0.05', () => {
      const columns = [makeColumn({ name: 'col1', nullRate: 0.03 })]
      const report = assessDataQuality(columns, 1000)
      expect(report.warnings).toHaveLength(0)
    })
  })

  describe('mixed types', () => {
    it('generates amber warning for mixed types', () => {
      const columns = [makeColumn({ name: 'price', mixedTypes: true })]
      const report = assessDataQuality(columns, 1000)
      const warning = report.warnings.find((w) => w.issue === 'mixed_types')
      expect(warning).toBeDefined()
      expect(warning!.severity).toBe('amber')
      expect(warning!.detail).toContain('ambiguous')
    })
  })

  describe('format issues', () => {
    it('generates amber warning for format inconsistency', () => {
      const columns = [makeColumn({ name: 'date', formatIssues: true })]
      const report = assessDataQuality(columns, 1000)
      const warning = report.warnings.find((w) => w.issue === 'format_inconsistency')
      expect(warning).toBeDefined()
      expect(warning!.severity).toBe('amber')
    })
  })

  describe('mostly empty', () => {
    it('generates red warning for columns > 80% null', () => {
      const columns = [makeColumn({ name: 'notes', nullRate: 0.85 })]
      const report = assessDataQuality(columns, 1000)
      const warning = report.warnings.find((w) => w.issue === 'mostly_empty')
      expect(warning).toBeDefined()
      expect(warning!.severity).toBe('red')
      expect(warning!.detail).toContain('85%')
    })
  })

  describe('deduplication', () => {
    it('deduplicates by column+issue keeping highest severity', () => {
      // A column with nullRate 0.85 triggers both missing_values (red) and mostly_empty (red)
      // missing_values at 0.85 triggers red (>0.6)
      // Both are different issues so both should appear
      const columns = [makeColumn({ name: 'col', nullRate: 0.85 })]
      const report = assessDataQuality(columns, 1000)
      const missingWarnings = report.warnings.filter(
        (w) => w.column === 'col' && w.issue === 'missing_values'
      )
      // Should be deduplicated to just one missing_values warning
      expect(missingWarnings.length).toBe(1)
      // The kept one should be the highest severity
      expect(missingWarnings[0].severity).toBe('red')
    })
  })

  describe('level calculation', () => {
    it('returns "yellow" when there is 1 amber warning', () => {
      const columns = [makeColumn({ name: 'col', mixedTypes: true })]
      const report = assessDataQuality(columns, 1000)
      expect(report.level).toBe('yellow')
    })

    it('returns "amber" when there are 3+ amber warnings', () => {
      const columns = [
        makeColumn({ name: 'c1', mixedTypes: true }),
        makeColumn({ name: 'c2', mixedTypes: true }),
        makeColumn({ name: 'c3', mixedTypes: true }),
      ]
      const report = assessDataQuality(columns, 1000)
      expect(report.level).toBe('amber')
    })

    it('returns "amber" when there is 1 red warning', () => {
      const columns = [makeColumn({ name: 'col', nullRate: 0.7 })]
      const report = assessDataQuality(columns, 1000)
      expect(report.level).toBe('amber')
    })

    it('returns "red" when there are 2+ red warnings', () => {
      const columns = [
        makeColumn({ name: 'c1', nullRate: 0.85 }),
        makeColumn({ name: 'c2', nullRate: 0.85 }),
      ]
      const report = assessDataQuality(columns, 1000)
      expect(report.level).toBe('red')
    })

    it('returns "red" when 1 red + 2 amber', () => {
      const columns = [
        makeColumn({ name: 'c1', nullRate: 0.7 }),
        makeColumn({ name: 'c2', mixedTypes: true }),
        makeColumn({ name: 'c3', formatIssues: true }),
      ]
      const report = assessDataQuality(columns, 1000)
      expect(report.level).toBe('red')
    })
  })

  describe('score calculation', () => {
    it('score is 100 for clean data', () => {
      const report = assessDataQuality([makeColumn()], 1000)
      expect(report.score).toBe(100)
    })

    it('subtracts 5 per yellow warning', () => {
      const columns = [makeColumn({ name: 'col', nullRate: 0.1 })]
      const report = assessDataQuality(columns, 1000)
      expect(report.score).toBe(95)
    })

    it('subtracts 10 per amber warning', () => {
      const columns = [makeColumn({ name: 'col', mixedTypes: true })]
      const report = assessDataQuality(columns, 1000)
      expect(report.score).toBe(90)
    })

    it('subtracts 20 per red warning', () => {
      const columns = [makeColumn({ name: 'col', nullRate: 0.7 })]
      const report = assessDataQuality(columns, 1000)
      expect(report.score).toBe(80)
    })

    it('score does not go below 0', () => {
      const columns = Array.from({ length: 10 }, (_, i) =>
        makeColumn({ name: `col${i}`, nullRate: 0.9 })
      )
      const report = assessDataQuality(columns, 1000)
      expect(report.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('canProceed', () => {
    it('is true for good data', () => {
      const report = assessDataQuality([makeColumn()], 1000)
      expect(report.canProceed).toBe(true)
    })

    it('is true for red level when fewer than 4 red warnings', () => {
      // nullRate 0.7 generates only 1 red warning (missing_values), no mostly_empty (needs >0.8)
      const columns = [
        makeColumn({ name: 'c1', nullRate: 0.7 }),
        makeColumn({ name: 'c2', nullRate: 0.7 }),
      ]
      const report = assessDataQuality(columns, 1000)
      expect(report.level).toBe('red')
      // 2 red warnings (missing_values for c1 and c2), below 4 threshold
      expect(report.canProceed).toBe(true)
    })

    it('is false when there are 4+ red severity warnings', () => {
      const columns = Array.from({ length: 4 }, (_, i) =>
        makeColumn({ name: `col${i}`, nullRate: 0.85 })
      )
      const report = assessDataQuality(columns, 1000)
      // Each column generates missing_values (red) and mostly_empty (red) = 8 red warnings
      expect(report.canProceed).toBe(false)
    })
  })

  describe('upgradePrompt', () => {
    it('is undefined for good level', () => {
      const report = assessDataQuality([makeColumn()], 1000)
      expect(report.upgradePrompt).toBeUndefined()
    })

    it('is undefined for yellow level', () => {
      const columns = [makeColumn({ name: 'col', nullRate: 0.1 })]
      const report = assessDataQuality(columns, 1000)
      expect(report.upgradePrompt).toBeUndefined()
    })

    it('is defined for amber level', () => {
      const columns = [
        makeColumn({ name: 'c1', mixedTypes: true }),
        makeColumn({ name: 'c2', mixedTypes: true }),
        makeColumn({ name: 'c3', mixedTypes: true }),
      ]
      const report = assessDataQuality(columns, 1000)
      expect(report.level).toBe('amber')
      expect(report.upgradePrompt).toContain('Enterprise')
    })

    it('is defined for red level', () => {
      const columns = [
        makeColumn({ name: 'c1', nullRate: 0.85 }),
        makeColumn({ name: 'c2', nullRate: 0.85 }),
      ]
      const report = assessDataQuality(columns, 1000)
      expect(report.upgradePrompt).toContain('Enterprise')
    })
  })
})
