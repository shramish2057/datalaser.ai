import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const project_id = searchParams.get('project_id')
    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 2. Fetch latest vil_graphs record for this project
    const { data: graph, error: graphErr } = await supabaseAdmin
      .from('vil_graphs')
      .select('*')
      .eq('project_id', project_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (graphErr || !graph) {
      return NextResponse.json({ error: 'No graph found for project' }, { status: 404 })
    }

    // Return graph_data merged with industry and kpis
    const graphData = graph.graph_data as Record<string, unknown> || {}
    return NextResponse.json({
      ...graphData,
      industry: { type: graph.industry_type, confidence: graph.industry_confidence },
      kpis: graph.kpis_mapped || [],
      updated_at: graph.updated_at,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch graph' },
      { status: 503 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { project_id } = await request.json()
    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 2. Fetch latest vil_graphs record for this project
    const { data: graph, error: graphErr } = await supabaseAdmin
      .from('vil_graphs')
      .select('*')
      .eq('project_id', project_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (graphErr || !graph) {
      return NextResponse.json({ error: 'No graph found for project' }, { status: 404 })
    }

    const graphData = graph.graph_data as Record<string, unknown> || {}
    return NextResponse.json({
      ...graphData,
      industry: { type: graph.industry_type, confidence: graph.industry_confidence },
      kpis: graph.kpis_mapped || [],
      updated_at: graph.updated_at,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch graph' },
      { status: 503 }
    )
  }
}
