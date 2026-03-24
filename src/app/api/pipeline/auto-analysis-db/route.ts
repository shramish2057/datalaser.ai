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

    const { source_id, table_name } = await request.json()
    if (!source_id) {
      return NextResponse.json({ error: 'source_id required' }, { status: 400 })
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
      return NextResponse.json({ error: 'Not a database source or no credentials' }, { status: 400 })
    }

    // Determine table name from schema if not provided
    const schema = source.schema_snapshot as { tables?: { name: string }[] } | null
    const targetTable = table_name || schema?.tables?.[0]?.name
    if (!targetTable) {
      return NextResponse.json({ error: 'No table specified and none found in schema' }, { status: 400 })
    }

    // 3. Decrypt and build connection string
    const creds = decryptCredentials(source.encrypted_credentials)
    const connectionString = buildConnectionString(source.source_type, creds)

    // 4. Forward to pipeline service
    const formData = new URLSearchParams({
      source_type: source.source_type,
      connection_string: connectionString,
      table_name: targetTable,
    })

    const upstream = await fetch(`${PIPELINE_URL}/auto-analysis/run-db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    })

    const data = await upstream.json()
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.detail || 'DB auto-analysis failed' },
        { status: upstream.status }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Auto-analysis failed' },
      { status: 503 }
    )
  }
}
