import { NextRequest, NextResponse } from 'next/server'
import { getEngineContext, formatFactsForPrompt, getLocaleFromRequest } from '@/lib/ai/engineContext'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

const FULL_NOTEBOOK_PROMPT = `You are a senior data analyst building an analysis notebook that directly answers the user's question.

Return ONLY a valid JSON array of cells. No markdown fences. No explanation outside the JSON.

Cell schema:
[
  {"type": "heading", "level": 1, "content": "string"},
  {"type": "heading", "level": 2, "content": "string"},
  {"type": "text", "content": "string"},
  {"type": "python", "code": "string"}
]

CRITICAL RULES:
1. DIRECTLY ANSWER the user's question. Every section must advance toward answering it.
2. DO NOT repeat the same analysis multiple ways. Each section must reveal something NEW.
3. Text cells BEFORE code: describe methodology/approach (1-2 sentences max).
4. Text cells AFTER code: the code output speaks for itself — only add text if there's a non-obvious insight to highlight. Keep it short.
5. NEVER use placeholder text like "X%", "N correlations", or template language. If you don't know the exact number, don't write the text cell.
6. NEVER use generic describe(), info(), or simple mean/median unless the question specifically asks for it.
7. Maximum 3-4 sections. Quality over quantity. Each section must earn its place.

PYTHON CODE RULES:
1. Always import pandas as pd, numpy as np at top of each cell.
2. Store result in variable called 'result'.
3. result must be ONE of:
   a) Dict with 'chart_type','data','x_key','y_keys','title' (for charts — PREFERRED)
   b) pandas DataFrame (for tables — use for detailed breakdowns)
   c) Dict of numeric values (for key stats)
4. 'data' in charts MUST be a list of dicts: df.to_dict(orient='records')
5. Use .dropna() before statistical ops. Handle edge cases.
6. NEVER use plt.show(), display(), print(), or matplotlib.
7. Use exact column names from the schema.

CHART RULES:
- Available types: 'bar', 'stacked_bar', 'line', 'scatter', 'pie', 'area'
- NO heatmaps (not supported). Use a DataFrame table for correlation matrices.
- Use DIFFERENT chart types across sections — never two bar charts in a row.
- For comparisons, use GROUPED bars with multiple y_keys:
    grouped = df.groupby('Cat').agg(A=('col','sum'), B=('col2','sum')).reset_index()
    result = {'chart_type':'bar', 'data': grouped.to_dict(orient='records'),
              'x_key':'Cat', 'y_keys':['A','B'], 'title':'Title'}
- For proportions, use pie (max 6 slices) or stacked_bar.
- x_key must be a STRING column (category/label), not numeric index.
- y_keys must be NUMERIC columns.
- Limit data to top 10-15 rows for readability.

NOTEBOOK STRUCTURE (generate 10-14 cells total):
1. H1: Sharp analytical title + text: 1-2 sentence context (no fluff)
2. H2: [First angle on the question] + code: chart or table + text: brief insight
3. H2: [Second angle — different cut of the data] + code: DIFFERENT chart type + text: brief insight
4. H2: [Statistical validation if appropriate] + code: formal test + text: interpret significance
5. H2: Summary + text: 3-5 bullet points of concrete findings with numbers

NEVER write filler sections, template conclusions, or academic padding. Be concise and insightful.`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const schemaContext = formData.get('schema_context')?.toString() || ''
    const question = formData.get('question')?.toString() || ''
    const generateFull = formData.get('generate_full_notebook')?.toString() === 'true'

    if (generateFull) {
      // Full notebook generation via Claude directly
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

      // Fetch engine-computed verified facts
      const file = formData.get('file')
      const engineCtx = await getEngineContext(
        undefined, undefined,
        file instanceof Blob ? file : null,
        formData.get('file_type')?.toString(),
      )
      const locale = getLocaleFromRequest(request)
      const verifiedBlock = formatFactsForPrompt(engineCtx.facts, locale)

      const userMsg = `Analysis request: ${question}\n\nDataset context:\n${schemaContext}${verifiedBlock}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 8000,
          system: FULL_NOTEBOOK_PROMPT,
          messages: [{ role: 'user', content: userMsg }],
        }),
      })

      if (!res.ok) {
        const errBody = await res.text()
        console.error('[suggest] Claude API error:', res.status, errBody)
        return NextResponse.json({ cells: [], type: 'full_notebook', error: `Claude API error: ${res.status}` })
      }

      const data = await res.json()
      let text = data.content?.[0]?.text?.trim() || '[]'
      console.log('[suggest] Raw Claude response length:', text.length, 'first 200:', text.slice(0, 200))
      if (text.startsWith('```')) { text = text.split('```')[1]; if (text.startsWith('json')) text = text.slice(4) }
      text = text.trim()

      try {
        const cells = JSON.parse(text)
        console.log('[suggest] Parsed', cells.length, 'cells')
        return NextResponse.json({ cells, type: 'full_notebook' })
      } catch (e) {
        console.error('[suggest] JSON parse failed:', e, 'text start:', text.slice(0, 300))
        return NextResponse.json({ cells: [], type: 'full_notebook', error: 'Failed to parse notebook' })
      }
    }

    // Single cell suggestion via pipeline service
    const singleLocale = getLocaleFromRequest(request)
    const langNote = singleLocale === 'de' ? '\n\n[Antworte auf Deutsch. Verwende deutsche Fachbegriffe.]' : ''
    const enhanced = question + (schemaContext ? `\n\nDataset context:\n${schemaContext}` : '') + langNote
    const outgoing = new FormData()
    const file = formData.get('file')
    if (file instanceof Blob) outgoing.append('file', file, file instanceof File ? file.name : 'data.csv')
    outgoing.append('question', enhanced)
    const fileType = formData.get('file_type')
    if (fileType) outgoing.append('file_type', fileType.toString())

    const res = await fetch(`${PIPELINE_URL}/analyst/suggest-analysis`, { method: 'POST', body: outgoing })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.detail || 'Suggestion failed' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Pipeline service unavailable' }, { status: 503 })
  }
}
