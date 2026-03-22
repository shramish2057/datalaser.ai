import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a data analyst. Suggest exactly 3 high-value analyses.
Return ONLY a valid JSON array, no markdown, no explanation:
[{
  "id": "p1",
  "title": "short title under 8 words",
  "description": "one sentence explaining value",
  "operation": "correlation|regression|anova|ttest|chisquare|forecast|descriptive",
  "code": "python code using df, result stored in variable called result",
  "columns_used": ["col1"],
  "priority": 1
}]
Rules:
- If a date/time column exists: suggest time trend (forecast operation)
- If categorical + numeric columns exist: suggest ANOVA
- If 2+ numeric columns: suggest correlation matrix
- If binary 0/1 column exists: suggest chi-square
- Code must be under 10 lines
- Use EXACT column names from the dataset
- Always include a descriptive stats suggestion as one of the 3`

export async function POST(request: NextRequest) {
  try {
    const { columns, quality_score, warnings, source_name } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

    const userMsg = `Dataset: ${source_name}
Columns: ${JSON.stringify(columns)}
Quality score: ${quality_score}
Warnings: ${JSON.stringify(warnings || [])}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    const data = await res.json()
    let text = data.content?.[0]?.text?.trim() || '[]'
    if (text.startsWith('```')) {
      text = text.split('```')[1]
      if (text.startsWith('json')) text = text.slice(4)
    }
    text = text.trim()

    try {
      const suggestions = JSON.parse(text)
      return NextResponse.json(suggestions)
    } catch {
      // Fallback suggestions
      const numericCol = columns?.find((c: { dtype: string }) => c.dtype === 'numeric')?.name || 'value'
      const catCol = columns?.find((c: { dtype: string }) => c.dtype === 'categorical')?.name || 'category'
      return NextResponse.json([
        { id: 'p1', title: 'Descriptive statistics overview', description: 'Summary stats for all numeric columns',
          operation: 'descriptive', code: 'result = df.describe().to_dict()', columns_used: [], priority: 1 },
        { id: 'p2', title: `Distribution of ${numericCol}`, description: `Analyze the distribution of ${numericCol}`,
          operation: 'descriptive', code: `result = df['${numericCol}'].describe().to_dict()`, columns_used: [numericCol], priority: 2 },
        { id: 'p3', title: `${numericCol} by ${catCol}`, description: `Compare ${numericCol} across ${catCol} groups`,
          operation: 'anova', code: `result = df.groupby('${catCol}')['${numericCol}'].agg(['mean','std','count']).to_dict()`,
          columns_used: [numericCol, catCol], priority: 3 },
      ])
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
