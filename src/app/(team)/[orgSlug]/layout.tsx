'use client'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  ChevronLeft, ChevronRight, LogOut, Settings, Users, CreditCard, Layers
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
    wsSlug !== 'settings' // settings is org-level, not workspace

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

      const { data: memberships } = await supabase
        .from('workspace_members').select('workspace_id').eq('user_id', session.user.id)

      if (memberships && memberships.length > 0) {
        const wsIds = memberships.map(m => m.workspace_id)
        const { data: wsList } = await supabase
          .from('workspaces').select('*').eq('org_id', o.id).in('id', wsIds)
          .order('created_at', { ascending: true })
        setWorkspaces(wsList ?? [])
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
      <div className="flex h-screen bg-mb-bg-light items-center justify-center font-sans">
        <div className="text-mb-text-medium text-mb-base">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-mb-bg-light overflow-hidden font-sans">
      <aside className={`
        ${sidebarExpanded ? 'w-[220px]' : 'w-[52px]'}
        flex-shrink-0 h-screen bg-mb-bg border-r border-mb-border
        flex flex-col transition-all duration-150
      `}>
        {/* Org header */}
        <div className={`
          h-[65px] flex items-center border-b border-mb-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 gap-2' : 'justify-center'}
        `}>
          {sidebarExpanded ? (
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-mb-md bg-mb-brand flex items-center justify-center text-white font-black text-mb-xs">
                  {org?.name?.[0]?.toUpperCase()}
                </div>
                <span className="font-black text-mb-text-dark text-mb-sm truncate">{org?.name}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 ml-9">
                <span className="text-mb-brand text-[10px] font-black">▲</span>
                <span className="text-mb-text-light text-[10px] font-bold">DataLaser</span>
              </div>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-mb-md bg-mb-brand flex items-center justify-center text-white font-black text-mb-xs">
              {org?.name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Workspaces */}
        <div className="flex-1 overflow-y-auto py-2">
          {sidebarExpanded && (
            <p className="mb-section-header px-4 mb-2">Workspaces</p>
          )}
          {workspaces.map(ws => {
            const active = pathname === `/${orgSlug}/${ws.slug}` || pathname.startsWith(`/${orgSlug}/${ws.slug}/`)
            return (
              <Link
                key={ws.id}
                href={`/${orgSlug}/${ws.slug}`}
                className={`
                  relative flex items-center h-[36px] font-sans font-bold text-mb-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active
                    ? 'text-mb-brand bg-mb-brand-hover'
                    : 'text-mb-text-medium hover:text-mb-text-dark hover:bg-mb-bg-light'}
                `}
              >
                {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-mb-brand rounded-r-sm" />}
                <Layers size={14} className="flex-shrink-0" />
                {sidebarExpanded && <span className="truncate">{ws.name}</span>}
              </Link>
            )
          })}

          {/* Divider + Org nav */}
          {sidebarExpanded && (
            <>
              <div className="h-px bg-mb-border mx-4 my-3" />
              <p className="mb-section-header px-4 mb-2">Organization</p>
            </>
          )}

          {[
            { icon: Users, label: t('settings.members'), href: `/${orgSlug}/settings/members` },
            { icon: Settings, label: t('nav.settings'), href: `/${orgSlug}/settings` },
            { icon: CreditCard, label: t('settings.billing'), href: `/${orgSlug}/settings/billing` },
          ].map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`
                  relative flex items-center h-[36px] font-sans font-bold text-mb-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active
                    ? 'text-mb-brand bg-mb-brand-hover'
                    : 'text-mb-text-medium hover:text-mb-text-dark hover:bg-mb-bg-light'}
                `}
              >
                {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-mb-brand rounded-r-sm" />}
                <item.icon size={14} className="flex-shrink-0" />
                {sidebarExpanded && <span>{item.label}</span>}
              </Link>
            )
          })}
        </div>

        {/* Bottom */}
        <div className="border-t border-mb-border flex-shrink-0">
          {sidebarExpanded && userName && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-mb-bg-medium flex items-center justify-center text-mb-xs font-black text-mb-text-medium">
                  {userName[0]?.toUpperCase()}
                </div>
                <span className="text-mb-xs font-bold text-mb-text-dark truncate">{userName}</span>
              </div>
            </div>
          )}

          <button onClick={toggleSidebar}
            className="flex items-center justify-center w-full h-[36px]
              text-mb-text-light hover:text-mb-text-medium hover:bg-mb-bg-light transition-colors">
            {sidebarExpanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>

          <button onClick={logout}
            className={`flex items-center h-[36px] w-full font-bold text-mb-sm
              text-mb-text-light hover:text-red-500 hover:bg-red-50 transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}`}>
            <LogOut size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>{t('common.logOut')}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-mb-bg-light">
        {children}
      </main>
    </div>
  )
}
