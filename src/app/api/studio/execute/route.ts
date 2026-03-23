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
    for (const key of ['code', 'file_type', 'cell_id']) {
      const val = formData.get(key)
      if (val) outgoing.append(key, val.toString())
    }
    const code = formData.get('code')?.toString() || ''
    console.log('[execute-proxy] PIPELINE_URL:', PIPELINE_URL)
    console.log('[execute-proxy] code (first 100):', code.slice(0, 100))
    console.log('[execute-proxy] file present:', !!file, 'file size:', file instanceof Blob ? file.size : 0)
    const res = await fetch(`${PIPELINE_URL}/analyst/execute`, { method: 'POST', body: outgoing })
    const data = await res.json()
    console.log('[execute-proxy] response status:', res.status, 'success:', data.success, 'error:', data.error)
    if (!res.ok) return NextResponse.json({ error: data.detail || 'Execution failed' }, { status: res.status })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[execute-proxy] CATCH:', e)
    return NextResponse.json({ error: 'Pipeline service unavailable' }, { status: 503 })
  }
}
