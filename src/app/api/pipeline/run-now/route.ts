import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabaseAuth = await createServerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { source_id, recipe_id } = await request.json()
    if (!source_id || !recipe_id) {
      return NextResponse.json({ error: 'source_id and recipe_id required' }, { status: 400 })
    }

    // Use admin client for Storage access
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch recipe
    const { data: recipe } = await supabaseAdmin
      .from('pipeline_recipes').select('steps').eq('id', recipe_id).single()
    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    // Fetch source for file_path
    const { data: source } = await supabaseAdmin
      .from('data_sources').select('file_path, name, source_type').eq('id', source_id).single()
    if (!source?.file_path) {
      return NextResponse.json({ error: 'No file_path on source — re-upload needed' }, { status: 400 })
    }

    // Download file from Storage
    const { data: fileBlob, error: dlError } = await supabaseAdmin.storage
      .from('data-sources').download(source.file_path)
    if (dlError || !fileBlob) {
      return NextResponse.json({ error: 'Failed to download source file' }, { status: 500 })
    }

    // Mark run as started
    const { data: runRecord } = await supabaseAdmin
      .from('pipeline_run_history')
      .insert({ recipe_id, source_id, status: 'running' })
      .select('id').single()

    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer())
    const fileType = source.name.split('.').pop() || 'csv'

    // 1. Transform
    const transformFd = new FormData()
    transformFd.append('file', new Blob([fileBuffer]), source.name)
    transformFd.append('steps', JSON.stringify(recipe.steps))
    transformFd.append('source_id', source_id)
    transformFd.append('file_type', fileType)

    const transformRes = await fetch(`${PIPELINE_URL}/transform/apply`, {
      method: 'POST', body: transformFd,
    })
    const transformData = await transformRes.json()

    // 2. Validate (using original file for now — in production would use transformed)
    const validateFd = new FormData()
    validateFd.append('file', new Blob([fileBuffer]), source.name)
    validateFd.append('source_id', source_id)
    validateFd.append('file_type', fileType)

    const validateRes = await fetch(`${PIPELINE_URL}/validate/run`, {
      method: 'POST', body: validateFd,
    })
    const validateData = await validateRes.json()

    const success = transformRes.ok && validateRes.ok
    const qualityScore = validateData.score ?? null
    const rowsAfter = transformData.rows_after ?? null
    const rowsBefore = transformData.rows_before ?? null

    // Update run record
    if (runRecord) {
      await supabaseAdmin.from('pipeline_run_history').update({
        status: success ? 'success' : 'failed',
        completed_at: new Date().toISOString(),
        quality_score: qualityScore,
        rows_processed: rowsAfter,
        rows_before: rowsBefore,
        rows_after: rowsAfter,
        transformations_applied: (recipe.steps as unknown[]).length,
        tests_passed: validateData.tests?.filter((t: { status: string }) => t.status === 'passed').length ?? 0,
        tests_failed: validateData.tests?.filter((t: { status: string }) => t.status === 'failed').length ?? 0,
        error_message: success ? null : (transformData.detail || validateData.detail || 'Unknown error'),
      }).eq('id', runRecord.id)
    }

    // Update recipe
    await supabaseAdmin.from('pipeline_recipes').update({
      last_run_at: new Date().toISOString(),
      last_run_status: success ? 'success' : 'failed',
      last_quality_score: qualityScore,
      last_row_count: rowsAfter,
      updated_at: new Date().toISOString(),
    }).eq('id', recipe_id)

    return NextResponse.json({
      success,
      quality_score: qualityScore,
      rows_processed: rowsAfter,
      run_id: runRecord?.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pipeline run failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
