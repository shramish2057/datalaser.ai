import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code)

    if (session) {
      // Check if user has an org — determines where to redirect
      const { data: membership } = await supabase
        .from('org_members')
        .select('organizations(type, slug)')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (!membership) {
        // New user — send to onboarding
        return NextResponse.redirect(new URL('/onboarding/setup', request.url))
      }

      const org = membership.organizations as unknown as { type: string; slug: string }
      const home = org.type === 'team' ? `/${org.slug}` : '/projects'

      const redirect = NextResponse.redirect(new URL(home, request.url))
      redirect.cookies.set('dl_home', home, { maxAge: 3600, path: '/' })
      return redirect
    }
  }

  return NextResponse.redirect(new URL('/projects', request.url))
}
