import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing
vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createBrowserClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
}))

import { getEngineContext, formatFactsForPrompt, getLocaleFromRequest } from '@/lib/ai/engineContext'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

beforeEach(() => {
  vi.restoreAllMocks()
  // Re-setup default mock
  vi.mocked(createBrowserClient).mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  } as any)
})

describe('getEngineContext', () => {
  it('returns empty facts and null raw when no sourceId or file provided', async () => {
    const result = await getEngineContext()
    expect(result.facts).toEqual([])
    expect(result.raw).toBeNull()
  })

  it('returns empty when supabase returns no auto_analysis', async () => {
    vi.mocked(createBrowserClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { auto_analysis: null }, error: null }),
          })),
        })),
      })),
    } as any)

    const result = await getEngineContext('source-1')
    expect(result.facts).toEqual([])
    expect(result.raw).toBeNull()
  })

  it('formats top_insights from supabase auto_analysis', async () => {
    const mockAnalysis = {
      top_insights: [
        { headline: 'Revenue is growing 15% YoY' },
        { headline: 'Customer churn decreased' },
      ],
      row_count: 5000,
      column_count: 12,
    }

    vi.mocked(createBrowserClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { auto_analysis: mockAnalysis }, error: null }),
          })),
        })),
      })),
    } as any)

    const result = await getEngineContext('source-1')
    expect(result.facts).toContain('[VERIFIED] Revenue is growing 15% YoY')
    expect(result.facts).toContain('[VERIFIED] Customer churn decreased')
    expect(result.facts.some((f) => f.includes('5,000 rows'))).toBe(true)
    expect(result.facts.some((f) => f.includes('12 columns'))).toBe(true)
    expect(result.raw).toBe(mockAnalysis)
  })

  it('includes correlation summary in facts', async () => {
    const mockAnalysis = {
      top_insights: [],
      correlations: {
        pairs: [
          { col1: 'A', col2: 'B', r: 0.9, significant: true },
          { col1: 'C', col2: 'D', r: 0.1, significant: false },
        ],
      },
    }

    vi.mocked(createBrowserClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { auto_analysis: mockAnalysis }, error: null }),
          })),
        })),
      })),
    } as any)

    const result = await getEngineContext('source-1')
    expect(result.facts.some((f) => f.includes('1 of 2 variable pairs are significantly correlated'))).toBe(true)
  })

  it('includes cluster info in facts', async () => {
    const mockAnalysis = {
      top_insights: [],
      clusters: {
        n_clusters: 3,
        clusters: [
          { size: 100, pct: 33 },
          { size: 100, pct: 33 },
          { size: 100, pct: 34 },
        ],
      },
    }

    vi.mocked(createBrowserClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { auto_analysis: mockAnalysis }, error: null }),
          })),
        })),
      })),
    } as any)

    const result = await getEngineContext('source-1')
    expect(result.facts.some((f) => f.includes('3 natural clusters'))).toBe(true)
  })

  it('includes anomaly info in facts', async () => {
    const mockAnalysis = {
      top_insights: [],
      anomalies: [
        { column: 'Revenue', outlier_pct: 5.2 },
        { column: 'Cost', outlier_pct: 2.1 },
      ],
    }

    vi.mocked(createBrowserClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { auto_analysis: mockAnalysis }, error: null }),
          })),
        })),
      })),
    } as any)

    const result = await getEngineContext('source-1')
    expect(result.facts.some((f) => f.includes('2 columns have outliers'))).toBe(true)
    expect(result.facts.some((f) => f.includes('Revenue'))).toBe(true)
    expect(result.facts.some((f) => f.includes('5.2%'))).toBe(true)
  })

  it('limits top_insights to 6', async () => {
    const mockAnalysis = {
      top_insights: Array.from({ length: 10 }, (_, i) => ({ headline: `Insight ${i}` })),
    }

    vi.mocked(createBrowserClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { auto_analysis: mockAnalysis }, error: null }),
          })),
        })),
      })),
    } as any)

    const result = await getEngineContext('source-1')
    const insightFacts = result.facts.filter((f) => f.startsWith('[VERIFIED] Insight'))
    expect(insightFacts).toHaveLength(6)
  })

  it('falls through to file upload when supabase throws', async () => {
    vi.mocked(createBrowserClient).mockReturnValue({
      from: vi.fn(() => {
        throw new Error('connection failed')
      }),
    } as any)

    // No file provided either, so should return empty
    const result = await getEngineContext('source-1')
    expect(result.facts).toEqual([])
    expect(result.raw).toBeNull()
  })

  it('calls pipeline service when file is provided and no cached data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        top_insights: [{ headline: 'File analysis result' }],
        row_count: 100,
        column_count: 5,
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const file = new Blob(['col1,col2\n1,2'], { type: 'text/csv' })
    const result = await getEngineContext(undefined, undefined, file, 'csv')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8001/auto-analysis/run',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.facts.some((f) => f.includes('File analysis result'))).toBe(true)

    vi.unstubAllGlobals()
  })

  it('returns empty when pipeline fetch fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    const file = new Blob(['data'], { type: 'text/csv' })
    const result = await getEngineContext(undefined, undefined, file, 'csv')
    expect(result.facts).toEqual([])

    vi.unstubAllGlobals()
  })
})

