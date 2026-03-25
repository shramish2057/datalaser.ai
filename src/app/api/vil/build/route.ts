import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/vault/decrypt'
import { buildConnectionString } from '@/lib/db/connection-string'
import { isDbSource } from '@/lib/source-types'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { source_id, project_id } = await request.json()
    if (!source_id || !project_id) {
      return NextResponse.json(
        { error: 'source_id and project_id required' },
        { status: 400 }
      )
    }

    // 2. Fetch source and decrypt credentials
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: source, error: srcErr } = await supabaseAdmin
      .from('data_sources').select('*').eq('id', source_id).single()

    if (srcErr || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }
    if (!isDbSource(source.source_type) || !source.encrypted_credentials) {
      return NextResponse.json(
        { error: 'Not a database source or no credentials' },
        { status: 400 }
      )
    }

    // 3. Decrypt and build connection string
    const creds = decryptCredentials(source.encrypted_credentials)
    const connectionString = buildConnectionString(source.source_type, creds)

    // 4. Get schema_tables from source snapshot
    const schema = source.schema_snapshot as { tables?: { name: string; columns?: unknown[] }[] } | null
    const schemaTables = schema?.tables || []

    // 5. Fetch any existing corrections for this project/source
    const { data: corrections } = await supabaseAdmin
      .from('vil_corrections')
      .select('*')
      .eq('project_id', project_id)
      .eq('source_id', source_id)
      .order('applied_at', { ascending: true })

    // 6. Forward to pipeline /vil/build endpoint
    const formData = new URLSearchParams({
      source_type: source.source_type,
      connection_string: connectionString,
      source_id,
      project_id,
      schema_tables: JSON.stringify(schemaTables),
      corrections: JSON.stringify(corrections || []),
    })

    const upstream = await fetch(`${PIPELINE_URL}/vil/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    })

    const data = await upstream.json()
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.detail || 'VIL graph build failed' },
        { status: upstream.status }
      )
    }

    // 7. Upsert result into vil_graphs (by project_id + source_id)
    // Pipeline returns: { nodes, edges, industry, kpis, metadata }
    const graphRecord = {
      project_id,
      source_id,
      graph_data: { nodes: data.nodes || [], edges: data.edges || [], metadata: data.metadata || {} },
      industry_type: data.industry?.type || null,
      industry_confidence: data.industry?.confidence || 0,
      kpis_mapped: data.kpis || [],
      node_count: (data.nodes || []).length,
      edge_count: (data.edges || []).length,
      updated_at: new Date().toISOString(),
    }

    // Check if a graph already exists for this project + source
    const { data: existing } = await supabaseAdmin
      .from('vil_graphs')
      .select('id')
      .eq('project_id', project_id)
      .eq('source_id', source_id)
      .single()

    if (existing) {
      await supabaseAdmin
        .from('vil_graphs')
        .update(graphRecord)
        .eq('id', existing.id)
    } else {
      await supabaseAdmin
        .from('vil_graphs')
        .insert(graphRecord)
    }

    // Return the same format as /api/vil/graph (graph_data structure)
    return NextResponse.json({
      ...graphRecord.graph_data,
      industry: { type: graphRecord.industry_type, confidence: graphRecord.industry_confidence },
      kpis: graphRecord.kpis_mapped,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'VIL build failed' },
      { status: 503 }
    )
  }
}
