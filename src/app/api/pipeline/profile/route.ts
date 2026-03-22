import { NextRequest, NextResponse } from 'next/server'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    const incomingFormData = await request.formData()

    // Reconstruct FormData to ensure proper forwarding
    const outgoingFormData = new FormData()

    const file = incomingFormData.get('file')
    const sourceId = incomingFormData.get('source_id')

    if (file instanceof Blob) {
      // Get the filename from the form data
      const fileName = file instanceof File ? file.name : 'upload.csv'
      outgoingFormData.append('file', file, fileName)
    }
    if (sourceId) {
      outgoingFormData.append('source_id', sourceId.toString())
    }

    const upstream = await fetch(`${PIPELINE_URL}/profile/file`, {
      method: 'POST',
      body: outgoingFormData,
    })
    const data = await upstream.json()
    if (!upstream.ok) {
      return NextResponse.json({ error: data.detail || 'Profiling failed' }, { status: upstream.status })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Pipeline service unavailable' }, { status: 503 })
  }
}
