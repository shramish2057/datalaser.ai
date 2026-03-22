// API route: POST /api/insights/generate
// Generates AI-powered insights from all active data sources in the workspace.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateInsights } from '@/lib/ai/claude';

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
    try {
      const body = await request.json();
      projectId = body.project_id;
      sourceIds = body.source_ids;
    } catch {
      // No body or invalid JSON — use workspace-level fallback
    }

    // 3. Generate insights via Claude
    const insights = await generateInsights(user.id, projectId, sourceIds);

    // 4. Save to insight_documents table
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
