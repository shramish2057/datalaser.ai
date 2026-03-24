import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/vault/decrypt'
import { buildConnectionString } from '@/lib/db/connection-string'
import { isDbSource } from '@/lib/source-types'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

interface TableProfile {
  name: string
  quality_score: number
  quality_level: string
  total_rows: number
  total_columns: number
  warnings: { column: string; issue: string; severity: string; detail: string; affected_rows?: number | null }[]
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { source_id } = await request.json()
    if (!source_id) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
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

    if (!isDbSource(source.source_type)) {
      return NextResponse.json({ error: 'Source is not a database type' }, { status: 400 })
    }

    if (!source.encrypted_credentials) {
      return NextResponse.json({ error: 'No credentials stored for this source' }, { status: 400 })
    }

    // 3. Decrypt credentials and build connection string
    const creds = decryptCredentials(source.encrypted_credentials)
    const connectionString = buildConnectionString(source.source_type, creds)

    // 4. Get table list from schema_snapshot
    const schema = source.schema_snapshot as { tables?: { name: string; row_count: number }[] } | null
    const tables = schema?.tables || []

    if (tables.length === 0) {
      return NextResponse.json({ error: 'No tables found in database schema' }, { status: 400 })
    }

    // 5. Profile each table — use Promise.allSettled so one failure doesn't kill the batch
    const profilePromises = tables.map(async (table): Promise<TableProfile> => {
      try {
        const upstream = await fetch(`${PIPELINE_URL}/profile/database`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection_string: connectionString,
            table_name: table.name,
            source_id,
          }),
        })
        const data = await upstream.json()

        if (!upstream.ok) {
          return {
            name: table.name,
            quality_score: 0,
            quality_level: 'red',
            total_rows: table.row_count || 0,
            total_columns: 0,
            warnings: [],
            error: data.detail || 'Profiling failed',
          }
        }

        return {
          name: table.name,
          quality_score: data.quality_score ?? 0,
          quality_level: data.quality_level ?? 'red',
          total_rows: data.total_rows ?? table.row_count ?? 0,
          total_columns: data.total_columns ?? 0,
          warnings: data.warnings ?? [],
        }
      } catch (err) {
        return {
          name: table.name,
          quality_score: 0,
          quality_level: 'red',
          total_rows: table.row_count || 0,
          total_columns: 0,
          warnings: [],
          error: err instanceof Error ? err.message : 'Profiling failed',
        }
      }
    })

    const tableProfiles = await Promise.all(profilePromises)

    // 6. Calculate overall weighted quality score (weighted by row count)
    const totalRows = tableProfiles.reduce((sum, t) => sum + t.total_rows, 0)
    const successfulProfiles = tableProfiles.filter(t => !t.error)

    let overallQuality = 0
    if (successfulProfiles.length > 0) {
      if (totalRows > 0) {
        // Weighted average by row count
        const weightedSum = successfulProfiles.reduce(
          (sum, t) => sum + t.quality_score * t.total_rows, 0
        )
        overallQuality = Math.round(weightedSum / totalRows)
      } else {
        // Simple average if no row counts
        const sum = successfulProfiles.reduce((s, t) => s + t.quality_score, 0)
        overallQuality = Math.round(sum / successfulProfiles.length)
      }
    }

    // 7. Save profiles to the data_sources record
    const { error: updateErr } = await supabaseAdmin
      .from('data_sources')
      .update({
        data_profile: {
          overall_quality: overallQuality,
          table_profiles: tableProfiles,
          profiled_at: new Date().toISOString(),
        },
      })
      .eq('id', source_id)

    if (updateErr) {
      console.error('Failed to save table profiles:', updateErr.message)
      // Don't fail the request — the profiling data is still returned
    }

    // 8. Return result
    return NextResponse.json({
      source_id,
      tables: tableProfiles,
      overall_quality: overallQuality,
      total_rows: totalRows,
      total_tables: tables.length,
      profiled_tables: successfulProfiles.length,
      failed_tables: tableProfiles.length - successfulProfiles.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Pipeline service unavailable' },
      { status: 503 }
    )
  }
}
