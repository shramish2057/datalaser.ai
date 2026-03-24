/**
 * Normalize an insight headline to a plain string.
 *
 * Claude sometimes returns headline as a structured object:
 * { title: "...", metric: "...", severity: "...", description: "..." }
 *
 * This helper always returns a readable string.
 */
export function normalizeHeadline(headline: unknown): string {
  if (typeof headline === 'string') return headline
  if (headline && typeof headline === 'object') {
    const h = headline as Record<string, unknown>
    // Try common fields in order of usefulness
    if (h.description && typeof h.description === 'string') return h.description
    if (h.title && typeof h.title === 'string') {
      const metric = h.metric ? ` (${h.metric})` : ''
      return `${h.title}${metric}`
    }
    // Last resort: JSON
    return JSON.stringify(headline)
  }
  return String(headline ?? '')
}

/**
 * Normalize an array of insights to ensure all headlines are strings.
 */
export function normalizeInsights(
  insights: { type: string; headline: unknown; [key: string]: unknown }[]
): { type: string; headline: string; [key: string]: unknown }[] {
  return insights.map(ins => ({
    ...ins,
    headline: normalizeHeadline(ins.headline),
  }))
}
