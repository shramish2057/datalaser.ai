import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------- mocks ----------

const mockGetSession = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createServerClient: () => ({
    auth: { getSession: mockGetSession },
    from: mockFrom,
  }),
}))

// Lightweight NextRequest / NextResponse stand-ins that match what the
// middleware actually touches.  We keep them minimal so the tests stay fast.

class FakeCookies {
  private jar = new Map<string, string>()
  get(name: string) {
    const v = this.jar.get(name)
    return v !== undefined ? { name, value: v } : undefined
  }
  getAll() {
    return [...this.jar.entries()].map(([name, value]) => ({ name, value }))
  }
  set(name: string, value: string, _opts?: Record<string, unknown>) {
    this.jar.set(name, value)
  }
  seed(name: string, value: string) {
    this.jar.set(name, value)
  }
}

function makeRequest(
  path: string,
  opts: { cookies?: Record<string, string>; acceptLanguage?: string } = {},
) {
  const url = new URL(path, 'http://localhost:3000')
  const cookies = new FakeCookies()
  for (const [k, v] of Object.entries(opts.cookies ?? {})) cookies.seed(k, v)

  const headers = new Map<string, string>()
  if (opts.acceptLanguage) headers.set('accept-language', opts.acceptLanguage)

  return {
    nextUrl: url,
    url: url.toString(),
    cookies,
    headers: { get: (k: string) => headers.get(k) ?? null },
  }
}

// Capture redirects
let redirectedTo: URL | null = null
let nextCalled = false
const nextResponseCookies = new FakeCookies()

vi.mock('next/server', () => ({
  NextResponse: {
    next: () => {
      nextCalled = true
      return {
        cookies: nextResponseCookies,
        headers: new Map(),
      }
    },
    redirect: (url: URL) => {
      redirectedTo = url
      const resCookies = new FakeCookies()
      return { cookies: resCookies, headers: new Map(), _redirectUrl: url }
    },
  },
}))

// We need the real middleware function – import AFTER mocks are set up
import { middleware } from '@/middleware'

// ---------- helpers ----------

function expectRedirectTo(pathOrPattern: string | RegExp) {
  expect(redirectedTo).not.toBeNull()
  const pathname = redirectedTo!.pathname + redirectedTo!.search
  if (typeof pathOrPattern === 'string') {
    expect(pathname).toContain(pathOrPattern)
  } else {
    expect(pathname).toMatch(pathOrPattern)
  }
}

function expectPassThrough() {
  expect(redirectedTo).toBeNull()
  expect(nextCalled).toBe(true)
}

// ---------- tests ----------

describe('middleware', () => {
  beforeEach(() => {
    redirectedTo = null
    nextCalled = false
    mockGetSession.mockReset()
    mockFrom.mockReset()
  })

  // ---- public routes ----

  describe('public routes pass through without redirect', () => {
    const publicPaths = ['/', '/en', '/de', '/en/login', '/de/signup', '/auth/callback']

    for (const path of publicPaths) {
      it(`${path} passes through`, async () => {
        mockGetSession.mockResolvedValue({ data: { session: null } })
        await middleware(makeRequest(path) as any)
        expectPassThrough()
      })
    }
  })

  // ---- locale redirect for bare /login and /signup ----

  describe('/login and /signup redirect to locale-prefixed version', () => {
    it('/login redirects to /en/login by default', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/login') as any)
      expectRedirectTo('/en/login')
    })

    it('/login redirects to /de/login when cookie is de', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/login', { cookies: { dl_locale: 'de' } }) as any)
      expectRedirectTo('/de/login')
    })

    it('/signup redirects to /en/signup by default', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/signup') as any)
      expectRedirectTo('/en/signup')
    })

    it('/signup redirects to /de/signup when Accept-Language includes de', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/signup', { acceptLanguage: 'de-DE,de;q=0.9' }) as any)
      expectRedirectTo('/de/signup')
    })
  })

  // ---- protected routes without auth ----

  describe('protected routes without auth redirect to login', () => {
    it('/projects redirects to /{locale}/login', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/projects') as any)
      expectRedirectTo('/en/login')
    })

    it('/settings redirects to /{locale}/login', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/settings') as any)
      expectRedirectTo('/en/login')
    })

    it('/onboarding redirects to login', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/onboarding') as any)
      expectRedirectTo('/en/login')
    })

    it('/app/something redirects to login', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/app/something') as any)
      expectRedirectTo('/en/login')
    })
  })

  // ---- next param preserved in login redirect ----

  describe('next param preserved in login redirect URL', () => {
    it('/projects preserves next=/projects', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/projects') as any)
      expect(redirectedTo).not.toBeNull()
      expect(redirectedTo!.searchParams.get('next')).toBe('/projects')
    })

    it('/settings preserves next=/settings', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/settings') as any)
      expect(redirectedTo).not.toBeNull()
      expect(redirectedTo!.searchParams.get('next')).toBe('/settings')
    })
  })

  // ---- protected routes with auth ----

  describe('protected routes with auth pass through', () => {
    it('/projects passes through when authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      })
      await middleware(makeRequest('/projects') as any)
      expectPassThrough()
    })

    it('/settings passes through when authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      })
      await middleware(makeRequest('/settings') as any)
      expectPassThrough()
    })
  })

  // ---- locale detection ----

  describe('locale detection', () => {
    it('defaults to en when no cookie and no Accept-Language', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(makeRequest('/projects') as any)
      expectRedirectTo('/en/login')
    })

    it('uses de from Accept-Language header', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(
        makeRequest('/projects', { acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8' }) as any,
      )
      expectRedirectTo('/de/login')
    })

    it('uses dl_locale cookie over Accept-Language', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      await middleware(
        makeRequest('/projects', {
          cookies: { dl_locale: 'de' },
          acceptLanguage: 'en-US,en;q=0.9',
        }) as any,
      )
      expectRedirectTo('/de/login')
    })
  })

  // ---- auth route with session redirects to home ----

  describe('authenticated user on auth routes', () => {
    it('redirects to cached home if dl_home cookie exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      })
      await middleware(
        makeRequest('/en/login', { cookies: { dl_home: '/projects' } }) as any,
      )
      expectRedirectTo('/projects')
    })

    it('redirects to /onboarding/setup when no membership found', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      })
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      }
      mockFrom.mockReturnValue(mockChain)
      await middleware(makeRequest('/en/login') as any)
      expectRedirectTo('/onboarding/setup')
    })

    it('redirects to /projects for personal org member', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      })
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { organizations: { type: 'personal', slug: 'personal' } },
        }),
      }
      mockFrom.mockReturnValue(mockChain)
      await middleware(makeRequest('/en/login') as any)
      expectRedirectTo('/projects')
    })

    it('redirects to /{slug} for team org member', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      })
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { organizations: { type: 'team', slug: 'acme' } },
        }),
      }
      mockFrom.mockReturnValue(mockChain)
      await middleware(makeRequest('/en/login') as any)
      expectRedirectTo('/acme')
    })
  })
})
