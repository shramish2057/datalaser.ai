import { NextRequest, NextResponse } from 'next/server'
import { getEngineContext, formatFactsForPrompt } from '@/lib/ai/engineContext'

const SYSTEM_PROMPT = `You are a senior data analyst interpreting statistical results for a business audience.
Be specific with numbers. Concise. Connect findings to the broader dataset context.

Return ONLY valid JSON, no markdown:
{
  "interpretation": "2-3 clear sentences with specific numbers, referencing verified facts where relevant",
  "key_findings": ["finding 1 with numbers", "finding 2 with numbers", "finding 3 with numbers"],
  "recommended_actions": ["specific action 1", "specific action 2"]
}

IMPORTANT: If verified facts are provided, use them to ADD CONTEXT to your interpretation.
Example: If you're interpreting a correlation and a verified fact says "Pclass strongly influences Survived",
mention this connection in your interpretation.`

export async function POST(request: NextRequest) {
  try {
    const { operation, result, columns_used, source_name, source_id } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

    // Fetch engine context for richer interpretation
    const engineCtx = await getEngineContext(source_id)
    const verifiedBlock = formatFactsForPrompt(engineCtx.facts)

    const userMsg = `Operation: ${operation}
Columns: ${JSON.stringify(columns_used)}
Source: ${source_name}
Result: ${JSON.stringify(result, null, 2).slice(0, 2000)}${verifiedBlock}`

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
  } catch {
    return NextResponse.json({
      interpretation: 'Could not generate interpretation.',
      key_findings: [],
      recommended_actions: [],
    })
  }
}
