import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  smartFormat,
  createFormatter,
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from '@/lib/formatNumber'

describe('formatNumber', () => {
  describe('German locale', () => {
    it('formats 1234.56 as "1.234,56"', () => {
      expect(formatNumber(1234.56, { locale: 'de', decimals: 2 })).toBe('1.234,56')
    })

    it('formats integer without decimals', () => {
      expect(formatNumber(1234, { locale: 'de' })).toBe('1.234')
    })
  })

  describe('English locale', () => {
    it('formats 1234.56 as "1,234.56"', () => {
      expect(formatNumber(1234.56, { locale: 'en', decimals: 2 })).toBe('1,234.56')
    })

    it('formats integer without decimals', () => {
      expect(formatNumber(1234, { locale: 'en' })).toBe('1,234')
    })
  })

  describe('abbreviation / compact', () => {
    it('abbreviates 1500000 with compact notation', () => {
      const result = formatNumber(1500000, { abbreviate: true, locale: 'en' })
      // Intl compact notation: "1.5M"
      expect(result).toMatch(/1\.5M|1,5\sMio/)
    })

    it('abbreviates 2500 with compact notation', () => {
      const result = formatNumber(2500, { abbreviate: true, locale: 'en' })
      expect(result).toMatch(/2\.5K|2,5K/)
    })

    it('abbreviates with German locale', () => {
      const result = formatNumber(1500000, { abbreviate: true, locale: 'de' })
      // German compact: "1,5 Mio." or similar
      expect(result).toBeTruthy()
      expect(result).not.toBe('–')
    })
  })

  describe('currency formatting', () => {
    it('formats EUR currency', () => {
      const result = formatNumber(1234, { currency: 'EUR', locale: 'de' })
      expect(result).toContain('1.234')
      expect(result).toMatch(/€/)
    })

    it('formats USD currency', () => {
      const result = formatNumber(1234, { currency: 'USD', locale: 'en' })
      expect(result).toContain('1,234')
      expect(result).toMatch(/\$/)
    })

    it('formats currency with compact notation', () => {
      const result = formatNumber(1500000, { currency: 'USD', locale: 'en', compact: true })
      expect(result).toMatch(/\$/)
      expect(result).toMatch(/1\.5M|2M|1M/)
    })
  })

  describe('percentage formatting', () => {
    it('formats percentage with default 1 decimal', () => {
      expect(formatNumber(45.3, { percent: true, locale: 'en' })).toBe('45.3%')
    })

    it('formats percentage in German locale', () => {
      expect(formatNumber(45.3, { percent: true, locale: 'de' })).toBe('45,3%')
    })

    it('formats percentage with custom decimals', () => {
      expect(formatNumber(45.678, { percent: true, decimals: 2, locale: 'en' })).toBe('45.68%')
    })
  })

  describe('sign display', () => {
    it('shows + sign for positive numbers', () => {
      const result = formatNumber(42, { sign: true, locale: 'en' })
      expect(result).toContain('+')
    })

    it('shows - sign for negative numbers', () => {
      const result = formatNumber(-42, { sign: true, locale: 'en' })
      expect(result).toMatch(/-|−/)
    })
  })

  describe('null/undefined/NaN handling', () => {
    it('returns en-dash for null', () => {
      expect(formatNumber(null)).toBe('–')
    })

    it('returns en-dash for undefined', () => {
      expect(formatNumber(undefined)).toBe('–')
    })

    it('returns en-dash for NaN', () => {
      expect(formatNumber(NaN)).toBe('–')
    })
  })

  describe('edge cases', () => {
    it('formats 0', () => {
      expect(formatNumber(0, { locale: 'en' })).toBe('0')
    })

    it('formats negative numbers', () => {
      const result = formatNumber(-1234.56, { locale: 'en', decimals: 2 })
      expect(result).toMatch(/-1,234\.56|−1,234\.56/)
    })

    it('formats very large numbers', () => {
      const result = formatNumber(1000000000, { locale: 'en' })
      expect(result).toBe('1,000,000,000')
    })

    it('formats small decimals', () => {
      expect(formatNumber(0.001, { locale: 'en', decimals: 3 })).toBe('0.001')
    })
  })
})

