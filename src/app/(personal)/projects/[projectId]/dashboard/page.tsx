'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { LayoutGrid, Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type DashboardRow = {
  id: string
  name: string
  widgets: unknown[]
  is_public: boolean
  created_at: string
  updated_at: string
}

export default function ProjectDashboardPage() {
  const [dashboards, setDashboards] = useState<DashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showToast, setShowToast] = useState(false)
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

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
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-3">
        <div className="h-10 rounded-mb-md mb-shimmer" />
        <div className="h-10 rounded-mb-md mb-shimmer" />
        <div className="h-10 rounded-mb-md mb-shimmer" />
      </div>
    )
  }

  const triggerToast = () => { setShowToast(true); setTimeout(() => setShowToast(false), 3000) }

  const toast = showToast && (
    <div className="fixed bottom-6 right-6 bg-mb-bg border border-mb-border shadow-mb-lg rounded-mb-lg px-4 py-3 flex items-center gap-2 z-50">
      <LayoutGrid size={14} className="text-mb-brand" />
      <span className="text-mb-sm text-mb-text-dark font-bold">Dashboard builder will be available shortly.</span>
    </div>
  )

  // Empty state
  if (dashboards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-mb-bg-medium flex items-center justify-center mx-auto mb-4">
            <LayoutGrid size={28} className="text-mb-text-light" />
          </div>
          <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">No dashboards yet</h2>
          <p className="text-mb-text-medium text-mb-base mb-6">
            Create your first dashboard to monitor key metrics in real time.
          </p>
          <button
            className="mb-btn-primary px-6 py-2"
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
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-mb-2xl font-black text-mb-text-dark">Dashboards</h1>
          <p className="text-mb-text-light text-mb-sm mt-0.5">
            {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="mb-btn-primary"
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
            className="mb-card p-5 cursor-pointer hover:shadow-mb-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid size={16} className="text-mb-brand" />
                <h3 className="text-mb-base font-black text-mb-text-dark">{dash.name}</h3>
              </div>
              {dash.is_public && (
                <span className="mb-badge-info">Public</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-mb-xs text-mb-text-light">
                {(dash.widgets as unknown[])?.length ?? 0} widget{(dash.widgets as unknown[])?.length !== 1 ? 's' : ''}
              </p>
              <p className="text-mb-xs text-mb-text-light">
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
