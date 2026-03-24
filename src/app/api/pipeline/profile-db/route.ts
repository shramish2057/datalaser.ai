import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/vault/decrypt'
import { buildConnectionString } from '@/lib/db/connection-string'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { source_id, table_name } = await request.json()
    if (!source_id || !table_name) {
      return NextResponse.json({ error: 'source_id and table_name required' }, { status: 400 })
    }

    // 2. Fetch source record
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: source, error: srcErr } = await supabaseAdmin
      .from('data_sources').select('*').eq('id', source_id).single()

    if (srcErr || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }
    if (!source.encrypted_credentials) {
      return NextResponse.json({ error: 'No credentials stored for this source' }, { status: 400 })
    }

    // 3. Decrypt credentials and build connection string
    const creds = decryptCredentials(source.encrypted_credentials)
    const connectionString = buildConnectionString(source.source_type, creds)

    // 4. Forward to pipeline service
    const upstream = await fetch(`${PIPELINE_URL}/profile/database`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connection_string: connectionString,
        table_name,
        source_id,
      }),
    })
    const data = await upstream.json()
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.detail || 'Database profiling failed' },
        { status: upstream.status }
      )
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Pipeline service unavailable' },
      { status: 503 }
    )
  }
}
