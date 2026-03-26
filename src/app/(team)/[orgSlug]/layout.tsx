'use client'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/Logo'
import { useEffect, useState } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  ChevronLeft, ChevronRight, LogOut, Settings, Users, CreditCard, Layers, LayoutDashboard
} from 'lucide-react'
import type { Organization, Workspace } from '@/types/database'

export default function OrgShellLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const pathname = usePathname()
  const params = useParams()
  const orgSlug = params.orgSlug as string

  // If inside a workspace (2+ segments after org), let the workspace layout handle it
  const afterOrg = pathname.replace(`/${orgSlug}`, '').split('/').filter(Boolean)
  const wsSlug = afterOrg[0]
  const isInsideWorkspace = afterOrg.length >= 1 &&
    wsSlug !== 'settings' && wsSlug !== 'overview' // these are org-level, not workspace

  if (isInsideWorkspace) {
    return <>{children}</>
  }

  return <OrgShell orgSlug={orgSlug}>{children}</OrgShell>
}

function OrgShell({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const t = useTranslations()
  const [org, setOrg] = useState<Organization | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [userName, setUserName] = useState('')
  const [orgRole, setOrgRole] = useState<string | null>(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const stored = localStorage.getItem('mb-sidebar')
    if (stored !== null) setSidebarExpanded(stored === 'true')
  }, [])

  const toggleSidebar = () => {
    const next = !sidebarExpanded
    setSidebarExpanded(next)
    localStorage.setItem('mb-sidebar', String(next))
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      setUserName(
        session.user.user_metadata?.full_name ??
        session.user.user_metadata?.name ??
        session.user.email?.split('@')[0] ?? ''
      )

      const { data: o } = await supabase
        .from('organizations').select('*').eq('slug', orgSlug).single()
      if (!o) { router.push('/projects'); return }
      setOrg(o)

      // Get user's org role
      const { data: orgMembership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', o.id)
        .eq('user_id', session.user.id)
        .single()
      const role = orgMembership?.role || null
      setOrgRole(role)

      // Owners see ALL workspaces; others see only their memberships
      if (role === 'owner') {
        const { data: wsList } = await supabase
          .from('workspaces').select('*').eq('org_id', o.id)
          .order('created_at', { ascending: true })
        setWorkspaces(wsList ?? [])
      } else {
        const { data: memberships } = await supabase
          .from('workspace_members').select('workspace_id').eq('user_id', session.user.id)

        if (memberships && memberships.length > 0) {
          const wsIds = memberships.map(m => m.workspace_id)
          const { data: wsList } = await supabase
            .from('workspaces').select('*').eq('org_id', o.id).in('id', wsIds)
            .order('created_at', { ascending: true })
          setWorkspaces(wsList ?? [])
        }
      }

      setLoading(false)
    }
    load()
  }, [orgSlug])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-dl-bg-light items-center justify-center font-sans">
        <div className="text-dl-text-medium text-dl-base">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dl-bg-light overflow-hidden font-sans">
      <aside className={`
        ${sidebarExpanded ? 'w-[260px]' : 'w-[52px]'}
        flex-shrink-0 h-screen bg-dl-bg border-r border-dl-border
        flex flex-col transition-all duration-150
      `}>
        {/* Logo */}
        <div className={`
          h-[48px] flex items-center border-b border-dl-border flex-shrink-0
          ${sidebarExpanded ? 'px-4' : 'justify-center'}
        `}>
          {sidebarExpanded ? (
            <Logo size="sm" />
          ) : (
            <span className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </span>
          )}
        </div>

        {/* Org name */}
        <div className={`
          flex items-center border-b border-dl-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 py-3 gap-2.5' : 'justify-center py-3'}
        `}>
          {org?.logo_url ? (
            <div className="w-8 h-8 rounded-dl-md overflow-hidden flex-shrink-0">
              <img src={org.logo_url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-dl-md bg-dl-brand flex items-center justify-center text-white font-black text-dl-xs flex-shrink-0">
              {org?.name?.[0]?.toUpperCase()}
            </div>
          )}
          {sidebarExpanded && (
            <span className="font-black text-dl-text-dark text-dl-sm truncate">{org?.name}</span>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* DL Overview — owners only */}
          {orgRole === 'owner' && (
            <>
              <Link
                href={`/${orgSlug}/overview`}
                className={`
                  relative flex items-center h-[40px] font-sans font-bold text-dl-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${pathname === `/${orgSlug}/overview`
                    ? 'text-dl-brand bg-dl-brand-hover'
                    : 'text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light'}
                `}
              >
                {pathname === `/${orgSlug}/overview` && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-dl-brand rounded-r-sm" />
                )}
                <LayoutDashboard size={14} className="flex-shrink-0" />
                {sidebarExpanded && <span>{t('overview.title')}</span>}
              </Link>
              {sidebarExpanded && <div className="h-px bg-dl-border mx-4 my-2" />}
            </>
          )}

          {sidebarExpanded && (
            <p className="dl-section-header px-4 mb-2">{t('teams.title')}</p>
          )}
          {workspaces.map(ws => {
            const active = pathname === `/${orgSlug}/${ws.slug}` || pathname.startsWith(`/${orgSlug}/${ws.slug}/`)
            return (
              <Link
                key={ws.id}
                href={`/${orgSlug}/${ws.slug}`}
                className={`
                  relative flex items-center h-[40px] font-sans font-bold text-dl-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active
                    ? 'text-dl-brand bg-dl-brand-hover'
                    : 'text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light'}
                `}
              >
                {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-dl-brand rounded-r-sm" />}
                <Layers size={14} className="flex-shrink-0" />
                {sidebarExpanded && <span className="truncate">{ws.name}</span>}
              </Link>
            )
          })}

          {/* Divider + Org nav */}
          {sidebarExpanded && (
            <>
              <div className="h-px bg-dl-border mx-4 my-3" />
              <p className="dl-section-header px-4 mb-2">Organization</p>
            </>
          )}

          {[
            { icon: Users, label: t('settings.members'), href: `/${orgSlug}/settings/members` },
            { icon: Settings, label: t('nav.settings'), href: `/${orgSlug}/settings` },
            { icon: CreditCard, label: t('settings.billing'), href: `/${orgSlug}/settings/billing` },
          ].map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const isInSettings = pathname.startsWith(`/${orgSlug}/settings`)
            return (
              <button
                key={item.label}
                onClick={() => {
                  // Toggle: if already on this settings page (or any settings), go back to org home
                  if (active || (item.href === `/${orgSlug}/settings` && isInSettings)) {
                    router.push(`/${orgSlug}`)
                  } else {
                    router.push(item.href)
                  }
                }}
                className={`
                  relative flex items-center h-[40px] w-full font-sans font-bold text-dl-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active
                    ? 'text-dl-brand bg-dl-brand-hover'
                    : 'text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light'}
                `}
              >
                {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-dl-brand rounded-r-sm" />}
                <item.icon size={14} className="flex-shrink-0" />
                {sidebarExpanded && <span>{item.label}</span>}
              </button>
            )
          })}
        </div>

        {/* Bottom */}
        <div className="border-t border-dl-border flex-shrink-0">
          {sidebarExpanded && userName && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-dl-bg-medium flex items-center justify-center text-dl-xs font-black text-dl-text-medium">
                  {userName[0]?.toUpperCase()}
                </div>
                <span className="text-dl-xs font-bold text-dl-text-dark truncate">{userName}</span>
              </div>
            </div>
          )}

          <button onClick={toggleSidebar}
            className="flex items-center justify-center w-full h-[40px]
              text-dl-text-light hover:text-dl-text-medium hover:bg-dl-bg-light transition-colors">
            {sidebarExpanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>

          <button onClick={logout}
            className={`flex items-center h-[40px] w-full font-bold text-dl-sm
              text-dl-text-light hover:text-red-500 hover:bg-red-50 transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}`}>
            <LogOut size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>{t('common.logOut')}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-dl-bg-light">
        {children}
      </main>
    </div>
  )
}
