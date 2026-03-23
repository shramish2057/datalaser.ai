'use client'
import { useTranslations } from 'next-intl'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  CheckCircle2, Clock, AlertTriangle, Play, Loader2, Wand2, History
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Recipe = {
  id: string
  steps: unknown[]
  last_run_at: string | null
  last_run_status: string | null
  last_quality_score: number | null
  last_row_count: number | null
  schedule_enabled: boolean
  schedule_interval: string
  next_run_at: string | null
}

type RunHistory = {
  id: string
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
  drift_details: unknown
}

const INTERVALS = [
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '12h', label: 'Every 12 hours' },
  { value: '24h', label: 'Every 24 hours' },
  { value: '7d', label: 'Every 7 days' },
]

function intervalMs(interval: string): number {
  const map: Record<string, number> = { '1h': 3600000, '6h': 21600000, '12h': 43200000, '24h': 86400000, '7d': 604800000 }
  return map[interval] || 86400000
}

export default function SourceSettingsPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const sourceId = params.sourceId as string

  const [source, setSource] = useState<{ name: string; pipeline_status: string; pipeline_recipe_id: string | null } | null>(null)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [history, setHistory] = useState<RunHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [interval, setInterval] = useState('24h')
  const [toast, setToast] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const base = `/projects/${projectId}/sources/${sourceId}`

  useEffect(() => {
    async function load() {
      const { data: src } = await supabase
        .from('data_sources')
        .select('name, pipeline_status, pipeline_recipe_id')
        .eq('id', sourceId)
        .single()
      setSource(src)

      if (src?.pipeline_recipe_id) {
        const { data: rec } = await supabase
          .from('pipeline_recipes')
          .select('*')
          .eq('id', src.pipeline_recipe_id)
          .single()
        if (rec) {
          setRecipe(rec)
          setScheduleEnabled(rec.schedule_enabled)
          setInterval(rec.schedule_interval || '24h')
        }

        const { data: runs } = await supabase
          .from('pipeline_run_history')
          .select('*')
          .eq('recipe_id', src.pipeline_recipe_id)
          .order('started_at', { ascending: false })
          .limit(10)
        setHistory(runs ?? [])
      }

      setLoading(false)
    }
    load()
  }, [sourceId])

  const handleRunNow = async () => {
    if (!recipe) return
    setRunning(true)
    try {
      const res = await fetch('/api/pipeline/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId, recipe_id: recipe.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pipeline run failed')
      setToast(t('studio.pipelineComplete', { score: String(data.quality_score) }))
      setTimeout(() => setToast(''), 4000)

      // Refresh data
      const { data: rec } = await supabase
        .from('pipeline_recipes').select('*').eq('id', recipe.id).single()
      if (rec) setRecipe(rec)
      const { data: runs } = await supabase
        .from('pipeline_run_history').select('*').eq('recipe_id', recipe.id)
        .order('started_at', { ascending: false }).limit(10)
      setHistory(runs ?? [])
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Pipeline run failed')
      setTimeout(() => setToast(''), 4000)
    } finally {
      setRunning(false)
    }
  }

  const handleSaveSchedule = async () => {
    if (!recipe) return
    setSaving(true)
    const nextRun = scheduleEnabled
      ? new Date(Date.now() + intervalMs(interval)).toISOString()
      : null

    await supabase.from('pipeline_recipes').update({
      schedule_enabled: scheduleEnabled,
      schedule_interval: interval,
      next_run_at: nextRun,
      updated_at: new Date().toISOString(),
    }).eq('id', recipe.id)

    await supabase.from('data_sources').update({
      pipeline_status: scheduleEnabled ? 'scheduled' : 'ready',
    }).eq('id', sourceId)

    setRecipe(prev => prev ? { ...prev, schedule_enabled: scheduleEnabled, schedule_interval: interval, next_run_at: nextRun } : null)
    setSaving(false)
    setToast('Schedule saved')
    setTimeout(() => setToast(''), 3000)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
        <div className="h-32 rounded-mb-md bg-mb-bg-medium animate-pulse" />
        <div className="h-20 rounded-mb-md bg-mb-bg-medium animate-pulse" />
      </div>
    )
  }

  const isPrepared = source?.pipeline_status !== 'unprepared' && recipe

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 font-sans">
      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">{source?.name}</h1>
      <p className="text-mb-text-light text-mb-sm mb-8">Data source settings</p>

      {/* SECTION 1 — Pipeline Status */}
      <div className="mb-8">
        <p className="mb-section-header mb-3">Pipeline Status</p>

        {!isPrepared ? (
          <div className="mb-card p-6 text-center">
            <Wand2 size={24} className="text-mb-text-light mx-auto mb-3" />
            <p className="text-mb-text-dark text-mb-sm font-bold mb-1">Data not yet prepared</p>
            <p className="text-mb-text-medium text-mb-xs mb-4">Run the preparation wizard to clean and validate your data.</p>
            <button onClick={() => router.push(`${base}/prepare`)} className="mb-btn-primary">
              Prepare data <Wand2 size={13} />
            </button>
          </div>
        ) : (
          <div className="mb-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={18} className="text-mb-success" />
              <span className="text-mb-sm font-black text-mb-text-dark">Pipeline Ready</span>
              {source?.pipeline_status === 'scheduled' && (
                <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-mb-brand-hover text-mb-brand">Scheduled</span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Last run', value: recipe.last_run_at ? formatDistanceToNow(new Date(recipe.last_run_at), { addSuffix: true }) : '—' },
                { label: 'Quality', value: recipe.last_quality_score != null ? `${recipe.last_quality_score}/100` : '—' },
                { label: 'Rows', value: recipe.last_row_count?.toLocaleString() ?? '—' },
                { label: 'Transforms', value: (recipe.steps as unknown[]).length },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-[10px] font-bold text-mb-text-light uppercase tracking-wider">{s.label}</p>
                  <p className="text-mb-sm font-black text-mb-text-dark">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={handleRunNow} disabled={running} className={`mb-btn-primary text-mb-xs ${running ? 'opacity-40' : ''}`}>
                {running ? <><Loader2 size={13} className="animate-spin" /> Running...</> : <><Play size={13} /> Run now</>}
              </button>
              <button onClick={() => setShowHistory(!showHistory)} className="mb-btn-secondary text-mb-xs">
                <History size={13} /> {showHistory ? 'Hide' : 'View'} history
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2 — Schedule */}
      {isPrepared && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <p className="mb-section-header">Scheduled Sync</p>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">Enterprise</span>
          </div>

          <div className="mb-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-mb-sm font-bold text-mb-text-dark">Automatically re-clean this data</p>
                <p className="text-mb-xs text-mb-text-light">Re-run transforms and validation on a schedule</p>
              </div>
              <button
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${scheduleEnabled ? 'bg-mb-brand' : 'bg-mb-bg-medium'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${scheduleEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {scheduleEnabled && (
              <div className="space-y-3 border-t border-mb-border pt-4">
                {INTERVALS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${interval === opt.value ? 'border-mb-brand' : 'border-mb-border-dark'}`}>
                      {interval === opt.value && <div className="w-2 h-2 rounded-full bg-mb-brand" />}
                    </div>
                    <span className="text-mb-sm text-mb-text-dark">{opt.label}</span>
                  </label>
                ))}

                {recipe?.next_run_at && (
                  <p className="text-mb-xs text-mb-text-light flex items-center gap-1">
                    <Clock size={11} /> Next run: {formatDistanceToNow(new Date(recipe.next_run_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            )}

            <button onClick={handleSaveSchedule} disabled={saving} className={`mb-btn-primary text-mb-xs mt-4 ${saving ? 'opacity-40' : ''}`}>
              {saving ? 'Saving...' : 'Save schedule'}
            </button>
          </div>
        </div>
      )}

      {/* SECTION 3 — Run History */}
      {showHistory && history.length > 0 && (
        <div className="mb-8">
          <p className="mb-section-header mb-3">Run History</p>
          <div className="mb-card overflow-hidden">
            <table className="mb-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Quality</th>
                  <th>Transforms</th>
                  <th>Drift</th>
                </tr>
              </thead>
              <tbody>
                {history.map(run => {
                  const duration = run.completed_at && run.started_at
                    ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                    : '—'
                  return (
                    <tr key={run.id}>
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
                      <td>
                        {run.drift_detected ? (
                          <span className="flex items-center gap-1 text-mb-xs text-orange-500 font-bold">
                            <AlertTriangle size={11} /> Detected
                          </span>
                        ) : (
                          <span className="text-mb-text-light text-mb-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-mb-bg border border-mb-border shadow-mb-lg rounded-mb-lg px-4 py-3 flex items-center gap-2 z-50">
          <CheckCircle2 size={14} className="text-mb-success" />
          <span className="text-mb-sm text-mb-text-dark font-bold">{toast}</span>
        </div>
      )}
    </div>
  )
}
