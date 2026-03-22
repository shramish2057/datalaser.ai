import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

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

  // Public routes — no auth needed
  const isPublic = pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/invite/')

  // Auth routes — redirect if already logged in
  const isAuthRoute = pathname === '/login' || pathname === '/signup'

  // Protected routes
  const isProtected = pathname.startsWith('/projects') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/app') ||
    // Team routes — any path with 2+ segments not caught above
    (!isPublic && pathname.split('/').filter(Boolean).length >= 2)

  if (!session && isProtected) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isAuthRoute) {
    // Check cached org type to avoid DB query on every request
    const cachedHome = req.cookies.get('dl_home')?.value
    if (cachedHome) {
      return NextResponse.redirect(new URL(cachedHome, req.url))
    }

    // Look up org type for this user
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
