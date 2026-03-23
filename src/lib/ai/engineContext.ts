/**
 * Fetches pre-computed engine analysis and formats as verified facts
 * for injection into Claude prompts. This is the core of the
 * "templates power AI" architecture.
 */

import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

interface VerifiedContext {
  facts: string[]
  raw: Record<string, unknown> | null
}

/**
 * Fetch auto-analysis results from Supabase for a source,
 * or run it via the pipeline if not cached.
 */
export async function getEngineContext(
  sourceId?: string,
  projectId?: string,
  file?: Blob | null,
  fileType?: string,
): Promise<VerifiedContext> {
  const empty: VerifiedContext = { facts: [], raw: null }

  // Try fetching cached results from Supabase
  if (sourceId) {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data } = await supabase
        .from('data_sources')
        .select('auto_analysis')
        .eq('id', sourceId)
        .single()

      if (data?.auto_analysis) {
        return formatAnalysis(data.auto_analysis as Record<string, unknown>)
      }
    } catch { /* fall through to pipeline call */ }
  }

  // If we have a file, run auto-analysis via pipeline
  if (file) {
    try {
      const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'
      const fd = new FormData()
      fd.append('file', file, 'data.csv')
      fd.append('file_type', fileType || 'csv')
      if (sourceId) fd.append('source_id', sourceId)

      const res = await fetch(`${PIPELINE_URL}/auto-analysis/run`, { method: 'POST', body: fd })
      if (res.ok) {
        const analysis = await res.json()
        return formatAnalysis(analysis)
      }
    } catch { /* fall through */ }
  }

  return empty
}

/**
 * Format auto-analysis results into [VERIFIED] facts for Claude prompts.
 */
function formatAnalysis(analysis: Record<string, unknown>): VerifiedContext {
  const facts: string[] = []

  // Top insights — these are the highest-quality findings
  const insights = (analysis.top_insights as { headline: string }[]) || []
  for (const ins of insights.slice(0, 6)) {
    facts.push(`[VERIFIED] ${ins.headline}`)
  }

  // Key correlations not in top insights
  const corr = analysis.correlations as { pairs?: { col1: string; col2: string; r: number; significant: boolean }[] }
  if (corr?.pairs) {
    const sigPairs = corr.pairs.filter(p => p.significant).length
    const totalPairs = corr.pairs.length
    if (sigPairs > 0 && !facts.some(f => f.includes('correlated'))) {
      facts.push(`[VERIFIED] ${sigPairs} of ${totalPairs} variable pairs are significantly correlated (p<0.05).`)
    }
  }

  // Clusters
  const clusters = analysis.clusters as { n_clusters?: number; clusters?: { size: number; pct: number }[] }
  if (clusters?.n_clusters && clusters.n_clusters >= 2) {
    facts.push(`[VERIFIED] Data segments into ${clusters.n_clusters} natural clusters.`)
  }

  // Anomalies summary
  const anomalies = (analysis.anomalies as { column: string; outlier_pct: number }[]) || []
  if (anomalies.length > 0) {
    const worst = anomalies[0]
    facts.push(`[VERIFIED] ${anomalies.length} columns have outliers — worst: ${worst.column} (${worst.outlier_pct}% outlier rate).`)
  }

  // Row/column counts
  const rows = analysis.row_count as number
  const cols = analysis.column_count as number
  if (rows && cols) {
    facts.push(`[VERIFIED] Dataset: ${rows.toLocaleString()} rows, ${cols} columns.`)
  }

  return { facts, raw: analysis }
}

/**
 * German language instruction block for Claude.
 * Appended to system prompts when locale is 'de'.
 */
const GERMAN_PROMPT_BLOCK = `
SPRACHE: Antworte IMMER auf Deutsch.
- Verwende deutsche Fachbegriffe (Deckungsbeitrag, Rohertrag, Kennzahl, Ausreißer, Korrelation, etc.)
- Zahlenformat: 1.234,56 (deutsches Format mit Punkt als Tausendertrennzeichen, Komma als Dezimaltrennzeichen)
- Datumsformat: TT.MM.JJJJ
- Währung: € (wenn zutreffend)
- Prozentangaben: 45,3% (mit Komma)
- Statistische Begriffe: Mittelwert, Median, Standardabweichung, Signifikanz, Effektstärke
- Verwende "Sie" (formelle Anrede), nicht "du"
- Alle Überschriften, Erklärungen, Befunde und Empfehlungen auf Deutsch
`

/**
 * Format verified facts as a string block for prompt injection.
 * Includes locale-aware language instruction.
 */
export function formatFactsForPrompt(facts: string[], locale: string = 'en'): string {
  const languageBlock = locale === 'de' ? GERMAN_PROMPT_BLOCK : ''

  if (facts.length === 0) return languageBlock

  return `${languageBlock}
PRE-COMPUTED VERIFIED FACTS (from DataLaser engine — these are TRUE, use them):
${facts.join('\n')}

IMPORTANT: Reference these verified facts in your response. Do NOT contradict them.
When citing numbers, prefer these verified values over any estimates.
`
}

/**
 * Extract locale from request headers or cookies.
 * Used by API routes to determine response language.
 */
export function getLocaleFromRequest(request: Request): string {
  // Check custom header (set by frontend)
  const headerLocale = request.headers.get('x-locale')
  if (headerLocale && ['de', 'en'].includes(headerLocale)) return headerLocale

  // Check cookie
  const cookies = request.headers.get('cookie') || ''
  const match = cookies.match(/dl_locale=(\w+)/)
  if (match && ['de', 'en'].includes(match[1])) return match[1]

  // Check Accept-Language
  const acceptLang = request.headers.get('accept-language') || ''
  if (acceptLang.includes('de')) return 'de'

  return 'en'
}
