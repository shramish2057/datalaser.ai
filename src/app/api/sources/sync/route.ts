import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { isDbSource, isFileSource } from '@/lib/source-types'

interface TableProfile {
  name: string
  quality_score: number
  quality_level: string
  total_rows: number
  total_columns: number
  warnings: { column: string; issue: string; severity: string; detail: string; affected_rows?: number | null }[]
  error?: string
}

interface DataProfile {
  overall_quality: number
  table_profiles: TableProfile[]
  profiled_at: string
}

interface AnomalyRecord {
  source_id: string
  project_id: string
  type: 'health_degradation' | 'schema_drift'
  severity: 'critical' | 'warning'
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { source_id } = await request.json()
    if (!source_id) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
    }

    // 2. Fetch source record with previous data_profile
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: source, error: srcErr } = await supabaseAdmin
      .from('data_sources').select('*').eq('id', source_id).single()

    if (srcErr || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    const previousProfile = source.data_profile as DataProfile | null
    let newProfile: DataProfile | null = null
    const anomalies: AnomalyRecord[] = []

    // 3. If DB source: re-profile all tables via internal API
    if (isDbSource(source.source_type)) {
      const origin = request.nextUrl.origin
      const profileRes = await fetch(`${origin}/api/sources/profile-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ source_id }),
      })

      if (profileRes.ok) {
        const profileData = await profileRes.json()
        // Rebuild profile structure from profile-all response
        newProfile = {
          overall_quality: profileData.overall_quality ?? 0,
          table_profiles: profileData.tables ?? [],
          profiled_at: new Date().toISOString(),
        }
      }
    }

    // 4. If file source: skip re-profiling (files don't change)
    if (isFileSource(source.source_type)) {
      newProfile = previousProfile
    }

    // 5. Compare new profile against previous and detect drift/degradation
    if (newProfile && previousProfile) {
      const prevTableMap = new Map<string, TableProfile>()
      for (const t of previousProfile.table_profiles || []) {
        prevTableMap.set(t.name, t)
      }

      const newTableMap = new Map<string, TableProfile>()
      for (const t of newProfile.table_profiles || []) {
        newTableMap.set(t.name, t)
      }

      // Check each table in new profile
      for (const table of newProfile.table_profiles || []) {
        const prev = prevTableMap.get(table.name)
        if (!prev) continue

        // Quality degradation check (>= 10 point drop)
        const qualityDrop = prev.quality_score - table.quality_score
        if (qualityDrop >= 10) {
          anomalies.push({
            source_id,
            project_id: source.project_id,
            type: 'health_degradation',
            severity: qualityDrop >= 20 ? 'critical' : 'warning',
            message: `${table.name} quality dropped from ${prev.quality_score} to ${table.quality_score}`,
            metadata: {
              table: table.name,
              previous_score: prev.quality_score,
              current_score: table.quality_score,
              drop: qualityDrop,
              issues: table.warnings?.map(w => w.issue) || [],
            },
            created_at: new Date().toISOString(),
          })
        }

        // Schema drift: compare column counts as a simple heuristic
        if (prev.total_columns !== table.total_columns) {
          const diff = table.total_columns - prev.total_columns
          const message = diff > 0
            ? `New columns detected in ${table.name} (${prev.total_columns} -> ${table.total_columns})`
            : `Columns removed from ${table.name} (${prev.total_columns} -> ${table.total_columns})`

          anomalies.push({
            source_id,
            project_id: source.project_id,
            type: 'schema_drift',
            severity: 'warning',
            message,
            metadata: {
              table: table.name,
              previous_columns: prev.total_columns,
              current_columns: table.total_columns,
              column_diff: diff,
            },
            created_at: new Date().toISOString(),
          })
        }
      }

      // Schema drift: detect entirely new or removed tables
      for (const [name] of newTableMap) {
        if (!prevTableMap.has(name)) {
          anomalies.push({
            source_id,
            project_id: source.project_id,
            type: 'schema_drift',
            severity: 'warning',
            message: `New table detected: ${name}`,
            metadata: { table: name, change: 'added' },
            created_at: new Date().toISOString(),
          })
        }
      }

      for (const [name] of prevTableMap) {
        if (!newTableMap.has(name)) {
          anomalies.push({
            source_id,
            project_id: source.project_id,
            type: 'schema_drift',
            severity: 'warning',
            message: `Table removed: ${name}`,
            metadata: { table: name, change: 'removed' },
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    // Insert anomaly records
    if (anomalies.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from('anomalies')
        .insert(anomalies)
      if (insertErr) {
        console.error('Failed to insert anomalies:', insertErr.message)
      }
    }

    // 6. Update last_synced_at
    // 7. Save new profile to data_sources.data_profile
    const updatePayload: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
    }
    if (newProfile) {
      updatePayload.data_profile = newProfile
    }

    await supabaseAdmin
      .from('data_sources')
      .update(updatePayload)
      .eq('id', source_id)

    // 8. Return result
    return NextResponse.json({
      synced: true,
      alerts_created: anomalies.length,
      drift_detected: anomalies.some(a => a.type === 'schema_drift'),
    })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
