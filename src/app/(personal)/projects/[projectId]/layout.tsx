'use client'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/Logo'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Home, BarChart2, MessageSquare, LayoutGrid,
  Database, Settings, ChevronLeft,
  ChevronRight, LogOut, Plus, FolderOpen, Wand2, FlaskConical, Bell
} from 'lucide-react'
import { LocaleToggle } from '@/components/LocaleToggle'
import { useTranslations } from 'next-intl'
import type { Project, Workspace, Organization } from '@/types/database'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { ActiveSourceProvider } from '@/lib/context/ActiveSourceContext'
import { DataSourceSelector } from '@/components/DataSourceSelector'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Studio has its own full-screen layout — pass through
  if (pathname.includes('/studio')) {
    return <>{children}</>
  }
  return <ProjectShell>{children}</ProjectShell>
}

function ProjectShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const [project, setProject] = useState<Project | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [alertCount, setAlertCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const projectId = params.projectId as string

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

    // Load current project
    const { data: proj } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
    if (!proj) { router.push('/projects'); return }
    setProject(proj)

    // Load workspace
    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', proj.workspace_id)
      .single()
    setWorkspace(ws)

    // Load org
    if (ws) {
      const { data: o } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', ws.org_id)
        .single()
      setOrg(o)
    }

    // Load all projects in this workspace
    const { data: allProjects } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', proj.workspace_id)
      .order('created_at', { ascending: false })
    setProjects(allProjects ?? [])

    // Fetch unresolved alert count
    const { count } = await supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('resolved_at', null)
    setAlertCount(count ?? 0)

    setLoading(false)
  }

  useEffect(() => {
    loadProject()
  }, [projectId])

  // Re-fetch when settings page saves changes
  useEffect(() => {
    const handler = () => loadProject()
    window.addEventListener('project-updated', handler)
    return () => window.removeEventListener('project-updated', handler)
  }, [projectId])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const projectNav = [
    { icon: Home, label: t('nav.home'), path: '' },
    { icon: Bell, label: t('nav.alerts'), path: '/alerts', alertCount },
    { icon: BarChart2, label: t('nav.insights'), path: '/insights' },
    { icon: MessageSquare, label: t('nav.askData'), path: '/ask' },
    { icon: FlaskConical, label: t('nav.studio'), path: '/studio', badge: t('common.pro') },
    { icon: LayoutGrid, label: t('nav.dashboard'), path: '/dashboard' },
    { icon: Database, label: t('nav.dataSources'), path: '/sources' },
    { icon: Wand2, label: t('nav.dataPrep'), path: '/prep' },
    { icon: Settings, label: t('nav.settings'), path: '/settings' },
  ]

  const base = `/projects/${projectId}`

  const isActive = (path: string) => {
    const full = base + path
    if (path === '') return pathname === base
    // Analysis pages are part of Insights, not Data Sources
    if (pathname.includes('/analysis')) {
      return path === '/insights'
    }
    return pathname.startsWith(full)
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-dl-bg-light items-center justify-center font-sans">
        <div className="text-dl-text-medium text-dl-base">{t("common.loading")}</div>
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

        {/* Logo / Back to projects */}
        <div className={`
          h-[72px] flex items-center border-b border-dl-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 gap-2' : 'justify-center'}
        `}>
          {sidebarExpanded ? (
            <button
              onClick={() => router.push('/projects')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <Logo size="sm" />
            </button>
          ) : (
            <button onClick={() => router.push('/projects')}>
              <span className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>
            </button>
          )}
        </div>

        {/* Project switcher */}
        {sidebarExpanded && (
          <div className="px-3 py-2 border-b border-dl-border flex-shrink-0">
            <p className="dl-section-header mb-1.5">Project</p>
            <select
              value={projectId}
              onChange={e => router.push(`/projects/${e.target.value}`)}
              className="w-full text-dl-sm font-bold text-dl-text-dark bg-dl-bg-light
                border border-dl-border rounded-dl-md px-2 py-1.5 cursor-pointer
                focus:outline-none focus:border-dl-brand"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => router.push('/projects/new')}
              className="flex items-center gap-1.5 text-dl-xs text-dl-text-light
                hover:text-dl-brand mt-1.5 transition-colors"
            >
              <Plus size={11} /> {t('common.newProject')}
            </button>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {projectNav.map(({ icon: Icon, label, path, badge, alertCount: navAlertCount }: { icon: typeof BarChart2; label: string; path: string; badge?: string; alertCount?: number }) => {
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
                    {navAlertCount != null && navAlertCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold leading-none">
                        {navAlertCount}
                      </span>
                    )}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* All Projects link */}
        <div className="border-t border-dl-border flex-shrink-0">
          <button
            onClick={() => router.push('/projects')}
            className={`
              flex items-center h-[40px] w-full font-bold text-dl-sm
              text-dl-text-light hover:text-dl-brand hover:bg-dl-bg-light
              transition-colors
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

          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-full h-[40px]
              text-dl-text-light hover:text-dl-text-medium hover:bg-dl-bg-light
              transition-colors"
          >
            {sidebarExpanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>

          <button
            onClick={logout}
            className={`
              flex items-center h-[40px] w-full font-bold text-dl-sm
              text-dl-text-light hover:text-red-500 hover:bg-red-50
              transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
            `}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>{t('common.logOut')}</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <ActiveSourceProvider projectId={projectId as string}>
        <div className="flex flex-col flex-1 min-w-0">
          {/* Top bar */}
          <header className="
            h-[72px] bg-dl-bg border-b border-dl-border
            flex items-center justify-between px-6 flex-shrink-0
          ">
            <div className="flex items-center gap-2">
              {project && (
                <>
                  <ProjectIconBadge icon={project.icon} color={project.color} size="md" />
                  <h1 className="text-dl-lg font-black text-dl-text-dark">
                    {project.name}
                  </h1>
                </>
              )}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/projects/${projectId}/sources/new`)}
                className="dl-btn-secondary flex items-center gap-1.5 text-dl-sm py-1.5"
              >
                <Plus size={13} /> {t('sources.addSource')}
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-dl-bg-light">
            {children}
          </main>
        </div>
      </ActiveSourceProvider>
    </div>
  )
}
