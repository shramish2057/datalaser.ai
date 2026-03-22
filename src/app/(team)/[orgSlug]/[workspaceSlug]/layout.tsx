'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  ChevronLeft, ChevronRight, LogOut, Plus, Settings, Users, ArrowLeft
} from 'lucide-react'
import type { Project, Workspace, Organization } from '@/types/database'
import { ProjectIconBadge } from '@/components/ProjectIcon'

export default function WorkspaceShellLayout({ children }: { children: React.ReactNode }) {
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
        {/* Back to org + workspace name */}
        <div className={`
          h-[65px] flex items-center border-b border-mb-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 gap-2' : 'justify-center'}
        `}>
          {sidebarExpanded ? (
            <div>
              <Link href={`/${orgSlug}`} className="flex items-center gap-1.5 text-mb-text-light hover:text-mb-brand text-mb-xs font-bold transition-colors">
                <ArrowLeft size={11} /> {org?.name}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg">{workspace?.icon || '💼'}</span>
                <span className="font-black text-mb-text-dark text-mb-sm truncate">{workspace?.name}</span>
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
          {sidebarExpanded && <p className="mb-section-header px-4 mb-2">Projects</p>}

          {projects.map(p => {
            const active = pathname.startsWith(`${wsBase}/${p.slug}`)
            return (
              <Link key={p.id} href={`${wsBase}/${p.slug}`}
                className={`relative flex items-center h-[36px] font-sans font-bold text-mb-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active ? 'text-mb-brand bg-mb-brand-hover' : 'text-mb-text-medium hover:text-mb-text-dark hover:bg-mb-bg-light'}`}>
                {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-mb-brand rounded-r-sm" />}
                <ProjectIconBadge icon={p.icon} color={p.color} size="sm" />
                {sidebarExpanded && <span className="truncate">{p.name}</span>}
              </Link>
            )
          })}

          {sidebarExpanded && (
            <button onClick={() => router.push(`${wsBase}/new`)}
              className="flex items-center gap-2 px-4 h-[36px] w-full text-mb-xs
                text-mb-text-light hover:text-mb-brand transition-colors mt-1">
              <Plus size={13} /> New project
            </button>
          )}

          {sidebarExpanded && (
            <>
              <div className="h-px bg-mb-border mx-4 my-3" />
              <p className="mb-section-header px-4 mb-2">Workspace</p>
            </>
          )}

          {[
            { icon: Users, label: 'Members', href: `${wsBase}/settings/members` },
            { icon: Settings, label: 'Settings', href: `${wsBase}/settings` },
          ].map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.label} href={item.href}
                className={`relative flex items-center h-[36px] font-sans font-bold text-mb-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active ? 'text-mb-brand bg-mb-brand-hover' : 'text-mb-text-medium hover:text-mb-text-dark hover:bg-mb-bg-light'}`}>
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
            {sidebarExpanded && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-mb-bg-light">
        {children}
      </main>
    </div>
  )
}