describe('smartFormat', () => {
  it('returns en-dash for null', () => {
    expect(smartFormat(null)).toBe('–')
  })

  it('returns en-dash for undefined', () => {
    expect(smartFormat(undefined)).toBe('–')
  })

  it('returns en-dash for NaN', () => {
    expect(smartFormat(NaN)).toBe('–')
  })

  it('returns "0" for zero', () => {
    expect(smartFormat(0)).toBe('0')
  })

  it('abbreviates numbers >= 10000', () => {
    const result = smartFormat(15000, 'en')
    expect(result).toMatch(/15K|15,0K/)
  })

  it('formats numbers >= 1000 without decimals', () => {
    const result = smartFormat(1500, 'en')
    expect(result).toBe('1,500')
  })

  it('formats numbers >= 1 with up to 2 decimals', () => {
    expect(smartFormat(3.14, 'en')).toBe('3.14')
  })

  it('formats small numbers >= 0.01 with up to 3 decimals', () => {
    expect(smartFormat(0.025, 'en')).toBe('0.025')
  })

  it('uses exponential for very small numbers', () => {
    expect(smartFormat(0.001, 'en')).toMatch(/e/)
  })

  it('formats with German locale', () => {
    const result = smartFormat(1500, 'de')
    expect(result).toBe('1.500')
  })
})

describe('createFormatter', () => {
  it('creates a formatter object with expected methods', () => {
    const fmt = createFormatter('en')
    expect(fmt).toHaveProperty('tick')
    expect(fmt).toHaveProperty('tooltip')
    expect(fmt).toHaveProperty('currency')
    expect(fmt).toHaveProperty('percent')
    expect(fmt).toHaveProperty('compact')
  })

  it('tick and tooltip use smartFormat', () => {
    const fmt = createFormatter('en')
    expect(fmt.tick(1500)).toBe(smartFormat(1500, 'en'))
    expect(fmt.tooltip(1500)).toBe(smartFormat(1500, 'en'))
  })

  it('currency uses default currency for locale', () => {
    const fmt = createFormatter('en')
    const result = fmt.currency(1234)
    expect(result).toMatch(/\$/)
  })

  it('percent formats as percentage', () => {
    const fmt = createFormatter('en')
    expect(fmt.percent(45.3)).toBe('45.3%')
  })

  it('compact abbreviates', () => {
    const fmt = createFormatter('en')
    const result = fmt.compact(1500000)
    expect(result).toMatch(/1\.5M|2M/)
  })
})

describe('formatDate', () => {
  const date = new Date(2026, 2, 23) // March 23, 2026

  it('formats date in English locale (MM/DD/YYYY)', () => {
    expect(formatDate(date, 'en')).toBe('03/23/2026')
  })

  it('formats date in German locale (DD.MM.YYYY)', () => {
    expect(formatDate(date, 'de')).toBe('23.03.2026')
  })

  it('formats date string input', () => {
    expect(formatDate('2026-03-23', 'en')).toBe('03/23/2026')
  })

  it('returns en-dash for null', () => {
    expect(formatDate(null)).toBe('–')
  })

  it('returns en-dash for undefined', () => {
    expect(formatDate(undefined)).toBe('–')
  })

  it('returns en-dash for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('–')
  })
})

describe('formatDateTime', () => {
  it('returns en-dash for null', () => {
    expect(formatDateTime(null)).toBe('–')
  })

  it('returns en-dash for invalid date', () => {
    expect(formatDateTime('invalid')).toBe('–')
  })

  it('includes time components', () => {
    const date = new Date(2026, 2, 23, 14, 30)
    const result = formatDateTime(date, 'en')
    // Should include date and time
    expect(result).toContain('03/23/2026')
  })
})

describe('formatRelativeTime', () => {
  it('returns en-dash for null', () => {
    expect(formatRelativeTime(null)).toBe('–')
  })

  it('returns en-dash for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('–')
  })

  it('returns en-dash for invalid date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('–')
  })

  it('returns "just now" for very recent dates in English', () => {
    const now = new Date()
    expect(formatRelativeTime(now, 'en')).toBe('just now')
  })

  it('returns "gerade eben" for very recent dates in German', () => {
    const now = new Date()
    expect(formatRelativeTime(now, 'de')).toBe('gerade eben')
  })

  it('formats minutes ago', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000)
    const result = formatRelativeTime(tenMinsAgo, 'en')
    expect(result).toMatch(/10 minutes ago/)
  })

  it('formats hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const result = formatRelativeTime(threeHoursAgo, 'en')
    expect(result).toMatch(/3 hours ago/)
  })
})
