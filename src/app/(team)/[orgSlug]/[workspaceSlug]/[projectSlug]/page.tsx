'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Database, BarChart2, MessageSquare, LayoutGrid, ArrowRight } from 'lucide-react'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { useTeamProjectContext } from '@/lib/teamContext'
import type { Project } from '@/types/database'

export default function TeamProjectOverviewPage() {
  const { projectId, base } = useTeamProjectContext()
  const [project, setProject] = useState<Project | null>(null)
  const [sourceCount, setSourceCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!projectId) return
    async function load() {
      const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single()
      setProject(proj)
      const { count } = await supabase.from('data_sources').select('*', { count: 'exact', head: true }).eq('project_id', projectId)
      setSourceCount(count ?? 0)
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading || !projectId) return null

  const quickActions = [
    { icon: Database, label: 'Add a data source', desc: 'Connect a database, upload a CSV, or link a SaaS tool', href: `${base}/sources/new`, primary: sourceCount === 0 },
    { icon: BarChart2, label: 'View Insights', desc: 'AI-generated analysis of your connected data', href: `${base}/insights`, primary: false },
    { icon: MessageSquare, label: 'Ask Data', desc: 'Ask any question about your data in plain English', href: `${base}/ask`, primary: false },
    { icon: LayoutGrid, label: 'Dashboard', desc: 'Build a live monitoring dashboard', href: `${base}/dashboard`, primary: false },
  ]

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          {project && <ProjectIconBadge icon={project.icon} color={project.color} size="lg" />}
          <h1 className="text-mb-2xl font-black text-mb-text-dark">{project?.name}</h1>
        </div>
        {project?.description && <p className="text-mb-text-medium text-mb-base ml-12">{project.description}</p>}
      </div>

      {sourceCount === 0 && (
        <div className="mb-card p-8 text-center mb-8">
          <div className="w-14 h-14 bg-mb-bg-medium rounded-full flex items-center justify-center mx-auto mb-4">
            <Database size={24} className="text-mb-text-light" />
          </div>
          <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">Connect your first data source</h2>
          <p className="text-mb-text-medium text-mb-base mb-6 max-w-sm mx-auto">Upload a CSV, connect a database, or link a SaaS tool to start generating insights.</p>
          <button onClick={() => router.push(`${base}/sources/new`)} className="mb-btn-primary px-6 py-2.5 font-black">Add data source &rarr;</button>
        </div>
      )}

      <div>
        <p className="mb-section-header mb-4">Quick actions</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickActions.map(action => (
            <button key={action.label} onClick={() => router.push(action.href)}
              className={`text-left p-4 rounded-mb-lg border transition-all flex items-start gap-3 group
                ${action.primary ? 'border-mb-brand bg-mb-brand-hover' : 'border-mb-border hover:border-mb-brand hover:bg-mb-brand-hover'}`}>
              <div className={`w-8 h-8 rounded-mb-md flex items-center justify-center flex-shrink-0 transition-colors
                ${action.primary ? 'bg-mb-brand' : 'bg-mb-bg-medium group-hover:bg-mb-brand'}`}>
                <action.icon size={16} className={action.primary ? 'text-white' : 'text-mb-text-light group-hover:text-white'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-mb-sm font-black mb-0.5 ${action.primary ? 'text-mb-brand' : 'text-mb-text-dark'}`}>{action.label}</p>
                <p className="text-mb-xs text-mb-text-medium">{action.desc}</p>
              </div>
              <ArrowRight size={14} className="text-mb-text-light flex-shrink-0 mt-1 group-hover:text-mb-brand transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
