'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Wand2, CheckCircle2, Clock, History,
  RefreshCw, BarChart2, ArrowRight
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type SourceRow = {
  id: string
  name: string
  source_type: string
  row_count: number
  pipeline_status: string | null
  pipeline_recipe_id: string | null
  created_at: string
}

type RecipeInfo = {
  id: string
  last_run_at: string | null
  last_quality_score: number | null
  last_row_count: number | null
  steps: unknown[]
}

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
}

type Tab = 'cleaned' | 'prepare' | 'history'

export default function DataPrepPage() {
  const [tab, setTab] = useState<Tab>('cleaned')
  const [sources, setSources] = useState<SourceRow[]>([])
  const [recipes, setRecipes] = useState<Record<string, RecipeInfo>>({})
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const base = `/projects/${projectId}`

  useEffect(() => {
    async function load() {
      // Fetch all sources
      const { data: srcList } = await supabase
        .from('data_sources')
        .select('id, name, source_type, row_count, pipeline_status, pipeline_recipe_id, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      setSources(srcList ?? [])

      // Fetch recipes
      const recipeIds = (srcList ?? [])
        .filter(s => s.pipeline_recipe_id)
        .map(s => s.pipeline_recipe_id!)

      if (recipeIds.length > 0) {
        const { data: recipeList } = await supabase
          .from('pipeline_recipes')
          .select('id, last_run_at, last_quality_score, last_row_count, steps')
          .in('id', recipeIds)

        const map: Record<string, RecipeInfo> = {}
        for (const r of recipeList ?? []) map[r.id] = r
        setRecipes(map)

        // Fetch run history
        const { data: runList } = await supabase
          .from('pipeline_run_history')
          .select('id, source_id, started_at, completed_at, status, quality_score, rows_before, rows_after, transformations_applied')
          .in('recipe_id', recipeIds)
          .order('started_at', { ascending: false })
          .limit(30)
        setRuns(runList ?? [])
      }

      setLoading(false)
    }
    load()
  }, [projectId])

  const cleanedSources = sources.filter(s => s.pipeline_status === 'ready' || s.pipeline_status === 'scheduled')
  const unpreparedSources = sources.filter(s => !s.pipeline_status || s.pipeline_status === 'unprepared')
  const sourceNames = Object.fromEntries(sources.map(s => [s.id, s.name]))

  // Auto-select the right tab
  useEffect(() => {
    if (!loading) {
      if (cleanedSources.length > 0) setTab('cleaned')
      else if (unpreparedSources.length > 0) setTab('prepare')
    }
  }, [loading])

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'cleaned', label: 'Cleaned Data', count: cleanedSources.length },
    { key: 'prepare', label: 'Prepare New', count: unpreparedSources.length },
    { key: 'history', label: 'History', count: runs.length },
  ]

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-3">
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-mb-bg-medium flex items-center justify-center mx-auto mb-4">
            <Wand2 size={28} className="text-mb-text-light" />
          </div>
          <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">No data sources to prepare</h2>
          <p className="text-mb-text-medium text-mb-base mb-6">
            Add a data source first, then come here to clean and prepare it.
          </p>
          <button onClick={() => router.push(`${base}/sources/new`)} className="mb-btn-primary px-6 py-2">
            Add data source
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">Data Preparation</h1>
      <p className="text-mb-text-light text-mb-sm mb-6">Clean, transform, and validate your data sources</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-mb-border mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-mb-sm font-bold transition-colors relative
              ${tab === t.key
                ? 'text-mb-brand'
                : 'text-mb-text-medium hover:text-mb-text-dark'}`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${tab === t.key ? 'bg-mb-brand-hover text-mb-brand' : 'bg-mb-bg-medium text-mb-text-light'}`}>
                {t.count}
              </span>
            )}
            {tab === t.key && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-mb-brand" />
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB: CLEANED DATA ═══ */}
      {tab === 'cleaned' && (
        cleanedSources.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={32} className="text-mb-text-light mx-auto mb-3" />
            <p className="text-mb-text-dark text-mb-sm font-bold mb-1">No cleaned datasets yet</p>
            <p className="text-mb-text-light text-mb-xs mb-4">
              Prepare a data source to see your cleaned data here.
            </p>
            {unpreparedSources.length > 0 && (
              <button onClick={() => setTab('prepare')} className="mb-btn-primary text-mb-xs">
                Prepare a source <ArrowRight size={12} />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {cleanedSources.map(src => {
              const recipe = src.pipeline_recipe_id ? recipes[src.pipeline_recipe_id] : null
              const stepsCount = Array.isArray(recipe?.steps) ? recipe.steps.length : 0
              return (
                <div key={src.id} className="mb-card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-mb-md bg-green-100 flex items-center justify-center">
                        <CheckCircle2 size={18} className="text-mb-success" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-mb-sm font-black text-mb-text-dark">{src.name}</h3>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                            Pipeline Ready
                          </span>
                          {src.pipeline_status === 'scheduled' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-mb-brand-hover text-mb-brand">
                              Auto-sync
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-mb-xs text-mb-text-light">
                          {recipe?.last_quality_score != null && (
                            <span className="flex items-center gap-1">
                              <BarChart2 size={10} />
                              Quality: <span className="font-bold text-mb-success">{recipe.last_quality_score}/100</span>
                            </span>
                          )}
                          <span>{recipe?.last_row_count?.toLocaleString() ?? src.row_count.toLocaleString()} rows</span>
                          {stepsCount > 0 && (
                            <span>{stepsCount} transform{stepsCount !== 1 ? 's' : ''} applied</span>
                          )}
                          {recipe?.last_run_at && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              Cleaned {formatDistanceToNow(new Date(recipe.last_run_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`${base}/prep/${src.id}`} className="mb-btn-secondary text-mb-xs">
                      <RefreshCw size={12} /> Re-run
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ═══ TAB: PREPARE NEW ═══ */}
      {tab === 'prepare' && (
        unpreparedSources.length === 0 ? (
          <div className="text-center py-12">
            <Wand2 size={32} className="text-mb-text-light mx-auto mb-3" />
            <p className="text-mb-text-dark text-mb-sm font-bold mb-1">All sources have been prepared</p>
            <p className="text-mb-text-light text-mb-xs">
              Add a new data source to prepare it, or re-run an existing pipeline.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {unpreparedSources.map(src => (
              <div key={src.id} className="mb-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-mb-md bg-mb-bg-medium flex items-center justify-center">
                      <Wand2 size={18} className="text-mb-text-light" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-mb-sm font-black text-mb-text-dark">{src.name}</h3>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-mb-bg-medium text-mb-text-light">
                          {src.source_type}
                        </span>
                      </div>
                      <p className="text-mb-xs text-mb-text-light mt-0.5">
                        {src.row_count.toLocaleString()} rows · Added {formatDistanceToNow(new Date(src.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Link href={`${base}/prep/${src.id}`} className="mb-btn-primary text-mb-xs">
                    <Wand2 size={12} /> Prepare
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══ TAB: HISTORY ═══ */}
      {tab === 'history' && (
        runs.length === 0 ? (
          <div className="text-center py-12">
            <History size={32} className="text-mb-text-light mx-auto mb-3" />
            <p className="text-mb-text-dark text-mb-sm font-bold mb-1">No pipeline runs yet</p>
            <p className="text-mb-text-light text-mb-xs">Prepare a data source to see run history here.</p>
          </div>
        ) : (
          <div className="mb-card overflow-hidden">
            <table className="mb-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>When</th>
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
                      <td className="text-mb-xs font-mono">
                        {run.rows_before && run.rows_after
                          ? `${run.rows_before.toLocaleString()} → ${run.rows_after.toLocaleString()}`
                          : run.rows_after?.toLocaleString() ?? '—'}
                      </td>
                      <td className="text-mb-xs font-mono">{run.quality_score ?? '—'}</td>
                      <td className="text-mb-xs font-mono">{run.transformations_applied ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
