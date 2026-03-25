import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/vault/decrypt'
import { buildConnectionString } from '@/lib/db/connection-string'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { source_id, table_name, column_name, node_type, node_label, node_value, business_role, locale } = await request.json()

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: source } = await supabaseAdmin.from('data_sources').select('*').eq('id', source_id).single()
    if (!source || !source.encrypted_credentials) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

    const creds = decryptCredentials(source.encrypted_credentials)
    const connectionString = buildConnectionString(source.source_type, creds)

    const formData = new URLSearchParams({
      source_type: source.source_type,
      connection_string: connectionString,
      table_name: table_name || '',
      column_name: column_name || '',
      node_type: node_type || 'metric',
      node_label: node_label || '',
      node_value: String(node_value || ''),
      business_role: business_role || '',
      locale: locale || 'en',
    })

    const upstream = await fetch(`${PIPELINE_URL}/vil/insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    })
    const data = await upstream.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 503 })
  }
}
