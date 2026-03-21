import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

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

  const isAppRoute = req.nextUrl.pathname.startsWith('/app')
  const isOnboardingRoute = req.nextUrl.pathname.startsWith('/onboarding')
  const isAuthRoute = req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup'

  if ((isAppRoute || isOnboardingRoute) && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/app/insights', req.url))
  }
  return res
}

export const config = {
  matcher: ['/app/:path*', '/onboarding/:path*', '/login', '/signup']
}
