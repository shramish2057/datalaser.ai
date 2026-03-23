'use client'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { useLocale } from 'next-intl'
import { Plus, Database, BarChart2, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/formatNumber'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import type { Project } from '@/types/database'

export default function ProjectsPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // Get user's workspace
      const { data: wsMembership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (!wsMembership) {
        // No org/workspace yet — send to onboarding
        router.push('/setup')
        return
      }

      setWorkspaceId(wsMembership.workspace_id)

      // Get projects for this workspace
      const { data: projectList } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', wsMembership.workspace_id)
        .order('created_at', { ascending: false })

      setProjects(projectList ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 font-sans overflow-y-auto">
        <div className="text-mb-text-medium text-mb-base">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="font-sans flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">{t('projects.title')}</h1>
        <p className="text-mb-text-medium text-mb-base mb-8">
          {t('projects.subtitle')}
        </p>

        {projects.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-mb-bg-medium rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart2 size={28} className="text-mb-text-light" />
            </div>
            <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">{t('projects.noProjects')}</h2>
            <p className="text-mb-text-medium text-mb-base mb-6">
              {t('projects.noProjectsDesc')}
            </p>
            <button
              onClick={() => router.push('/projects/new')}
              className="mb-btn-primary px-6 py-2.5 font-black"
            >
              {t('projects.createFirst')} →
            </button>
          </div>
        ) : (
          /* Projects grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="text-left mb-card p-5 hover:shadow-mb-md transition-all
                  hover:border-mb-brand-dark group"
              >
                {/* Project icon + color bar */}
                <div className="mb-3">
                  <ProjectIconBadge icon={project.icon} color={project.color} size="lg" />
                </div>

                <h3 className="text-mb-base font-black text-mb-text-dark mb-1
                  group-hover:text-mb-brand transition-colors">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-mb-sm text-mb-text-medium mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Quick links */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-mb-border">
                  <span className="flex items-center gap-1 text-mb-xs text-mb-text-light
                    hover:text-mb-brand transition-colors"
                    onClick={e => { e.stopPropagation(); router.push(`/projects/${project.id}/insights`) }}>
                    <BarChart2 size={12} /> {t('projects.insights')}
                  </span>
                  <span className="flex items-center gap-1 text-mb-xs text-mb-text-light
                    hover:text-mb-brand transition-colors"
                    onClick={e => { e.stopPropagation(); router.push(`/projects/${project.id}/ask`) }}>
                    <MessageSquare size={12} /> {t('projects.ask')}
                  </span>
                  <span className="flex items-center gap-1 text-mb-xs text-mb-text-light
                    hover:text-mb-brand transition-colors"
                    onClick={e => { e.stopPropagation(); router.push(`/projects/${project.id}/sources`) }}>
                    <Database size={12} /> {t('projects.sources')}
                  </span>
                </div>

                {/* Created date */}
                <p className="text-mb-xs text-mb-text-light mt-2">
                  {t('projects.created')} {formatDate(project.created_at, locale)}
                </p>
              </button>
            ))}

            {/* New project card */}
            <button
              onClick={() => router.push('/projects/new')}
              className="text-left border-2 border-dashed border-mb-border-dark
                rounded-mb-lg p-5 hover:border-mb-brand hover:bg-mb-brand-hover
                transition-all flex flex-col items-center justify-center
                min-h-[160px] text-center"
            >
              <div className="w-10 h-10 rounded-mb-md bg-mb-bg-medium
                flex items-center justify-center mb-3">
                <Plus size={20} className="text-mb-text-light" />
              </div>
              <p className="text-mb-sm font-black text-mb-text-medium">
                {t('projects.newProject')}
              </p>
              <p className="text-mb-xs text-mb-text-light mt-1">
                {t('projects.addAnother')}
              </p>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

