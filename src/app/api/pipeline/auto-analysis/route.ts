import { NextRequest, NextResponse } from 'next/server'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const outgoing = new FormData()

    const file = formData.get('file')
    if (file instanceof Blob) {
      outgoing.append('file', file, file instanceof File ? file.name : 'data.csv')
    }
    for (const key of ['file_type', 'source_id', 'column_profiles']) {
      const val = formData.get(key)
      if (val) outgoing.append(key, val.toString())
    }

    const res = await fetch(`${PIPELINE_URL}/auto-analysis/run`, {
      method: 'POST',
      body: outgoing,
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.detail || 'Auto-analysis failed' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Pipeline service unavailable' }, { status: 503 })
  }
}
