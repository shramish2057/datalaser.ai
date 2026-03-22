import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sourceId = formData.get('source_id') as string | null

    if (!file || !sourceId) {
      return NextResponse.json({ error: 'file and source_id are required' }, { status: 400 })
    }

    const storagePath = `${user.id}/${sourceId}/${file.name}`
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('data-sources')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: 'Upload failed', message: uploadError.message },
        { status: 500 }
      )
    }

    // Update the data_source record with file_path
    await supabase
      .from('data_sources')
      .update({ file_path: storagePath })
      .eq('id', sourceId)

    return NextResponse.json({ success: true, file_path: storagePath })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
