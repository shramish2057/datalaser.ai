'use client'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/Logo'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  ChevronLeft, ChevronRight, LogOut, Plus, Settings
} from 'lucide-react'
import type { Project } from '@/types/database'
import { ProjectIconBadge } from '@/components/ProjectIcon'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const [projects, setProjects] = useState<Project[]>([])
  const [userName, setUserName] = useState('')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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
      {/* SIDEBAR — identical structure to projects layout */}
      <aside className={`
        ${sidebarExpanded ? 'w-[260px]' : 'w-[52px]'}
        flex-shrink-0 h-screen bg-dl-bg border-r border-dl-border
        flex flex-col transition-all duration-150
      `}>
        {/* Logo */}
        <div className={`
          h-[72px] flex items-center border-b border-dl-border flex-shrink-0
          ${sidebarExpanded ? 'px-4 gap-2' : 'justify-center'}
        `}>
          {sidebarExpanded ? (
            <Link href="/projects" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <Logo size="sm" />
            </Link>
          ) : (
            <Link href="/projects">
              <span className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>
            </Link>
          )}
        </div>

        {/* Projects list — same as projects layout */}
        <div className="flex-1 overflow-y-auto py-2">
          {sidebarExpanded && <p className="dl-section-header px-4 mb-2">Projects</p>}

          {projects.map(p => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={`
                relative flex items-center h-[40px] font-sans font-bold text-dl-sm
                transition-colors duration-100 cursor-pointer
                ${sidebarExpanded ? 'px-4 gap-2.5' : 'justify-center'}
                text-dl-text-medium hover:text-dl-text-dark hover:bg-dl-bg-light
              `}
            >
              <ProjectIconBadge icon={p.icon} color={p.color} size="sm" />
              {sidebarExpanded && <span className="truncate">{p.name}</span>}
            </Link>
          ))}

          {sidebarExpanded && (
            <button
              onClick={() => router.push('/projects/new')}
              className="flex items-center gap-2 px-4 h-[40px] w-full text-dl-xs
                text-dl-text-light hover:text-dl-brand transition-colors mt-1"
            >
              <Plus size={13} /> {t('projects.newProject')}
            </button>
          )}
        </div>

        {/* Bottom — Settings at same position as projects layout, but active + toggles back */}
        <div className="border-t border-dl-border flex-shrink-0">
          <button
            onClick={() => router.push('/projects')}
            className={`
              relative flex items-center h-[40px] w-full font-bold text-dl-sm
              transition-colors duration-100 cursor-pointer
              ${sidebarExpanded ? 'px-4 gap-3' : 'justify-center'}
              text-dl-brand bg-dl-brand-hover
            `}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-dl-brand rounded-r-sm" />
            <Settings size={15} className="flex-shrink-0" />
            {sidebarExpanded && <span>{t('nav.settings')}</span>}
          </button>

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
            className="flex items-center justify-center w-full h-[40px]
              text-dl-text-light hover:text-dl-text-medium hover:bg-dl-bg-light transition-colors"
          >
            {sidebarExpanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>

          <button
            onClick={logout}
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

      {/* MAIN — settings sub-nav + page */}
      <div className="flex-1 flex overflow-hidden bg-dl-bg-light">
        {children}
      </div>
    </div>
  )
}
