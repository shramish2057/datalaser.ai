'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  ChevronLeft, ChevronRight, LogOut, Plus, Settings
} from 'lucide-react'
import type { Project } from '@/types/database'
import { ProjectIconBadge } from '@/components/ProjectIcon'

export default function ProjectsShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // If we're inside a specific project, its own layout handles the shell.
  // Detect: /projects/[uuid or slug]/... (anything beyond /projects and /projects/new)
  const segments = pathname.replace('/projects', '').split('/').filter(Boolean)
  const isInsideProject = segments.length >= 1 && segments[0] !== 'new'

  if (isInsideProject) {
    return <>{children}</>
  }

  return <ProjectsShell>{children}</ProjectsShell>
}

function ProjectsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
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

      const { data: wsMembership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (wsMembership) {
        const { data: projectList } = await supabase
          .from('projects')
          .select('*')
          .eq('workspace_id', wsMembership.workspace_id)
          .order('created_at', { ascending: false })
        setProjects(projectList ?? [])
      }

      setLoading(false)
    }
    load()
  }, [])

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
      {/* SIDEBAR */}
      <aside className={`
        ${sidebarExpanded ? 'w-[220px]' : 'w-[52px]'}
        flex-shrink-0 h-screen bg-dl-bg border-r border-dl-border
        flex flex-col transition-all duration-150
      `}>
        {/* Logo */}
        <div className={`
          h-[65px] flex items-center border-b border-dl-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 gap-2' : 'justify-center'}
        `}>
          {sidebarExpanded ? (
            <Link href="/projects" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <span className="text-dl-brand font-black text-xl">▲</span>
              <span className="font-black text-dl-text-dark text-dl-base">DataLaser</span>
            </Link>
          ) : (
            <Link href="/projects">
              <span className="text-dl-brand font-black text-xl">▲</span>
            </Link>
          )}
        </div>

        {/* Projects list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sidebarExpanded && (
            <p className="dl-section-header px-4 mb-2">Projects</p>
          )}

          {projects.map(p => {
            const active = pathname === `/projects/${p.id}`
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={`
                  relative flex items-center h-[36px] font-sans font-bold text-dl-sm
                  transition-colors duration-100 cursor-pointer
                  ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                  ${active
                    ? 'text-dl-brand bg-dl-brand-hover'
                    : 'text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light'}
                `}
              >
                {active && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-dl-brand rounded-r-sm" />
                )}
                <ProjectIconBadge icon={p.icon} color={p.color} size="sm" />
                {sidebarExpanded && <span className="truncate">{p.name}</span>}
              </Link>
            )
          })}

          {/* New project */}
          {sidebarExpanded && (
            <button
              onClick={() => router.push('/projects/new')}
              className="flex items-center gap-2 px-4 h-[36px] w-full text-dl-xs
                text-dl-text-light hover:text-dl-brand transition-colors mt-1"
            >
              <Plus size={13} /> {t('projects.newProject')}
            </button>
          )}
        </div>

        {/* Bottom */}
        <div className="border-t border-dl-border flex-shrink-0">
          <Link
            href="/settings"
            className={`
              flex items-center h-[36px] w-full font-bold text-dl-sm
              text-dl-text-light hover:text-dl-brand hover:bg-dl-bg-light transition-colors
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
            `}
          >
            <Settings size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>{t('nav.settings')}</span>}
          </Link>

          {sidebarExpanded && userName && (
            <div className="px-4 py-2 border-t border-dl-border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-dl-bg-medium flex items-center justify-center text-dl-xs font-black text-dl-text-medium">
                  {userName[0]?.toUpperCase()}
                </div>
                <span className="text-dl-xs font-bold text-dl-text-dark truncate">{userName}</span>
              </div>
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-full h-[36px]
              text-dl-text-light hover:text-dl-text-medium hover:bg-dl-bg-light transition-colors"
          >
            {sidebarExpanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>

          <button
            onClick={logout}
            className={`
              flex items-center h-[36px] w-full font-bold text-dl-sm
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
      <main className="flex-1 flex flex-col overflow-hidden bg-dl-bg-light">
        {children}
      </main>
    </div>
  )
}
