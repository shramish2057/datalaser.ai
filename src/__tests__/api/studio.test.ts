import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------- supabase mock ----------

const mockGetUser = vi.fn()
const mockSupabaseFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockSupabaseFrom,
  })),
}))

// ---------- engine context mock ----------

vi.mock('@/lib/ai/engineContext', () => ({
  getEngineContext: vi.fn(async () => ({ facts: [] })),
  formatFactsForPrompt: vi.fn(() => ''),
  getLocaleFromRequest: vi.fn(() => 'en'),
}))

// ---------- global fetch mock ----------

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Modules resolve PIPELINE_URL at import time from env (default http://localhost:8001).
const PIPELINE_BASE = 'http://localhost:8001'
process.env.ANTHROPIC_API_KEY = 'test-key'

import { POST as suggestPOST } from '@/app/api/studio/suggest/route'
import { GET as notebooksGET, POST as notebooksPOST } from '@/app/api/studio/notebooks/route'
import { POST as executePOST } from '@/app/api/studio/execute/route'

// ---------- helpers ----------

function makeFormDataRequest(
  entries: Record<string, string | Blob>,
  url = 'http://localhost:3000/api/studio/suggest',
): any {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.append(k, v)
  return {
    formData: () => Promise.resolve(fd),
    url,
    headers: { get: () => null },
    nextUrl: new URL(url),
  }
}

function makeNextRequest(
  url: string,
  body?: Record<string, unknown>,
): any {
  const parsedUrl = new URL(url, 'http://localhost:3000')
  return {
    nextUrl: parsedUrl,
    url,
    json: () => Promise.resolve(body ?? {}),
    headers: { get: () => null },
  }
}

// ---------- tests ----------

beforeEach(() => {
  mockGetUser.mockReset()
  mockSupabaseFrom.mockReset()
  mockFetch.mockReset()
})

describe('POST /api/studio/suggest', () => {
  it('proxies single-cell suggestion to pipeline service', async () => {
    const suggestData = { cells: [{ type: 'python', code: 'import pandas' }] }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(suggestData),
    })

    const req = makeFormDataRequest({
      question: 'Show revenue trends',
      schema_context: 'columns: revenue, date',
      file: new Blob(['data'], { type: 'text/csv' }),
      file_type: 'csv',
    })

    const res = await suggestPOST(req)
    const body = await res.json()

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0][0]).toBe(`${PIPELINE_BASE}/analyst/suggest-analysis`)
    expect(body).toEqual(suggestData)
  })

  it('generates full notebook via Claude API when generate_full_notebook is true', async () => {
    const cells = [
      { type: 'heading', level: 1, content: 'Revenue Analysis' },
      { type: 'python', code: 'import pandas as pd' },
    ]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        content: [{ text: JSON.stringify(cells) }],
      }),
    })

    const req = makeFormDataRequest({
      question: 'Analyze revenue',
      schema_context: 'columns: revenue',
      generate_full_notebook: 'true',
      file_type: 'csv',
    })

    const res = await suggestPOST(req)
    const body = await res.json()

    expect(body.type).toBe('full_notebook')
    expect(body.cells).toEqual(cells)
    // Should call Anthropic API, not pipeline
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
  })

  it('returns graceful error when Claude returns unparseable JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        content: [{ text: 'not valid json {{' }],
      }),
    })

    const req = makeFormDataRequest({
      question: 'Test',
      generate_full_notebook: 'true',
    })

    const res = await suggestPOST(req)
    const body = await res.json()

    expect(body.type).toBe('full_notebook')
    expect(body.cells).toEqual([])
    expect(body.error).toContain('Failed to parse notebook')
  })

  it('returns 503 when pipeline is down (single-cell mode)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const req = makeFormDataRequest({ question: 'test' })
    const res = await suggestPOST(req)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('Pipeline service unavailable')
  })
})

describe('GET /api/studio/notebooks', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const req = makeNextRequest('/api/studio/notebooks?project_id=proj-1')
    const res = await notebooksGET(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 when project_id is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const req = makeNextRequest('/api/studio/notebooks')
    const res = await notebooksGET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('project_id required')
  })

  it('returns notebooks list for valid request', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const notebooks = [
      { id: 'nb-1', title: 'Analysis 1', project_id: 'proj-1' },
      { id: 'nb-2', title: 'Analysis 2', project_id: 'proj-1' },
    ]
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: notebooks, error: null }),
        }),
      }),
    })

    const req = makeNextRequest('/api/studio/notebooks?project_id=proj-1')
    const res = await notebooksGET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(notebooks)
    expect(body).toHaveLength(2)
  })

  it('returns 500 on supabase error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS violation' } }),
        }),
      }),
    })

    const req = makeNextRequest('/api/studio/notebooks?project_id=proj-1')
    const res = await notebooksGET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('RLS violation')
  })
})

describe('POST /api/studio/notebooks', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const req = makeNextRequest('/api/studio/notebooks', { project_id: 'proj-1' })
    const res = await notebooksPOST(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 when project_id is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

    const req = makeNextRequest('/api/studio/notebooks', { title: 'Test' })
    const res = await notebooksPOST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('project_id required')
  })

  it('creates a notebook with default title', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const created = { id: 'nb-new', title: 'Untitled Analysis', project_id: 'proj-1' }
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: created, error: null }),
        }),
      }),
    })

    const req = makeNextRequest('/api/studio/notebooks', { project_id: 'proj-1' })
    const res = await notebooksPOST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Untitled Analysis')
    expect(body.id).toBe('nb-new')
  })

  it('creates a notebook with custom title', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const created = { id: 'nb-2', title: 'Revenue Deep Dive', project_id: 'proj-1' }
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: created, error: null }),
        }),
      }),
    })

    const req = makeNextRequest('/api/studio/notebooks', {
      project_id: 'proj-1',
      title: 'Revenue Deep Dive',
    })
    const res = await notebooksPOST(req)
    const body = await res.json()

    expect(body.title).toBe('Revenue Deep Dive')
  })
})

describe('POST /api/studio/execute', () => {
  it('proxies execution to pipeline analyst/execute', async () => {
    const execResult = { success: true, output: { chart_type: 'bar', data: [] } }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(execResult),
    })

    const req = makeFormDataRequest({
      code: 'import pandas as pd\nresult = pd.DataFrame()',
      file: new Blob(['col1,col2\n1,2'], { type: 'text/csv' }),
      file_type: 'csv',
      cell_id: 'cell-1',
    }, 'http://localhost:3000/api/studio/execute')

    const res = await executePOST(req)
    const body = await res.json()

    expect(mockFetch.mock.calls[0][0]).toBe(`${PIPELINE_BASE}/analyst/execute`)
    expect(body.success).toBe(true)
  })

  it('returns upstream error on execution failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: 'SyntaxError in code' }),
    })

    const req = makeFormDataRequest({
      code: 'invalid python {{',
      file: new Blob(['data']),
    }, 'http://localhost:3000/api/studio/execute')

    const res = await executePOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('SyntaxError in code')
  })

  it('returns 503 when pipeline is down', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const req = makeFormDataRequest({
      code: 'print("hello")',
    }, 'http://localhost:3000/api/studio/execute')

    const res = await executePOST(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('Pipeline service unavailable')
  })
})
