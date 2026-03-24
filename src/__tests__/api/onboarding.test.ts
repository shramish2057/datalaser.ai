import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------- supabase mock ----------

const mockGetUser = vi.fn()
const mockFromSelect = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'profiles') return { upsert: mockUpsert }
      return { select: mockFromSelect }
    },
  })),
}))

// ---------- bootstrap mock ----------

const mockCreatePersonalOrg = vi.fn()
const mockCreateTeamOrg = vi.fn()
const mockCreateProject = vi.fn()

vi.mock('@/lib/bootstrap', () => ({
  createPersonalOrg: (...args: unknown[]) => mockCreatePersonalOrg(...args),
  createTeamOrg: (...args: unknown[]) => mockCreateTeamOrg(...args),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}))

// ---------- AI mock ----------

const mockSuggestMetrics = vi.fn()

vi.mock('@/lib/ai/claude', () => ({
  suggestMetrics: (...args: unknown[]) => mockSuggestMetrics(...args),
}))

import { POST as completeOnboarding } from '@/app/api/onboarding/complete/route'
import { POST as suggestMetrics } from '@/app/api/onboarding/suggest-metrics/route'

// ---------- helpers ----------

function jsonRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/onboarding/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------- tests ----------

beforeEach(() => {
  mockGetUser.mockReset()
  mockCreatePersonalOrg.mockReset()
  mockCreateTeamOrg.mockReset()
  mockCreateProject.mockReset()
  mockUpsert.mockReset()
  mockSuggestMetrics.mockReset()
})

describe('POST /api/onboarding/complete', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } })
    const res = await completeOnboarding(jsonRequest({ mode: 'personal' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('creates personal org, workspace, and project', async () => {
    const fakeUser = { id: 'user-1' }
    const fakeOrg = { id: 'org-1', type: 'personal' }
    const fakeWorkspace = { id: 'ws-1', name: 'Default' }
    const fakeProject = { id: 'proj-1', name: 'My Project' }

    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockCreatePersonalOrg.mockResolvedValue({ org: fakeOrg, workspace: fakeWorkspace })
    mockCreateProject.mockResolvedValue(fakeProject)
    mockUpsert.mockResolvedValue({ data: null, error: null })

    const res = await completeOnboarding(
      jsonRequest({
        userName: 'Alice',
        mode: 'personal',
        projectName: 'My Project',
        projectIcon: 'chart',
        projectColor: 'blue',
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.org).toEqual(fakeOrg)
    expect(body.workspace).toEqual(fakeWorkspace)
    expect(body.project).toEqual(fakeProject)

    expect(mockCreatePersonalOrg).toHaveBeenCalledWith('user-1', 'Alice')
    expect(mockCreateProject).toHaveBeenCalledWith(
      'user-1', 'ws-1', 'org-1', 'My Project', 'chart', 'blue',
    )
  })

  it('creates team org when mode is team', async () => {
    const fakeUser = { id: 'user-2' }
    const fakeOrg = { id: 'org-2', type: 'team' }
    const fakeWorkspace = { id: 'ws-2', name: 'Engineering' }
    const fakeProject = { id: 'proj-2' }

    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockCreateTeamOrg.mockResolvedValue({ org: fakeOrg, workspace: fakeWorkspace })
    mockCreateProject.mockResolvedValue(fakeProject)
    mockUpsert.mockResolvedValue({ data: null, error: null })

    const res = await completeOnboarding(
      jsonRequest({
        userName: 'Bob',
        mode: 'team',
        orgName: 'Acme Inc',
        workspaceName: 'Engineering',
        projectName: 'Analytics',
        projectIcon: 'bar',
        projectColor: 'green',
      }),
    )

    expect(res.status).toBe(200)
    expect(mockCreateTeamOrg).toHaveBeenCalledWith('user-2', 'Acme Inc', 'Engineering')
  })

  it('returns 500 when bootstrap throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    mockCreatePersonalOrg.mockRejectedValue(new Error('DB connection lost'))

    const res = await completeOnboarding(
      jsonRequest({ userName: 'x', mode: 'personal', projectName: 'p' }),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB connection lost')
  })
})

describe('POST /api/onboarding/suggest-metrics', () => {
  it('returns 400 when no files provided', async () => {
    const res = await suggestMetrics(
      new Request('http://localhost:3000/api/onboarding/suggest-metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No file data provided')
  })

  it('returns 400 when files array is empty', async () => {
    const res = await suggestMetrics(
      new Request('http://localhost:3000/api/onboarding/suggest-metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ files: [] }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when no file has columns', async () => {
    const res = await suggestMetrics(
      new Request('http://localhost:3000/api/onboarding/suggest-metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ files: [{ name: 'test.csv', columns: [] }] }),
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No column data found in uploaded files')
  })

  it('returns structured suggestions when valid files provided', async () => {
    const fakeSuggestions = {
      metrics: [
        { name: 'Revenue Growth', type: 'percentage', column: 'revenue' },
        { name: 'Customer Count', type: 'count', column: 'customer_id' },
      ],
    }
    mockSuggestMetrics.mockResolvedValue(fakeSuggestions)

    const res = await suggestMetrics(
      new Request('http://localhost:3000/api/onboarding/suggest-metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: 'sales.csv', columns: ['revenue', 'customer_id', 'date'] }],
        }),
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(fakeSuggestions)
    expect(mockSuggestMetrics).toHaveBeenCalledWith([
      { name: 'sales.csv', columns: ['revenue', 'customer_id', 'date'] },
    ])
  })

  it('returns 500 when AI service throws', async () => {
    mockSuggestMetrics.mockRejectedValue(new Error('API quota exceeded'))

    const res = await suggestMetrics(
      new Request('http://localhost:3000/api/onboarding/suggest-metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: 'data.csv', columns: ['col1'] }],
        }),
      }),
    )

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('API quota exceeded')
  })
})
