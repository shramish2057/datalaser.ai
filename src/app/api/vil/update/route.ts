import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      project_id,
      source_id,
      correction_type,
      original_mapping,
      corrected_mapping,
    } = await request.json()

    if (!project_id || !correction_type || !corrected_mapping) {
      return NextResponse.json(
        { error: 'project_id, correction_type, and corrected_mapping required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 2. Insert correction record
    const { error: insertErr } = await supabaseAdmin
      .from('vil_corrections')
      .insert({
        project_id,
        source_id: source_id || null,
        correction_type,
        original_mapping: original_mapping || null,
        corrected_mapping,
        created_by: user.id,
      })

    if (insertErr) {
      return NextResponse.json(
        { error: `Failed to save correction: ${insertErr.message}` },
        { status: 500 }
      )
    }

    // 3. If source_id provided, rebuild graph with correction applied
    if (source_id) {
      const rebuildUrl = new URL('/api/vil/build', request.url)
      const rebuildRes = await fetch(rebuildUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ source_id, project_id }),
      })

      const rebuildData = await rebuildRes.json()
      if (!rebuildRes.ok) {
        return NextResponse.json(
          { error: rebuildData.error || 'Graph rebuild failed after correction' },
          { status: rebuildRes.status }
        )
      }

      return NextResponse.json({
        correction_saved: true,
        graph_data: rebuildData,
      })
    }

    // 4. No source_id — just confirm correction saved
    return NextResponse.json({ correction_saved: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 503 }
    )
  }
}
