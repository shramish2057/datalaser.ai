'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Home, BarChart2, MessageSquare, LayoutGrid,
  Database, Settings, ChevronLeft,
  ChevronRight, LogOut, Plus, FolderOpen, Wand2, FlaskConical
} from 'lucide-react'
import { LocaleToggle } from '@/components/LocaleToggle'
import { useTranslations } from 'next-intl'
import type { Project, Workspace, Organization } from '@/types/database'
import { ProjectIconBadge } from '@/components/ProjectIcon'

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
    return pathname.startsWith(full)
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-mb-bg-light items-center justify-center font-sans">
        <div className="text-mb-text-medium text-mb-base">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-mb-bg-light overflow-hidden font-sans">

      {/* SIDEBAR */}
      <aside className={`
        ${sidebarExpanded ? 'w-[220px]' : 'w-[52px]'}
        flex-shrink-0 h-screen bg-mb-bg border-r border-mb-border
        flex flex-col transition-all duration-150
      `}>

        {/* Logo / Back to projects */}
        <div className={`
          h-[65px] flex items-center border-b border-mb-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 gap-2' : 'justify-center'}
        `}>
          {sidebarExpanded ? (
            <button
              onClick={() => router.push('/projects')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <span className="text-mb-brand font-black text-xl">▲</span>
              <span className="font-black text-mb-text-dark text-mb-base">DataLaser</span>
            </button>
          ) : (
            <button onClick={() => router.push('/projects')}>
              <span className="text-mb-brand font-black text-xl">▲</span>
            </button>
          )}
        </div>

        {/* Project switcher */}
        {sidebarExpanded && (
          <div className="px-3 py-2 border-b border-mb-border flex-shrink-0">
            <p className="mb-section-header mb-1.5">Project</p>
            <select
              value={projectId}
              onChange={e => router.push(`/projects/${e.target.value}`)}
              className="w-full text-mb-sm font-bold text-mb-text-dark bg-mb-bg-light
                border border-mb-border rounded-mb-md px-2 py-1.5 cursor-pointer
                focus:outline-none focus:border-mb-brand"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => router.push('/projects/new')}
              className="flex items-center gap-1.5 text-mb-xs text-mb-text-light
                hover:text-mb-brand mt-1.5 transition-colors"
            >
              <Plus size={11} /> {t('common.new')} project
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
                  relative flex items-center h-[36px] font-sans font-bold text-mb-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
                  ${active
                    ? 'text-mb-brand bg-mb-brand-hover'
                    : 'text-mb-text-medium hover:text-mb-text-dark hover:bg-mb-bg-light'}
                `}
              >
                {active && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-mb-brand rounded-r-sm" />
                )}
                <Icon size={16} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="flex items-center gap-1.5">
                    {label}
                    {badge && (
                      <span className="text-[10px] font-semibold px-1 py-px rounded bg-yellow-100 text-yellow-700">{badge}</span>
                    )}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* All Projects link */}
        <div className="border-t border-mb-border flex-shrink-0">
          <button
            onClick={() => router.push('/projects')}
            className={`
              flex items-center h-[36px] w-full font-bold text-mb-sm
              text-mb-text-light hover:text-mb-brand hover:bg-mb-bg-light
              transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
            `}
          >
            <FolderOpen size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>All Projects</span>}
          </button>

          {sidebarExpanded && (
            <div className="flex items-center justify-center py-2">
              <LocaleToggle />
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-full h-[36px]
              text-mb-text-light hover:text-mb-text-medium hover:bg-mb-bg-light
              transition-colors"
          >
            {sidebarExpanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>

          <button
            onClick={logout}
            className={`
              flex items-center h-[36px] w-full font-bold text-mb-sm
              text-mb-text-light hover:text-red-500 hover:bg-red-50
              transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
            `}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="
          h-[65px] bg-mb-bg border-b border-mb-border
          flex items-center justify-between px-6 flex-shrink-0
        ">
          <div className="flex items-center gap-2">
            {project && (
              <>
                <ProjectIconBadge icon={project.icon} color={project.color} size="md" />
                <h1 className="text-mb-lg font-black text-mb-text-dark">
                  {project.name}
                </h1>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-mb-text-medium text-mb-sm">
              <div className="w-2 h-2 rounded-full bg-mb-success" />
              Connected
            </div>
            <div className="w-px h-4 bg-mb-border mx-1" />
            <button
              onClick={() => router.push(`/projects/${projectId}/sources/new`)}
              className="mb-btn-secondary flex items-center gap-1.5 text-mb-sm py-1.5"
            >
              <Plus size={13} /> {t('common.add')} data
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-mb-bg-light">
          {children}
        </main>
      </div>
    </div>
  )
}
