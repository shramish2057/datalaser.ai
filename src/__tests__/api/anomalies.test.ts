import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/anomalies/route'

describe('POST /api/anomalies', () => {
  it('returns 501 Not implemented', async () => {
    const res = await POST()
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body).toEqual({ error: 'Not implemented' })
  })

  it('returns JSON content type', async () => {
    const res = await POST()
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})
