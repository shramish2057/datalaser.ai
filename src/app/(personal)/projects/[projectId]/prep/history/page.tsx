'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { History, ArrowLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type RunRecord = {
  id: string
  source_id: string
  started_at: string
  completed_at: string | null
  status: string
  quality_score: number | null
  rows_before: number | null
  rows_after: number | null
  transformations_applied: number | null
  tests_passed: number | null
  tests_failed: number | null
  drift_detected: boolean
}

export default function PrepHistoryPage() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const params = useParams()
  const projectId = params.projectId as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      // Get all recipes for this project
      const { data: recipeList } = await supabase
        .from('pipeline_recipes')
        .select('id, source_id')
        .eq('project_id', projectId)

      if (!recipeList || recipeList.length === 0) {
        setLoading(false)
        return
      }

      const recipeIds = recipeList.map(r => r.id)
      const sourceIds = [...new Set(recipeList.map(r => r.source_id))]

      // Fetch runs
      const { data: runList } = await supabase
        .from('pipeline_run_history')
        .select('*')
        .in('recipe_id', recipeIds)
        .order('started_at', { ascending: false })
        .limit(50)

      setRuns(runList ?? [])

      // Fetch source names
      const { data: sources } = await supabase
        .from('data_sources')
        .select('id, name')
        .in('id', sourceIds)

      const nameMap: Record<string, string> = {}
      for (const s of sources ?? []) {
        nameMap[s.id] = s.name
      }
      setSourceNames(nameMap)

      setLoading(false)
    }
    load()
  }, [projectId])

  const base = `/projects/${projectId}`

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-3">
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`${base}/prep`} className="text-mb-text-light hover:text-mb-brand transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-mb-2xl font-black text-mb-text-dark">Pipeline Run History</h1>
          <p className="text-mb-text-light text-mb-sm mt-0.5">All data preparation runs for this project</p>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="mb-card p-8 text-center">
          <History size={24} className="text-mb-text-light mx-auto mb-3" />
          <p className="text-mb-text-dark text-mb-sm font-bold">No pipeline runs yet</p>
          <p className="text-mb-text-light text-mb-xs mt-1">Prepare a data source to see run history here.</p>
        </div>
      ) : (
        <div className="mb-card overflow-hidden">
          <table className="mb-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Quality</th>
                <th>Transforms</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => {
                const duration = run.completed_at && run.started_at
                  ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                  : '—'
                return (
                  <tr key={run.id}>
                    <td className="font-bold text-mb-xs">{sourceNames[run.source_id] || run.source_id.slice(0, 8)}</td>
                    <td className="text-mb-text-medium text-mb-xs">
                      {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                    </td>
                    <td className="text-mb-xs font-mono">{duration}</td>
                    <td>
                      <span className={run.status === 'success' ? 'mb-badge-success' : run.status === 'failed' ? 'mb-badge-error' : 'mb-badge-warning'}>
                        {run.status}
                      </span>
                    </td>
                    <td className="text-mb-xs font-mono">{run.rows_after?.toLocaleString() ?? '—'}</td>
                    <td className="text-mb-xs font-mono">{run.quality_score ?? '—'}</td>
                    <td className="text-mb-xs font-mono">{run.transformations_applied ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