describe('formatFactsForPrompt', () => {
  it('returns empty string for English with no facts', () => {
    expect(formatFactsForPrompt([], 'en')).toBe('')
  })

  it('includes German language block for "de" locale with no facts', () => {
    const result = formatFactsForPrompt([], 'de')
    expect(result).toContain('SPRACHE: Antworte IMMER auf Deutsch')
    expect(result).toContain('1.234,56')
    expect(result).toContain('TT.MM.JJJJ')
  })

  it('includes facts in the output', () => {
    const facts = ['[VERIFIED] Revenue grew 10%', '[VERIFIED] 3 clusters found']
    const result = formatFactsForPrompt(facts, 'en')
    expect(result).toContain('[VERIFIED] Revenue grew 10%')
    expect(result).toContain('[VERIFIED] 3 clusters found')
    expect(result).toContain('PRE-COMPUTED VERIFIED FACTS')
    expect(result).toContain('IMPORTANT: Reference these verified facts')
  })

  it('includes both German block and facts for "de" locale', () => {
    const facts = ['[VERIFIED] Test fact']
    const result = formatFactsForPrompt(facts, 'de')
    expect(result).toContain('SPRACHE')
    expect(result).toContain('[VERIFIED] Test fact')
  })

  it('defaults to English locale', () => {
    const result = formatFactsForPrompt([])
    expect(result).toBe('')
  })
})

describe('getLocaleFromRequest', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('https://example.com', {
      headers: new Headers(headers),
    })
  }

  it('returns locale from x-locale header', () => {
    expect(getLocaleFromRequest(makeRequest({ 'x-locale': 'de' }))).toBe('de')
    expect(getLocaleFromRequest(makeRequest({ 'x-locale': 'en' }))).toBe('en')
  })

  it('ignores invalid x-locale header', () => {
    expect(getLocaleFromRequest(makeRequest({ 'x-locale': 'fr' }))).toBe('en')
  })

  it('reads locale from cookie', () => {
    expect(getLocaleFromRequest(makeRequest({ cookie: 'dl_locale=de; other=val' }))).toBe('de')
  })

  it('reads locale from Accept-Language header', () => {
    expect(getLocaleFromRequest(makeRequest({ 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' }))).toBe('de')
  })

  it('defaults to "en" when no locale indicators present', () => {
    expect(getLocaleFromRequest(makeRequest({}))).toBe('en')
  })

  it('prioritizes x-locale over cookie', () => {
    expect(getLocaleFromRequest(makeRequest({ 'x-locale': 'en', cookie: 'dl_locale=de' }))).toBe('en')
  })

  it('prioritizes cookie over Accept-Language', () => {
    expect(getLocaleFromRequest(makeRequest({
      cookie: 'dl_locale=en',
      'accept-language': 'de-DE,de;q=0.9',
    }))).toBe('en')
  })
})
