import { NextRequest, NextResponse } from 'next/server'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

const FULL_NOTEBOOK_PROMPT = `You are a senior data analyst creating a complete professional analysis notebook.

Return ONLY a valid JSON array of cells. No markdown fences. No explanation outside the JSON.

Cell schema:
[
  {"type": "heading", "level": 1, "content": "string"},
  {"type": "heading", "level": 2, "content": "string"},
  {"type": "text", "content": "string"},
  {"type": "python", "code": "string"}
]

STRICT RULES FOR PYTHON CODE CELLS:
1. Minimum 10 lines of real code per cell
2. Always import libraries at top of each cell (import pandas as pd, import numpy as np, etc)
3. Store main result in variable called 'result'
4. result must be one of:
   - A pandas DataFrame (for tables)
   - A dict with 'chart_type','data','x_key','y_keys','title' (for charts)
   - A dict of numeric values (for stats tables)
5. Use .dropna() before any statistical operations
6. Use exact column names from the schema provided
7. Handle edge cases (check column exists, check len > 0)
8. Add comments explaining each major step
9. NEVER use plt.show(), display(), or print() for charts
10. For statistical tests use scipy.stats

CHART DATA FORMAT:
result = {
    'chart_type': 'bar',
    'data': df_grouped.reset_index().to_dict(orient='records'),
    'x_key': 'column_name',
    'y_keys': ['value_column'],
    'title': 'Descriptive chart title'
}

NOTEBOOK STRUCTURE — generate ALL sections:
1. H1 title + text intro
2. H2 Data Overview + python descriptive stats + text interpretation
3. H2 Main Analysis + text methodology + python statistical code + text interpretation
4. H2 Visualisation + python chart code + text what it reveals
5. H2 Statistical Testing + text why + python formal test + text interpretation
6. H2 Conclusion + text summary with recommendations

Generate minimum 14 cells. Thorough is better than brief.`

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

      const userMsg = `Analysis request: ${question}\n\nDataset context:\n${schemaContext}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 4000,
          system: FULL_NOTEBOOK_PROMPT,
          messages: [{ role: 'user', content: userMsg }],
        }),
      })

      const data = await res.json()
      let text = data.content?.[0]?.text?.trim() || '[]'
      if (text.startsWith('```')) { text = text.split('```')[1]; if (text.startsWith('json')) text = text.slice(4) }
      text = text.trim()

      try {
        const cells = JSON.parse(text)
        return NextResponse.json({ cells, type: 'full_notebook' })
      } catch {
        return NextResponse.json({ cells: [], type: 'full_notebook', error: 'Failed to parse notebook' })
      }
    }

    // Single cell suggestion via pipeline service
    const enhanced = question + (schemaContext ? `\n\nDataset context:\n${schemaContext}` : '')
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
