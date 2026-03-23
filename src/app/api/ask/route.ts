import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildDataContext } from '@/lib/ai/sampler';
import { getEngineContext, formatFactsForPrompt } from '@/lib/ai/engineContext';

const getClient = (() => {
  let client: Anthropic | null = null;
  return () => {
    if (!client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
      client = new Anthropic({ apiKey });
    }
    return client;
  };
})();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history, intent, qualityReport, project_id, source_ids } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'No message' }), { status: 400 });
    }

    const client = getClient();

    // Build data context — from intent if available, otherwise from project's data sources
    let dataContext = '';
    if (!intent?.columns && project_id) {
      // No intent data — fetch from project's saved data sources
      try {
        dataContext = await buildDataContext('', project_id, source_ids);
      } catch { /* fallback to empty context */ }
    }
    if (intent?.columns && intent.sampleRows) {
      const colList = intent.columns
        .map((c: { name: string; dtype: string; sample: string[] }) =>
          `  - ${c.name} (${c.dtype})${c.sample?.length > 0 ? `: ${c.sample.slice(0, 3).join(', ')}` : ''}`)
        .join('\n');

      const headerRow = intent.columns.map((c: { name: string }) => c.name).join(' | ');
      const sampleRowsStr = (intent.sampleRows as string[][])
        .slice(0, 5)
        .map((row: string[]) => row.join(' | '))
        .join('\n');

      dataContext = `
FILE: ${intent.fileName} (${intent.rows?.toLocaleString()} rows)
COLUMNS:
${colList}

SAMPLE DATA:
${headerRow}
${sampleRowsStr}

USER PREFERENCES:
- Preferred chart types: ${(intent.chartTypes as string[])?.join(', ') || 'bar'}
${intent.xAxis ? `- Preferred X axis: ${intent.xAxis}` : ''}
${intent.yAxis ? `- Preferred Y axis: ${intent.yAxis}` : ''}`;
    }

    // Build quality warning context
    let qualityContext = '';
    if (qualityReport && (qualityReport.level === 'amber' || qualityReport.level === 'red')) {
      const issues = (qualityReport.warnings as { column: string; detail: string }[])
        .map((w: { column: string; detail: string }) => `${w.column}: ${w.detail}`)
        .join(', ');
      qualityContext = `\nDATA QUALITY WARNING: This dataset has quality issues (level: ${qualityReport.level}, score: ${qualityReport.score}/100).
Issues: ${issues}
When answering, note where results may be affected by these issues.
If a specific column has a red warning, mention it when that column is used in analysis.\n`;
    }

    // Fetch engine-computed verified facts
    let verifiedBlock = ''
    try {
      const sourceIdList = source_ids as string[] | undefined
      if (sourceIdList?.length) {
        const engineCtx = await getEngineContext(sourceIdList[0], project_id)
        verifiedBlock = formatFactsForPrompt(engineCtx.facts)
      }
    } catch { /* continue without engine context */ }

    const systemPrompt = `You are DataLaser's data analyst AI.
You answer questions about the user's data with precision and always include visualisations.

${dataContext ? `DATA CONTEXT:\n${dataContext}\n` : ''}${qualityContext}${verifiedBlock}
RESPONSE FORMAT:
- Use **Markdown** formatting in every response
- Use ## for section headings (e.g. ## Revenue Analysis)
- Use **bold** for key numbers and important terms
- Use bullet points or numbered lists for comparisons
- Use > blockquotes for warnings or caveats about data quality
- ALWAYS include at least one [CHART] block in every response
- Place each [CHART] block right after the section it illustrates
- After each chart, write 2-3 sentences of insight explaining it
- You can include multiple charts if useful
- End every answer with a **Key Takeaway** section using ## heading

CHART BLOCK FORMAT (must be on a single line, data as a JSON array):
[CHART type="bar" title="Chart Title" xKey="columnName" yKey="columnName" data='[{"columnName":"value","columnName2":123}]']

Supported types: bar, line, area, pie, donut, scatter, stacked_bar, table
For stacked_bar, add yKeys="key1,key2,key3" attribute.

RULES:
- Generate REAL data arrays by aggregating/summarising the sample data provided
- Use the user's preferred chart types and axes when they make sense
- For bar/line/area charts, aggregate or group the data meaningfully
- For pie charts, limit to 8 slices max, group small values as "Other"
- Keep data arrays concise (max 20 data points for charts)
- The data array MUST be valid JSON — use double quotes for keys and string values
- Always reference actual values from the data
- Be specific with numbers, not vague`;

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history || []).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Stream the response
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages,
    });

    // Create a ReadableStream from Claude's stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err) {
    console.error('Ask API error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Ask failed' }),
      { status: 500 }
    );
  }
}
