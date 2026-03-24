// API route: POST /api/insights/generate
// Generates AI-powered insights from all active data sources in the workspace.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateInsights, generateInsightsFromLiveData } from '@/lib/ai/claude';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDbSource } from '@/lib/source-types';
import { decryptCredentials } from '@/lib/vault/decrypt';
import { buildConnectionString } from '@/lib/db/connection-string';

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Read optional project_id and source_ids from body
    let projectId: string | undefined;
    let sourceIds: string[] | undefined;
    let locale: string = 'en';
    try {
      const body = await request.json();
      projectId = body.project_id;
      sourceIds = body.source_ids;
      if (body.locale) locale = body.locale;
    } catch {
      // No body or invalid JSON — use workspace-level fallback
    }

    // 3. For DB sources, query live aggregates instead of using cached data
    const adminClient = createAdminClient();
    let sourcesQuery = adminClient
      .from('data_sources')
      .select('*')
      .eq('status', 'active');

    if (sourceIds && sourceIds.length > 0) {
      sourcesQuery = sourcesQuery.in('id', sourceIds);
    } else if (projectId) {
      sourcesQuery = sourcesQuery.eq('project_id', projectId);
    } else {
      sourcesQuery = sourcesQuery.eq('workspace_id', user.id);
    }

    const { data: sources } = await sourcesQuery;

    let liveDbContext = '';
    for (const src of (sources || [])) {
      if (!isDbSource(src.source_type) || !src.encrypted_credentials) continue;

      const creds = decryptCredentials(src.encrypted_credentials);
      const connStr = buildConnectionString(src.source_type, creds);
      const schema = src.schema_snapshot as { tables?: { name: string; row_count?: number; columns?: { name: string; type: string }[] }[] } | null;
      const tables = schema?.tables || [];

      liveDbContext += `\nLIVE DATABASE: ${src.name} (${src.source_type})\n`;

      for (const table of tables) {
        try {
          // Row count query
          const countFd = new FormData();
          countFd.append('source_type', src.source_type);
          countFd.append('connection_string', connStr);
          countFd.append('table_name', table.name);
          countFd.append('code', `SELECT COUNT(*) as total_rows FROM "${table.name}"`);
          countFd.append('cell_id', 'insights-count');

          const execRes = await fetch(`${PIPELINE_URL}/analyst/execute-db`, {
            method: 'POST',
            body: countFd,
          });
          const countData = await execRes.json();
          const rowCount = countData.data?.[0]?.total_rows || table.row_count || 0;

          // Get numeric column aggregates
          const numericCols = (table.columns || [])
            .filter((c: { name: string; type: string }) => /int|float|double|decimal|numeric|real|money/i.test(c.type))
            .map((c: { name: string; type: string }) => c.name);

          if (numericCols.length > 0) {
            const aggSql = `SELECT ${numericCols.map((c: string) =>
              `SUM("${c}") as "${c}_sum", AVG("${c}") as "${c}_avg", MIN("${c}") as "${c}_min", MAX("${c}") as "${c}_max"`
            ).join(', ')} FROM "${table.name}"`;

            const aggFd = new FormData();
            aggFd.append('source_type', src.source_type);
            aggFd.append('connection_string', connStr);
            aggFd.append('table_name', table.name);
            aggFd.append('code', aggSql);
            aggFd.append('cell_id', 'insights-agg');

            const aggRes = await fetch(`${PIPELINE_URL}/analyst/execute-db`, {
              method: 'POST',
              body: aggFd,
            });
            const aggData = await aggRes.json();

            liveDbContext += `TABLE ${table.name} (${rowCount} rows):\n`;
            if (aggData.data?.[0]) {
              for (const [key, val] of Object.entries(aggData.data[0])) {
                if (val !== null) {
                  liveDbContext += `  ${key}: ${typeof val === 'number' ? val.toLocaleString() : val}\n`;
                }
              }
            }
          } else {
            liveDbContext += `TABLE ${table.name} (${rowCount} rows, no numeric columns)\n`;
          }
        } catch {
          liveDbContext += `TABLE ${table.name}: query failed\n`;
        }
      }
    }

    // 4. Generate insights — use live data for DB sources, cached context for file sources
    let insights;
    if (liveDbContext) {
      insights = await generateInsightsFromLiveData(liveDbContext, locale);
    } else {
      insights = await generateInsights(user.id, projectId, sourceIds);
    }

    // 5. Save to insight_documents table
    const insertData: Record<string, unknown> = {
      workspace_id: user.id,
      title: insights.title,
      executive_summary: insights.executive_summary,
      severity_chips: insights.severity_chips,
      kpis: insights.kpis,
      key_findings: insights.key_findings,
      recommendations: insights.recommendations,
      anomalies: insights.anomalies,
      deep_dives: insights.deep_dives,
    };

    if (projectId) {
      insertData.project_id = projectId;
    }

    const { data: doc, error: insertError } = await supabase
      .from('insight_documents')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to save insights', message: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document: doc,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Insight generation failed', message: err.message },
      { status: 500 }
    );
  }
}
