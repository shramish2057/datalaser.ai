/**
 * Shared number formatting utility for DataLaser charts and UI.
 * Locale-aware, supports abbreviations, decimals, currencies, percentages.
 */

type FormatOptions = {
  decimals?: number
  abbreviate?: boolean
  currency?: string  // 'EUR', 'USD', etc.
  percent?: boolean
  locale?: string
  compact?: boolean  // Use Intl compact notation (1.2K, 3.4M)
  sign?: boolean     // Show +/- sign
}

export function formatNumber(value: number | null | undefined, opts: FormatOptions = {}): string {
  if (value === null || value === undefined || isNaN(value)) return '–'

  const {
    decimals,
    abbreviate = false,
    currency,
    percent = false,
    locale = 'de-DE',
    compact = false,
    sign = false,
  } = opts

  // Percentage
  if (percent) {
    const d = decimals ?? 1
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
      signDisplay: sign ? 'exceptZero' : 'auto',
    }).format(value)
    return `${formatted}%`
  }

  // Currency
  if (currency) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 0,
      notation: compact || abbreviate ? 'compact' : 'standard',
      signDisplay: sign ? 'exceptZero' : 'auto',
    }).format(value)
  }

  // Compact / Abbreviate (1.2K, 3.4M, 5.6B)
  if (abbreviate || compact) {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) {
      const d = decimals ?? 1
      return `${sign && value > 0 ? '+' : ''}${(value / 1_000_000_000).toFixed(d)}B`
    }
    if (abs >= 1_000_000) {
      const d = decimals ?? 1
      return `${sign && value > 0 ? '+' : ''}${(value / 1_000_000).toFixed(d)}M`
    }
    if (abs >= 1_000) {
      const d = decimals ?? 1
      return `${sign && value > 0 ? '+' : ''}${(value / 1_000).toFixed(d)}K`
    }
  }

  // Standard formatting
  const d = decimals ?? (Number.isInteger(value) ? 0 : 2)
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(value)
}

/**
 * Smart formatter: auto-detects the best format based on value magnitude.
 * Used as default Recharts tick/tooltip formatter.
 */
export function smartFormat(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '–'
  const abs = Math.abs(value)
  if (abs === 0) return '0'
  if (abs >= 1_000_000) return formatNumber(value, { abbreviate: true, decimals: 1 })
  if (abs >= 10_000) return formatNumber(value, { abbreviate: true, decimals: 1 })
  if (abs >= 1_000) return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value)
  if (abs >= 1) return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value)
  if (abs >= 0.01) return value.toFixed(3)
  return value.toExponential(2)
}

/**
 * Format for chart axis ticks — always abbreviated for compactness.
 */
export function tickFormat(value: number): string {
  return smartFormat(value)
}
