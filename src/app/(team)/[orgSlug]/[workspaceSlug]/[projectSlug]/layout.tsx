'use client'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/Logo'
import { useEffect, useState } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Home, BarChart2, MessageSquare, LayoutGrid,
  Database, Settings, ChevronLeft,
  ChevronRight, LogOut, Plus, FolderOpen, ChevronRight as Chevron,
  Wand2, FlaskConical, Bell, Network, GitBranch
} from 'lucide-react'
import type { Project, Workspace, Organization } from '@/types/database'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { TeamProjectCtx } from '@/lib/teamContext'
import { LocaleToggle } from '@/components/LocaleToggle'
import { ActiveSourceProvider } from '@/lib/context/ActiveSourceContext'

export default function TeamProjectLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const [project, setProject] = useState<Project | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string
  const projectSlug = params.projectSlug as string

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

  const loadProject = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    // Resolve org → workspace → project by slugs
    const { data: o } = await supabase
      .from('organizations').select('*').eq('slug', orgSlug).single()
    if (!o) { router.push('/projects'); return }
    setOrg(o)

    const { data: ws } = await supabase
      .from('workspaces').select('*').eq('org_id', o.id).eq('slug', workspaceSlug).single()
    if (!ws) { router.push(`/${orgSlug}`); return }
    setWorkspace(ws)

    const { data: proj } = await supabase
      .from('projects').select('*').eq('workspace_id', ws.id).eq('slug', projectSlug).single()
    if (!proj) { router.push(`/${orgSlug}/${workspaceSlug}`); return }
    setProject(proj)

    // Load all projects in this workspace for the switcher
    const { data: allProjects } = await supabase
      .from('projects').select('*').eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
    setProjects(allProjects ?? [])

    setLoading(false)
  }

  useEffect(() => { loadProject() }, [orgSlug, workspaceSlug, projectSlug])

  useEffect(() => {
    const handler = () => loadProject()
    window.addEventListener('project-updated', handler)
    return () => window.removeEventListener('project-updated', handler)
  }, [orgSlug, workspaceSlug, projectSlug])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const base = `/${orgSlug}/${workspaceSlug}/${projectSlug}`
  const wsBase = `/${orgSlug}/${workspaceSlug}`

  const projectNav = [
    { icon: Home, label: t('nav.home'), path: '' },
    { icon: BarChart2, label: t('nav.insights'), path: '/insights' },
    { icon: Network, label: t('nav.dataMap'), path: '/map' },
    { icon: MessageSquare, label: t('nav.askData'), path: '/ask' },
    { icon: FlaskConical, label: t('nav.studio'), path: '/studio', badge: t('common.pro') },
    { icon: Bell, label: t('nav.alerts'), path: '/alerts' },
    { icon: Database, label: t('nav.dataSources'), path: '/sources' },
    { icon: Wand2, label: t('nav.dataPrep'), path: '/prep' },
    { icon: LayoutGrid, label: t('nav.dashboard'), path: '/dashboard' },
    { icon: Settings, label: t('nav.settings'), path: '/settings' },
  ]

  const isActive = (path: string) => {
    const full = base + path
    if (path === '') return pathname === base
    return pathname.startsWith(full)
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
      {/* SIDEBAR */}
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
            <button
              onClick={() => router.push(`/${orgSlug}`)}
              className="hover:opacity-70 transition-opacity"
            >
              <Logo size="sm" />
            </button>
          ) : (
            <button onClick={() => router.push(`/${orgSlug}`)}>
              <span className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>
            </button>
          )}
        </div>

        {/* Project switcher */}
        {sidebarExpanded && (
          <div className="px-3 py-2 border-b border-dl-border flex-shrink-0">
            <p className="dl-section-header mb-1.5">Project</p>
            <select
              value={projectSlug}
              onChange={e => router.push(`/${orgSlug}/${workspaceSlug}/${e.target.value}`)}
              className="w-full text-dl-sm font-bold text-dl-text-dark bg-dl-bg-light
                border border-dl-border rounded-dl-md px-2 py-1.5 cursor-pointer
                focus:outline-none focus:border-dl-brand"
            >
              {projects.map(p => (
                <option key={p.id} value={p.slug}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => router.push(`${wsBase}/new`)}
              className="flex items-center gap-1.5 text-dl-xs text-dl-text-light
                hover:text-dl-brand mt-1.5 transition-colors"
            >
              <Plus size={11} /> {t('projects.newProject')}
            </button>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {projectNav.map(({ icon: Icon, label, path, badge }: { icon: typeof BarChart2; label: string; path: string; badge?: string }) => {
            const active = isActive(path)
            return (
              <Link
                key={label}
                href={base + path}
                className={`
                  relative flex items-center h-[40px] font-sans font-bold text-dl-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
                  ${active
                    ? 'text-dl-brand bg-dl-brand-hover'
                    : 'text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light'}
                `}
              >
                {active && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-dl-brand rounded-r-sm" />
                )}
                <Icon size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="flex items-center gap-1.5">
                    {label}
                    {badge && (
                      <span className="text-dl-xs font-semibold px-1 py-px rounded bg-yellow-100 text-yellow-700">{badge}</span>
                    )}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-dl-border flex-shrink-0">
          <button
            onClick={() => router.push(wsBase)}
            className={`
              flex items-center h-[40px] w-full font-bold text-dl-sm
              text-dl-text-light hover:text-dl-brand hover:bg-dl-bg-light transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
            `}
          >
            <FolderOpen size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>{t('common.allProjects')}</span>}
          </button>

          {sidebarExpanded && (
            <div className="flex items-center justify-center py-2">
              <LocaleToggle />
            </div>
          )}

          <button onClick={toggleSidebar}
            className="flex items-center justify-center w-full h-[40px]
              text-dl-text-light hover:text-dl-text-medium hover:bg-dl-bg-light transition-colors"
          >
            {sidebarExpanded ? <ChevronLeft size={15} /> : <Chevron size={15} />}
          </button>

          <button onClick={logout}
            className={`
              flex items-center h-[40px] w-full font-bold text-dl-sm
              text-dl-text-light hover:text-red-500 hover:bg-red-50 transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
            `}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>{t('common.logOut')}</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar with breadcrumb */}
        <header className="h-[72px] bg-dl-bg border-b border-dl-border flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-dl-sm">
            <Link href={`/${orgSlug}`} className="text-dl-text-light hover:text-dl-brand transition-colors font-bold">
              {org?.name}
            </Link>
            <Chevron size={12} className="text-dl-text-light" />
            <Link href={wsBase} className="text-dl-text-light hover:text-dl-brand transition-colors font-bold">
              {workspace?.name}
            </Link>
            <Chevron size={12} className="text-dl-text-light" />
            {project && (
              <div className="flex items-center gap-2">
                <ProjectIconBadge icon={project.icon} color={project.color} size="sm" />
                <span className="text-dl-text-dark font-black">{project.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-dl-text-medium text-dl-sm">
              <div className="w-2 h-2 rounded-full bg-dl-success" />
              {t('common.connected')}
            </div>
            <div className="w-px h-4 bg-dl-border mx-1" />
            <button
              onClick={() => router.push(`${base}/sources/new`)}
              className="dl-btn-secondary flex items-center gap-1.5 text-dl-sm py-1.5"
            >
              <Plus size={13} /> Add data
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-dl-bg-light">
          <ActiveSourceProvider projectId={project?.id ?? ''}>
            <TeamProjectCtx.Provider value={{
              projectId: project?.id ?? '',
              base,
              wsBase,
              orgBase: `/${orgSlug}`,
            }}>
              {children}
            </TeamProjectCtx.Provider>
          </ActiveSourceProvider>
        </main>
      </div>
    </div>
  )
}
