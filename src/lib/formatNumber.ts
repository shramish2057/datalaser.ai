/**
 * Shared number & date formatting utility for DataLaser.
 * Locale-aware: German (1.234,56) vs English (1,234.56).
 */

type FormatOptions = {
  decimals?: number
  abbreviate?: boolean
  currency?: string  // 'EUR', 'USD', 'GBP'
  percent?: boolean
  locale?: string    // 'de-DE', 'en-US', 'en-GB'
  compact?: boolean
  sign?: boolean
}

// Map app locale to Intl locale
const INTL_LOCALE: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  uk: 'en-GB',
}

// Map app locale to default currency
const DEFAULT_CURRENCY: Record<string, string> = {
  de: 'EUR',
  en: 'USD',
  uk: 'GBP',
}

function toIntlLocale(locale?: string): string {
  if (!locale) return 'en-US'
  if (locale.includes('-')) return locale // Already Intl format
  return INTL_LOCALE[locale] || 'en-US'
}

export function formatNumber(value: number | null | undefined, opts: FormatOptions = {}): string {
  if (value === null || value === undefined || isNaN(value)) return '–'

  const {
    decimals,
    abbreviate = false,
    currency,
    percent = false,
    locale,
    compact = false,
    sign = false,
  } = opts

  const intlLocale = toIntlLocale(locale)

  // Percentage
  if (percent) {
    const d = decimals ?? 1
    const formatted = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
      signDisplay: sign ? 'exceptZero' : 'auto',
    }).format(value)
    return `${formatted}%`
  }

  // Currency
  if (currency) {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 0,
      notation: compact || abbreviate ? 'compact' : 'standard',
      signDisplay: sign ? 'exceptZero' : 'auto',
    }).format(value)
  }

  // Compact / Abbreviate
  if (abbreviate || compact) {
    // Use Intl compact notation for locale-correct abbreviations
    // de: 1,2 Tsd. / 3,4 Mio. | en: 1.2K / 3.4M
    try {
      return new Intl.NumberFormat(intlLocale, {
        notation: 'compact',
        maximumFractionDigits: decimals ?? 1,
        signDisplay: sign ? 'exceptZero' : 'auto',
      }).format(value)
    } catch {
      // Fallback for older environments
      const abs = Math.abs(value)
      if (abs >= 1_000_000_000) return `${(value / 1e9).toFixed(decimals ?? 1)}B`
      if (abs >= 1_000_000) return `${(value / 1e6).toFixed(decimals ?? 1)}M`
      if (abs >= 1_000) return `${(value / 1e3).toFixed(decimals ?? 1)}K`
    }
  }

  // Standard formatting
  const d = decimals ?? (Number.isInteger(value) ? 0 : 2)
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(value)
}

/**
 * Smart formatter with locale support.
 * Accepts locale string ('de' or 'en').
 */
export function smartFormat(value: number | null | undefined, locale?: string): string {
  if (value === null || value === undefined || isNaN(value)) return '–'
  const abs = Math.abs(value)
  const intlLocale = toIntlLocale(locale)
  if (abs === 0) return '0'
  if (abs >= 10_000) return formatNumber(value, { abbreviate: true, decimals: 1, locale })
  if (abs >= 1_000) return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 }).format(value)
  if (abs >= 1) return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(value)
  if (abs >= 0.01) return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 3 }).format(value)
  return value.toExponential(2)
}

/**
 * Create a locale-bound formatter for use in Recharts tick/tooltip.
 * Call once with locale, returns a pure function.
 */
export function createFormatter(locale: string = 'en') {
  return {
    tick: (value: number) => smartFormat(value, locale),
    tooltip: (value: number) => smartFormat(value, locale),
    currency: (value: number) => formatNumber(value, { currency: DEFAULT_CURRENCY[locale] || 'USD', locale }),
    percent: (value: number) => formatNumber(value, { percent: true, locale }),
    compact: (value: number) => formatNumber(value, { abbreviate: true, locale }),
  }
}

/**
 * Format a date per locale.
 * de: 23.03.2026 | en: 03/23/2026 | uk: 23/03/2026
 */
export function formatDate(date: Date | string | null | undefined, locale: string = 'en'): string {
  if (!date) return '–'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '–'

  const intlLocale = toIntlLocale(locale)
  return new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * Format a date with time per locale.
 */
export function formatDateTime(date: Date | string | null | undefined, locale: string = 'en'): string {
  if (!date) return '–'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '–'

  const intlLocale = toIntlLocale(locale)
  return new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Format relative time using date-fns with locale support.
 * Import this instead of using date-fns directly.
 */
export async function formatDistanceLocale(date: Date | string, locale: string = 'en'): Promise<string> {
  const { formatDistanceToNow } = await import('date-fns')
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '–'

  if (locale === 'de') {
    const { de } = await import('date-fns/locale')
    return formatDistanceToNow(d, { addSuffix: true, locale: de })
  }
  return formatDistanceToNow(d, { addSuffix: true })
}

/**
 * Format relative time (e.g., "3 hours ago" / "vor 3 Stunden")
 * Synchronous version using Intl.RelativeTimeFormat.
 */
export function formatRelativeTime(date: Date | string | null | undefined, locale: string = 'en'): string {
  if (!date) return '–'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '–'

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  const intlLocale = toIntlLocale(locale)
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' })

  if (diffMins < 1) return locale === 'de' ? 'gerade eben' : 'just now'
  if (diffMins < 60) return rtf.format(-diffMins, 'minute')
  if (diffHours < 24) return rtf.format(-diffHours, 'hour')
  if (diffDays < 30) return rtf.format(-diffDays, 'day')
  return formatDate(d, locale)
}
