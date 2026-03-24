import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildDataContext } from '@/lib/ai/sampler';
import { getEngineContext, formatFactsForPrompt, getLocaleFromRequest } from '@/lib/ai/engineContext';
import { isDbSource } from '@/lib/source-types';
import { decryptCredentials } from '@/lib/vault/decrypt';
import { buildConnectionString } from '@/lib/db/connection-string';

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

    // Fetch VIL context for enhanced AI understanding
    let vilContext = ''
    if (project_id) {
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: vilGraph } = await supabaseAdmin
          .from('vil_graphs')
          .select('graph_data, industry_type, industry_confidence, kpis_mapped')
          .eq('project_id', project_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        if (vilGraph) {
          const gd = vilGraph.graph_data as any
          const nodes = gd?.nodes || []
          const edges = gd?.edges || []

          // Build column role mappings
          const columnMappings = nodes
            .filter((n: any) => n.type === 'metric' || n.type === 'dimension')
            .map((n: any) => `${n.label} (${n.metadata?.column || n.id}) = ${n.metadata?.business_role || n.type}`)
            .join('\n  ')

          // Build relationship descriptions
          const relationships = edges
            .filter((e: any) => e.type === 'relationship')
            .map((e: any) => `${e.source} -> ${e.target}: ${e.label_en || e.label_de || 'related'}`)
            .join('\n  ')

          // Build KPI formulas
          const kpis = (vilGraph.kpis_mapped as any[] || [])
            .filter((k: any) => k.mapped)
            .map((k: any) => `${k.name_en}: ${k.formula} (columns: ${(k.columns || []).join(', ')})`)
            .join('\n  ')

          vilContext = `
=== VERIFIED INTELLIGENCE LAYER ===
Industry: ${vilGraph.industry_type || 'unknown'} (${Math.round((vilGraph.industry_confidence || 0) * 100)}% confidence)

Column Business Roles:
  ${columnMappings || 'No mappings available'}

Table Relationships:
  ${relationships || 'No relationships detected'}

Mapped KPIs:
  ${kpis || 'No KPIs mapped'}
=== END VIL CONTEXT ===
`
        }
      } catch { /* VIL context optional */ }
    }

    // Build data context — from intent if available, otherwise from project's data sources
    let dataContext = '';
    if (!intent?.columns && project_id) {
      // No intent data — fetch from project's saved data sources
      try {
        dataContext = await buildDataContext('', project_id, source_ids);
      } catch { /* fallback to empty context */ }
    }
    if (intent?.columns) {
      const colList = intent.columns
        .map((c: { name: string; dtype: string }) =>
          `  - ${c.name} (${c.dtype})`)
        .join('\n');

      dataContext = `
FILE: ${intent.fileName} (${intent.rows?.toLocaleString()} rows)
COLUMNS:
${colList}

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

    // Fetch engine-computed verified facts + locale
    const locale = getLocaleFromRequest(request)
    let verifiedBlock = ''
    try {
      const sourceIdList = source_ids as string[] | undefined
      if (sourceIdList?.length) {
        const engineCtx = await getEngineContext(sourceIdList[0], project_id)
        verifiedBlock = formatFactsForPrompt(engineCtx.facts, locale)
      } else {
        // Even without engine context, inject language instruction
        verifiedBlock = formatFactsForPrompt([], locale)
      }
    } catch {
      verifiedBlock = formatFactsForPrompt([], locale)
    }

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history || []).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    const RESPONSE_FORMAT = `RESPONSE FORMAT:
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
For stacked_bar, add yKeys="key1,key2,key3" attribute.`;

    // Check if primary source is a database
    let dbSource: any = null;
    if (source_ids?.length) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: src } = await supabaseAdmin
        .from('data_sources').select('*').eq('id', source_ids[0]).single();
      if (src && isDbSource(src.source_type)) {
        dbSource = src;
      }
    }

    if (dbSource) {
      // ─── LIVE DB FLOW: Claude generates SQL → we execute → Claude interprets ───
      const schema = dbSource.schema_snapshot as any;
      const schemaText = (schema?.tables || []).map((t: any) =>
        `TABLE ${t.name} (${t.row_count} rows):\n${t.columns.map((c: any) => `  ${c.name} ${c.type}${c.nullable === false ? ' NOT NULL' : ''}`).join('\n')}`
      ).join('\n\n');

      // Turn 1: Ask Claude to generate SQL
      const sqlResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a SQL expert. Given a database schema, generate a single SQL query to answer the user's question.
Return ONLY the raw SQL query, no explanation, no markdown, no code fences.
The SQL must be valid PostgreSQL. Use aggregate functions (COUNT, SUM, AVG, etc.) to summarize data.
Never SELECT * — always select specific columns and aggregate.
Limit results to 50 rows maximum.
${vilContext}
DATABASE SCHEMA:
${schemaText}`,
        messages: [{ role: 'user', content: message }],
      });

      const sqlText = sqlResponse.content[0]?.type === 'text' ? sqlResponse.content[0].text.trim() : '';

      if (sqlText.toUpperCase().startsWith('SELECT')) {
        // Execute SQL on live DB
        const creds = decryptCredentials(dbSource.encrypted_credentials);
        const connStr = buildConnectionString(dbSource.source_type, creds);

        const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001';
        const execRes = await fetch(`${PIPELINE_URL}/analyst/execute-db`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            source_type: dbSource.source_type,
            connection_string: connStr,
            table_name: (schema?.tables?.[0]?.name || 'public'),
            code: sqlText,
            cell_id: 'ask-query',
          }),
        });
        const execData = await execRes.json();

        // Turn 2: Send results to Claude for narrative interpretation
        const resultStr = JSON.stringify(execData.data?.slice(0, 50) || []);

        const stream = client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: `You are DataLaser's data analyst AI.
${vilContext}${verifiedBlock}
${RESPONSE_FORMAT}

RULES:
- Reference actual numbers from the query results
- Be specific with numbers, not vague
- Keep data arrays concise (max 20 data points for charts)
- The data array MUST be valid JSON — use double quotes for keys and string values

The user asked a question about their database and we executed this SQL query:
\`\`\`sql
${sqlText}
\`\`\`

Query returned ${execData.data?.length || 0} rows.
LIVE QUERY RESULTS:
${resultStr}

Use these REAL results to answer the user's question. Include charts.
Reference actual numbers from the query results.`,
          messages,
        });

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
      }
      // If SQL generation failed (non-SELECT), fall through to file-source flow
    }

    // ─── FILE SOURCE FLOW (or fallback) ───
    const systemPrompt = `You are DataLaser's data analyst AI.
You answer questions about the user's data with precision and always include visualisations.
${vilContext}
${dataContext ? `DATA CONTEXT:\n${dataContext}\n` : ''}${qualityContext}${verifiedBlock}
${RESPONSE_FORMAT}

RULES:
- Generate REAL data arrays by aggregating/summarising the sample data provided
- Use the user's preferred chart types and axes when they make sense
- For bar/line/area charts, aggregate or group the data meaningfully
- For pie charts, limit to 8 slices max, group small values as "Other"
- Keep data arrays concise (max 20 data points for charts)
- The data array MUST be valid JSON — use double quotes for keys and string values
- Always reference actual values from the data
- Be specific with numbers, not vague`;

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
