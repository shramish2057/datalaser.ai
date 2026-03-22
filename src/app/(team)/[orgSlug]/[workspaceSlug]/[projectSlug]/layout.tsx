'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  BarChart2, MessageSquare, LayoutGrid,
  Database, Settings, ChevronLeft,
  ChevronRight, LogOut, Plus, FolderOpen, ChevronRight as Chevron
} from 'lucide-react'
import type { Project, Workspace, Organization } from '@/types/database'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { TeamProjectCtx } from '@/lib/teamContext'

export default function TeamProjectLayout({ children }: { children: React.ReactNode }) {
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
    { icon: BarChart2, label: 'Insights', path: '' },
    { icon: MessageSquare, label: 'Ask Data', path: '/ask' },
    { icon: LayoutGrid, label: 'Dashboard', path: '/dashboard' },
    { icon: Database, label: 'Data Sources', path: '/sources' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ]

  const isActive = (path: string) => {
    const full = base + path
    if (path === '') return pathname === base
    return pathname.startsWith(full)
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
      {/* SIDEBAR */}
      <aside className={`
        ${sidebarExpanded ? 'w-[220px]' : 'w-[52px]'}
        flex-shrink-0 h-screen bg-mb-bg border-r border-mb-border
        flex flex-col transition-all duration-150
      `}>
        {/* Logo */}
        <div className={`
          h-[65px] flex items-center border-b border-mb-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 gap-2' : 'justify-center'}
        `}>
          {sidebarExpanded ? (
            <button
              onClick={() => router.push(`/${orgSlug}`)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <span className="text-mb-brand font-black text-xl">▲</span>
              <span className="font-black text-mb-text-dark text-mb-base">DataLaser</span>
            </button>
          ) : (
            <button onClick={() => router.push(`/${orgSlug}`)}>
              <span className="text-mb-brand font-black text-xl">▲</span>
            </button>
          )}
        </div>

        {/* Project switcher */}
        {sidebarExpanded && (
          <div className="px-3 py-2 border-b border-mb-border flex-shrink-0">
            <p className="mb-section-header mb-1.5">Project</p>
            <select
              value={projectSlug}
              onChange={e => router.push(`/${orgSlug}/${workspaceSlug}/${e.target.value}`)}
              className="w-full text-mb-sm font-bold text-mb-text-dark bg-mb-bg-light
                border border-mb-border rounded-mb-md px-2 py-1.5 cursor-pointer
                focus:outline-none focus:border-mb-brand"
            >
              {projects.map(p => (
                <option key={p.id} value={p.slug}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => router.push(`${wsBase}/new`)}
              className="flex items-center gap-1.5 text-mb-xs text-mb-text-light
                hover:text-mb-brand mt-1.5 transition-colors"
            >
              <Plus size={11} /> New project
            </button>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {projectNav.map(({ icon: Icon, label, path }) => {
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
                {sidebarExpanded && <span>{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-mb-border flex-shrink-0">
          <button
            onClick={() => router.push(wsBase)}
            className={`
              flex items-center h-[36px] w-full font-bold text-mb-sm
              text-mb-text-light hover:text-mb-brand hover:bg-mb-bg-light transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
            `}
          >
            <FolderOpen size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>All Projects</span>}
          </button>

          <button onClick={toggleSidebar}
            className="flex items-center justify-center w-full h-[36px]
              text-mb-text-light hover:text-mb-text-medium hover:bg-mb-bg-light transition-colors"
          >
            {sidebarExpanded ? <ChevronLeft size={15} /> : <Chevron size={15} />}
          </button>

          <button onClick={logout}
            className={`
              flex items-center h-[36px] w-full font-bold text-mb-sm
              text-mb-text-light hover:text-red-500 hover:bg-red-50 transition-colors
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
        {/* Top bar with breadcrumb */}
        <header className="h-[65px] bg-mb-bg border-b border-mb-border flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-mb-sm">
            <Link href={`/${orgSlug}`} className="text-mb-text-light hover:text-mb-brand transition-colors font-bold">
              {org?.name}
            </Link>
            <Chevron size={12} className="text-mb-text-light" />
            <Link href={wsBase} className="text-mb-text-light hover:text-mb-brand transition-colors font-bold">
              {workspace?.name}
            </Link>
            <Chevron size={12} className="text-mb-text-light" />
            {project && (
              <div className="flex items-center gap-2">
                <ProjectIconBadge icon={project.icon} color={project.color} size="sm" />
                <span className="text-mb-text-dark font-black">{project.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-mb-text-medium text-mb-sm">
              <div className="w-2 h-2 rounded-full bg-mb-success" />
              Connected
            </div>
            <div className="w-px h-4 bg-mb-border mx-1" />
            <button
              onClick={() => router.push(`${base}/sources/new`)}
              className="mb-btn-secondary flex items-center gap-1.5 text-mb-sm py-1.5"
            >
              <Plus size={13} /> Add data
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-mb-bg-light">
          <TeamProjectCtx.Provider value={{
            projectId: project?.id ?? '',
            base,
            wsBase,
            orgBase: `/${orgSlug}`,
          }}>
            {children}
          </TeamProjectCtx.Provider>
        </main>
      </div>
    </div>
  )
}
