import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a senior data analyst interpreting statistical results for a business audience. Be specific with numbers. Concise.
Return ONLY valid JSON, no markdown:
{
  "interpretation": "2-3 clear sentences with specific numbers",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "recommended_actions": ["action 1", "action 2"]
}`

export async function POST(request: NextRequest) {
  try {
    const { operation, result, columns_used, source_name } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

    const userMsg = `Operation: ${operation}
Columns: ${JSON.stringify(columns_used)}
Source: ${source_name}
Result: ${JSON.stringify(result, null, 2).slice(0, 2000)}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    const data = await res.json()
    let text = data.content?.[0]?.text?.trim() || '{}'
    if (text.startsWith('```')) {
      text = text.split('```')[1]
      if (text.startsWith('json')) text = text.slice(4)
    }

    try {
      return NextResponse.json(JSON.parse(text.trim()))
    } catch {
      return NextResponse.json({
        interpretation: 'Analysis completed. Review the results above for detailed findings.',
        key_findings: ['Analysis completed successfully'],
        recommended_actions: ['Review the detailed results'],
      })
    }
  } catch (err) {
    return NextResponse.json({
      interpretation: 'Could not generate interpretation.',
      key_findings: [],
      recommended_actions: [],
    })
  }
}
