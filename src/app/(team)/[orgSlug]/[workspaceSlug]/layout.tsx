'use client'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  ChevronLeft, ChevronRight, LogOut, Plus, Settings, Users, ArrowLeft
} from 'lucide-react'
import type { Project, Workspace, Organization } from '@/types/database'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { Logo } from '@/components/Logo'

export default function WorkspaceShellLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const pathname = usePathname()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string

  // If inside a project (3+ segments: /org/ws/proj/...), let project layout handle it
  const afterWs = pathname.replace(`/${orgSlug}/${workspaceSlug}`, '').split('/').filter(Boolean)
  const projSlug = afterWs[0]
  const isInsideProject = afterWs.length >= 1 &&
    projSlug !== 'new' && projSlug !== 'settings'

  if (isInsideProject) {
    return <>{children}</>
  }

  return <WorkspaceShell orgSlug={orgSlug} workspaceSlug={workspaceSlug}>{children}</WorkspaceShell>
}

function WorkspaceShell({ orgSlug, workspaceSlug, children }: {
  orgSlug: string; workspaceSlug: string; children: React.ReactNode
}) {
  const t = useTranslations()
  const [org, setOrg] = useState<Organization | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
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

      const { data: ws } = await supabase
        .from('workspaces').select('*').eq('org_id', o.id).eq('slug', workspaceSlug).single()
      if (!ws) { router.push(`/${orgSlug}`); return }
      setWorkspace(ws)

      const { data: projectList } = await supabase
        .from('projects').select('*').eq('workspace_id', ws.id)
        .order('created_at', { ascending: false })
      setProjects(projectList ?? [])

      setLoading(false)
    }
    load()
  }, [orgSlug, workspaceSlug])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const wsBase = `/${orgSlug}/${workspaceSlug}`

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
            <Link href={`/${orgSlug}`} className="hover:opacity-70 transition-opacity">
              <Logo size="sm" />
            </Link>
          ) : (
            <Link href={`/${orgSlug}`}>
              <span className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>
            </Link>
          )}
        </div>

        {/* Back to teams + team name */}
        <div className={`
          flex items-center border-b border-dl-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 py-3' : 'justify-center py-3'}
        `}>
          {sidebarExpanded ? (
            <div>
              <Link href={`/${orgSlug}`} className="flex items-center gap-1.5 text-dl-text-light hover:text-dl-brand text-dl-xs font-bold transition-colors">
                <ArrowLeft size={11} /> {org?.name} &middot; {t('teams.title')}
              </Link>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-lg">{workspace?.icon || '💼'}</span>
                <span className="font-black text-dl-text-dark text-dl-sm truncate">{workspace?.name}</span>
              </div>
            </div>
          ) : (
            <Link href={`/${orgSlug}`}>
              <span className="text-lg">{workspace?.icon || '💼'}</span>
            </Link>
          )}
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto py-2">
          {sidebarExpanded && <p className="dl-section-header px-4 mb-2">{t('projects.title')}</p>}

          {projects.map(p => {
            const active = pathname.startsWith(`${wsBase}/${p.slug}`)
            return (
              <Link key={p.id} href={`${wsBase}/${p.slug}`}
                className={`relative flex items-center h-[40px] font-sans font-bold text-dl-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active ? 'text-dl-brand bg-dl-brand-hover' : 'text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light'}`}>
                {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-dl-brand rounded-r-sm" />}
                <ProjectIconBadge icon={p.icon} color={p.color} size="sm" />
                {sidebarExpanded && <span className="truncate">{p.name}</span>}
              </Link>
            )
          })}

          {sidebarExpanded && (
            <button onClick={() => router.push(`${wsBase}/new`)}
              className="flex items-center gap-2 px-4 h-[40px] w-full text-dl-xs
                text-dl-text-light hover:text-dl-brand transition-colors mt-1">
              <Plus size={13} /> {t('projects.newProject')}
            </button>
          )}

          {sidebarExpanded && (
            <>
              <div className="h-px bg-dl-border mx-4 my-3" />
              <p className="dl-section-header px-4 mb-2">{t('teams.title')}</p>
            </>
          )}

          {[
            { icon: Users, label: t('settings.members'), href: `${wsBase}/settings/members` },
            { icon: Settings, label: t('nav.settings'), href: `${wsBase}/settings` },
          ].map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const isInSettings = pathname.startsWith(`${wsBase}/settings`)
            return (
              <button key={item.label}
                onClick={() => {
                  if (active || (item.href === `${wsBase}/settings` && isInSettings)) {
                    router.push(wsBase)
                  } else {
                    router.push(item.href)
                  }
                }}
                className={`relative flex items-center h-[40px] w-full font-sans font-bold text-dl-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active ? 'text-dl-brand bg-dl-brand-hover' : 'text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light'}`}>
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
