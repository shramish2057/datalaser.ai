import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------- global fetch mock ----------
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// The route modules resolve PIPELINE_URL at module scope from env (default http://localhost:8001).
const PIPELINE_BASE = 'http://localhost:8001'

import { POST as profilePOST } from '@/app/api/pipeline/profile/route'
import { POST as transformPOST } from '@/app/api/pipeline/transform/route'
import { POST as validatePOST } from '@/app/api/pipeline/validate/route'
import { POST as templatesPOST } from '@/app/api/pipeline/templates/route'
import { POST as autoAnalysisPOST } from '@/app/api/pipeline/auto-analysis/route'

// ---------- helpers ----------

function makeFormDataRequest(entries: Record<string, string | Blob>): any {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.append(k, v)
  return {
    formData: () => Promise.resolve(fd),
    url: 'http://localhost:3000/api/pipeline/templates',
  } as any
}

function mockUpstreamOk(data: Record<string, unknown>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  })
}

function mockUpstreamError(status: number, detail: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
  })
}

function mockUpstreamDown() {
  mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
}

// ---------- tests ----------

beforeEach(() => {
  mockFetch.mockReset()
})

describe('pipeline/profile proxy', () => {
  it('proxies to /profile/file and returns data', async () => {
    const profileData = { columns: ['a', 'b'], row_count: 100 }
    mockUpstreamOk(profileData)

    const file = new Blob(['col1,col2\n1,2'], { type: 'text/csv' })
    const req = makeFormDataRequest({ file, source_id: 'src-1' })
    const res = await profilePOST(req)
    const body = await res.json()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe(`${PIPELINE_BASE}/profile/file`)
    expect(opts.method).toBe('POST')
    expect(body).toEqual(profileData)
    // Cache headers
    expect(res.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
  })

  it('returns upstream error status', async () => {
    mockUpstreamError(422, 'Bad CSV')
    const req = makeFormDataRequest({ source_id: 'src-1' })
    const res = await profilePOST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Bad CSV')
  })

  it('returns 503 when pipeline is down', async () => {
    mockUpstreamDown()
    const req = makeFormDataRequest({ source_id: 'src-1' })
    const res = await profilePOST(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('Pipeline service unavailable')
  })
})

describe('pipeline/transform proxy', () => {
  it('proxies to /transform/apply', async () => {
    const transformData = { transformed: true, row_count: 50 }
    mockUpstreamOk(transformData)

    const req = makeFormDataRequest({ file: new Blob(['data']), rule: 'uppercase' })
    const res = await transformPOST(req)
    const body = await res.json()

    expect(mockFetch.mock.calls[0][0]).toBe(`${PIPELINE_BASE}/transform/apply`)
    expect(body).toEqual(transformData)
  })

  it('returns 503 when pipeline is down', async () => {
    mockUpstreamDown()
    const req = makeFormDataRequest({ rule: 'x' })
    const res = await transformPOST(req)
    expect(res.status).toBe(503)
  })
})

describe('pipeline/validate proxy', () => {
  it('proxies to /validate/run', async () => {
    const validateData = { valid: true, errors: [] }
    mockUpstreamOk(validateData)

    const req = makeFormDataRequest({ file: new Blob(['data']) })
    const res = await validatePOST(req)
    const body = await res.json()

    expect(mockFetch.mock.calls[0][0]).toBe(`${PIPELINE_BASE}/validate/run`)
    expect(body).toEqual(validateData)
  })

  it('forwards upstream error detail', async () => {
    mockUpstreamError(400, 'Validation failed: missing columns')
    const req = makeFormDataRequest({ file: new Blob(['']) })
    const res = await validatePOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed: missing columns')
  })
})

describe('pipeline/templates proxy', () => {
  it('proxies to /templates/applicable when no template_id', async () => {
    const templatesData = { templates: [{ id: 't1', name: 'Clean dates' }] }
    mockUpstreamOk(templatesData)

    const req = makeFormDataRequest({
      file: new Blob(['data']),
      file_type: 'csv',
      column_profiles: '{}',
    })
    const res = await templatesPOST(req)
    const body = await res.json()

    expect(mockFetch.mock.calls[0][0]).toBe(`${PIPELINE_BASE}/templates/applicable`)
    expect(body).toEqual(templatesData)
  })

  it('proxies to /templates/{id}/run when template_id provided', async () => {
    mockUpstreamOk({ success: true })

    const req = makeFormDataRequest({
      file: new Blob(['data']),
      template_id: 'tmpl-42',
    })
    const res = await templatesPOST(req)

    expect(mockFetch.mock.calls[0][0]).toBe(`${PIPELINE_BASE}/templates/tmpl-42/run`)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 503 when pipeline is down', async () => {
    mockUpstreamDown()
    const req = makeFormDataRequest({ file: new Blob(['']) })
    const res = await templatesPOST(req)
    expect(res.status).toBe(503)
  })
})

describe('pipeline/auto-analysis proxy', () => {
  it('proxies to /auto-analysis/run', async () => {
    const analysisData = { insights: ['outlier in col A'], score: 0.87 }
    mockUpstreamOk(analysisData)

    const req = makeFormDataRequest({
      file: new Blob(['data']),
      file_type: 'csv',
      source_id: 'src-1',
    })
    const res = await autoAnalysisPOST(req)
    const body = await res.json()

    expect(mockFetch.mock.calls[0][0]).toBe(`${PIPELINE_BASE}/auto-analysis/run`)
    expect(body).toEqual(analysisData)
  })

  it('returns upstream error when analysis fails', async () => {
    mockUpstreamError(500, 'Internal analysis error')
    const req = makeFormDataRequest({ file: new Blob(['']) })
    const res = await autoAnalysisPOST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal analysis error')
  })

  it('returns 503 when pipeline is down', async () => {
    mockUpstreamDown()
    const req = makeFormDataRequest({ file: new Blob(['']) })
    const res = await autoAnalysisPOST(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('Pipeline service unavailable')
  })
})

describe('all proxies pass correct HTTP method', () => {
  it('all use POST', async () => {
    mockUpstreamOk({})
    mockUpstreamOk({})
    mockUpstreamOk({})

    const req = makeFormDataRequest({ file: new Blob(['x']) })
    await transformPOST(req)
    await validatePOST(makeFormDataRequest({ file: new Blob(['x']) }))
    await autoAnalysisPOST(makeFormDataRequest({ file: new Blob(['x']) }))

    for (const call of mockFetch.mock.calls) {
      expect(call[1].method).toBe('POST')
    }
  })
})
