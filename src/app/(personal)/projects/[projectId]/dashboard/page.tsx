'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { LayoutGrid, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { useProjectContext } from '@/lib/hooks/useProjectContext'

type DashboardRow = {
  id: string
  name: string
  widgets: unknown[]
  is_public: boolean
  created_at: string
  updated_at: string
}

export default function ProjectDashboardPage() {
  const t = useTranslations()
  const [dashboards, setDashboards] = useState<DashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showToast, setShowToast] = useState(false)
  const router = useRouter()
  const { projectId } = useProjectContext()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('dashboards')
        .select('id, name, widgets, is_public, created_at, updated_at')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })

      setDashboards(data ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-10 space-y-3">
        <div className="h-10 rounded-dl-md dl-shimmer" />
        <div className="h-10 rounded-dl-md dl-shimmer" />
        <div className="h-10 rounded-dl-md dl-shimmer" />
      </div>
    )
  }

  const triggerToast = () => { setShowToast(true); setTimeout(() => setShowToast(false), 3000) }

  const toast = showToast && (
    <div className="fixed bottom-6 right-6 bg-dl-bg border border-dl-border shadow-dl-lg rounded-dl-lg px-4 py-3 flex items-center gap-2 z-50">
      <LayoutGrid size={14} className="text-dl-brand" />
      <span className="text-dl-sm text-dl-text-dark font-bold">{t('dashboard.comingSoon')}</span>
    </div>
  )

  // Empty state
  if (dashboards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-dl-bg-medium flex items-center justify-center mx-auto mb-4">
            <LayoutGrid size={28} className="text-dl-text-light" />
          </div>
          <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">No dashboards yet</h2>
          <p className="text-dl-text-medium text-dl-base mb-6">
            Create your first dashboard to monitor key metrics in real time.
          </p>
          <button
            className="dl-btn-primary px-6 py-2"
            onClick={triggerToast}
          >
            <Plus size={14} />
            Create a dashboard
          </button>
        </div>
        {toast}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-dl-2xl font-black text-dl-text-dark">Dashboards</h1>
          <p className="text-dl-text-light text-dl-sm mt-0.5">
            {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="dl-btn-primary"
          onClick={triggerToast}
        >
          <Plus size={14} />
          New dashboard
        </button>
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dashboards.map(dash => (
          <div
            key={dash.id}
            className="dl-card p-5 cursor-pointer hover:shadow-dl-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid size={16} className="text-dl-brand" />
                <h3 className="text-dl-base font-black text-dl-text-dark">{dash.name}</h3>
              </div>
              {dash.is_public && (
                <span className="dl-badge-info">Public</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-dl-xs text-dl-text-light">
                {(dash.widgets as unknown[])?.length ?? 0} widget{(dash.widgets as unknown[])?.length !== 1 ? 's' : ''}
              </p>
              <p className="text-dl-xs text-dl-text-light">
                Updated {formatDistanceToNow(new Date(dash.updated_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
      {toast}
    </div>
  )
}
