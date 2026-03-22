import { NextRequest, NextResponse } from 'next/server'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const schemaContext = formData.get('schema_context')?.toString() || ''
    const question = formData.get('question')?.toString() || ''
    const enhanced = question + (schemaContext ? `\n\nDataset context:\n${schemaContext}` : '')

    const outgoing = new FormData()
    const file = formData.get('file')
    if (file instanceof Blob) outgoing.append('file', file, file instanceof File ? file.name : 'data.csv')
    outgoing.append('question', enhanced)
    const fileType = formData.get('file_type')
    if (fileType) outgoing.append('file_type', fileType.toString())

    const res = await fetch(`${PIPELINE_URL}/analyst/suggest-analysis`, { method: 'POST', body: outgoing })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.detail || 'Suggestion failed' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Pipeline service unavailable' }, { status: 503 })
  }
}
