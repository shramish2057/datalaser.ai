import { NextRequest, NextResponse } from 'next/server'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const formData = await request.formData()
    const outgoing = new FormData()

    const file = formData.get('file')
    if (file instanceof Blob) {
      outgoing.append('file', file, file instanceof File ? file.name : 'data.csv')
    }
    for (const key of ['file_type', 'column_profiles', 'column_mapping', 'source_id']) {
      const val = formData.get(key)
      if (val) outgoing.append(key, val.toString())
    }

    // Determine endpoint: /templates/applicable or /templates/{id}/run
    const templateId = formData.get('template_id')?.toString()
    const endpoint = templateId
      ? `${PIPELINE_URL}/templates/${templateId}/run`
      : `${PIPELINE_URL}/templates/applicable`

    const res = await fetch(endpoint, { method: 'POST', body: outgoing })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.detail || 'Template operation failed' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Pipeline service unavailable' }, { status: 503 })
  }
}
