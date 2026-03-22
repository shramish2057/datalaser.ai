import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/vault/decrypt'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

function buildConnectionString(sourceType: string, creds: Record<string, string>): string {
  const { Host, Port, Database, Username, Password, Account, Warehouse, Schema } = creds
  switch (sourceType) {
    case 'postgres': return `postgresql://${Username}:${Password}@${Host}:${Port || 5432}/${Database}`
    case 'mysql': return `mysql+pymysql://${Username}:${Password}@${Host}:${Port || 3306}/${Database}`
    case 'snowflake': return `snowflake://${Username}:${Password}@${Account}/${Database}/${Schema || 'PUBLIC'}?warehouse=${Warehouse}`
    default: return `postgresql://${Username}:${Password}@${Host}:${Port || 5432}/${Database}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { source_id, code, cell_id } = await request.json()
    if (!source_id || !code) return NextResponse.json({ error: 'source_id and code required' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: source } = await supabaseAdmin
      .from('data_sources').select('*').eq('id', source_id).single()
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

    if (!source.encrypted_credentials) {
      return NextResponse.json({ error: 'No credentials stored for this source' }, { status: 400 })
    }

    const creds = decryptCredentials(source.encrypted_credentials)
    const connStr = buildConnectionString(source.source_type, creds)

    // Get table name from schema
    const schema = source.schema_snapshot as { tables?: { name: string }[] } | null
    const tableName = schema?.tables?.[0]?.name || 'public'

    const fd = new FormData()
    fd.append('source_type', source.source_type)
    fd.append('connection_string', connStr)
    fd.append('table_name', tableName)
    fd.append('code', code)
    if (cell_id) fd.append('cell_id', cell_id)

    const res = await fetch(`${PIPELINE_URL}/analyst/execute-db`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.detail || 'Execution failed' }, { status: res.status })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Execution failed' }, { status: 500 })
  }
}
