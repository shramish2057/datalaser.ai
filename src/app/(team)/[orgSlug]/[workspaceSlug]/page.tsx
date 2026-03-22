'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Plus, Database, BarChart2, MessageSquare } from 'lucide-react'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import type { Project, Workspace, Organization } from '@/types/database'

export default function WorkspaceHomePage() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const workspaceSlug = params.workspaceSlug as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 font-sans">
        <div className="text-mb-text-medium text-mb-base">Loading...</div>
      </div>
    )
  }

  const wsBase = `/${orgSlug}/${workspaceSlug}`

  return (
    <div className="font-sans">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">Projects</h1>
        <p className="text-mb-text-medium text-mb-base mb-8">
          Select a project to view insights, ask questions, and build dashboards.
        </p>

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-mb-bg-medium rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart2 size={28} className="text-mb-text-light" />
            </div>
            <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">No projects yet</h2>
            <p className="text-mb-text-medium text-mb-base mb-6">Create your first project to start analysing your data.</p>
            <button onClick={() => router.push(`${wsBase}/new`)} className="mb-btn-primary px-6 py-2.5 font-black">
              Create your first project &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <button key={project.id} onClick={() => router.push(`${wsBase}/${project.slug}`)}
                className="text-left mb-card p-5 hover:shadow-mb-md transition-all hover:border-mb-brand group">
                <div className="mb-3"><ProjectIconBadge icon={project.icon} color={project.color} size="lg" /></div>
                <h3 className="text-mb-base font-black text-mb-text-dark mb-1 group-hover:text-mb-brand transition-colors">{project.name}</h3>
                {project.description && <p className="text-mb-sm text-mb-text-medium mb-3 line-clamp-2">{project.description}</p>}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-mb-border">
                  <span className="flex items-center gap-1 text-mb-xs text-mb-text-light"><BarChart2 size={12} /> Insights</span>
                  <span className="flex items-center gap-1 text-mb-xs text-mb-text-light"><MessageSquare size={12} /> Ask</span>
                  <span className="flex items-center gap-1 text-mb-xs text-mb-text-light"><Database size={12} /> Sources</span>
                </div>
                <p className="text-mb-xs text-mb-text-light mt-2">Created {new Date(project.created_at).toLocaleDateString()}</p>
              </button>
            ))}
            <button onClick={() => router.push(`${wsBase}/new`)}
              className="text-left border-2 border-dashed border-mb-border-dark rounded-mb-lg p-5
                hover:border-mb-brand hover:bg-mb-brand-hover transition-all flex flex-col items-center justify-center min-h-[160px] text-center">
              <div className="w-10 h-10 rounded-mb-md bg-mb-bg-medium flex items-center justify-center mb-3">
                <Plus size={20} className="text-mb-text-light" />
              </div>
              <p className="text-mb-sm font-black text-mb-text-medium">New Project</p>
              <p className="text-mb-xs text-mb-text-light mt-1">Add another analysis project</p>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
