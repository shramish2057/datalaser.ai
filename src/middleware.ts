import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // Locale detection: cookie > Accept-Language > default 'en'
  if (!req.cookies.get('dl_locale')) {
    const acceptLang = req.headers.get('accept-language') || ''
    const locale = acceptLang.includes('de') ? 'de' : 'en'
    res.cookies.set('dl_locale', locale, { maxAge: 365 * 24 * 3600, path: '/' })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Locale-prefixed public routes
  const isLocalePublic = /^\/(de|en)(\/|$)/.test(pathname)

  // Redirect old /login, /signup to locale-prefixed version
  if (pathname === '/login' || pathname === '/signup') {
    const locale = req.cookies.get('dl_locale')?.value || (req.headers.get('accept-language')?.includes('de') ? 'de' : 'en')
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, req.url))
  }

  // Public routes — no auth needed
  const isPublic = pathname === '/' ||
    isLocalePublic ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/invite/')

  // Auth routes — redirect if already logged in
  const isAuthRoute = /^\/(de|en)\/(login|signup)$/.test(pathname)

  // Protected routes
  const isProtected = pathname.startsWith('/projects') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/app') ||
    // Team routes — any path with 2+ segments not caught above
    (!isPublic && pathname.split('/').filter(Boolean).length >= 2)

  if (!session && isProtected) {
    const locale = req.cookies.get('dl_locale')?.value || (req.headers.get('accept-language')?.includes('de') ? 'de' : 'en')
    const redirectUrl = new URL(`/${locale}/login`, req.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Protect /overview route — owners only
  const overviewMatch = pathname.match(/^\/([^/]+)\/overview/)
  if (session && overviewMatch) {
    const orgSlug = overviewMatch[1]
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()
    if (org) {
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', org.id)
        .eq('user_id', session.user.id)
        .single()
      if (!membership || membership.role !== 'owner') {
        return NextResponse.redirect(new URL(`/${orgSlug}`, req.url))
      }
    }
  }

  // Team users visiting /projects get redirected to their org home
  // Check actual DB org type — never trust cached cookie (stale across logins)
  if (session && pathname.startsWith('/projects')) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('organizations(type, slug)')
      .eq('user_id', session.user.id)
      .limit(1)
      .single()

    if (membership) {
      const org = membership.organizations as unknown as { type: string; slug: string }
      if (org.type === 'team') {
        const home = `/${org.slug}`
        const redirect = NextResponse.redirect(new URL(home, req.url))
        redirect.cookies.set('dl_home', home, { maxAge: 3600, path: '/' })
        return redirect
      }
    }
  }

  if (session && isAuthRoute) {
    // Always check DB — cached cookie may be stale from a different account
    const { data: membership } = await supabase
      .from('org_members')
      .select('organizations(type, slug)')
      .eq('user_id', session.user.id)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.redirect(new URL('/onboarding/setup', req.url))
    }

    const org = membership.organizations as unknown as { type: string; slug: string }
    const home = org.type === 'team' ? `/${org.slug}` : '/projects'

    // Cache for 1 hour
    const redirect = NextResponse.redirect(new URL(home, req.url))
    redirect.cookies.set('dl_home', home, { maxAge: 3600, path: '/' })
    return redirect
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ]
}
