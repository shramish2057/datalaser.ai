import { NextRequest, NextResponse } from 'next/server'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const upstream = await fetch(`${PIPELINE_URL}/join/detect`, {
      method: 'POST',
      body: formData,
    })
    const data = await upstream.json()
    if (!upstream.ok) {
      return NextResponse.json({ error: data.detail || 'Join detection failed' }, { status: upstream.status })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Pipeline service unavailable' }, { status: 503 })
  }
}
