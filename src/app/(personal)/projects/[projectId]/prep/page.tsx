'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Wand2, CheckCircle2, Clock, AlertTriangle, History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type SourceWithPrep = {
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

export default function DataPrepPage() {
  const [sources, setSources] = useState<SourceWithPrep[]>([])
  const [recipes, setRecipes] = useState<Record<string, RecipeInfo>>({})
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
      const { data: srcList } = await supabase
        .from('data_sources')
        .select('id, name, source_type, row_count, pipeline_status, pipeline_recipe_id, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      setSources(srcList ?? [])

      // Fetch recipes for sources that have them
      const recipeIds = (srcList ?? [])
        .filter(s => s.pipeline_recipe_id)
        .map(s => s.pipeline_recipe_id!)

      if (recipeIds.length > 0) {
        const { data: recipeList } = await supabase
          .from('pipeline_recipes')
          .select('id, last_run_at, last_quality_score, last_row_count, steps')
          .in('id', recipeIds)

        const recipeMap: Record<string, RecipeInfo> = {}
        for (const r of recipeList ?? []) {
          recipeMap[r.id] = r
        }
        setRecipes(recipeMap)
      }

      setLoading(false)
    }
    load()
  }, [projectId])

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-mb-2xl font-black text-mb-text-dark">Data Preparation</h1>
          <p className="text-mb-text-light text-mb-sm mt-0.5">
            Clean, transform, and validate your data sources
          </p>
        </div>
        <Link href={`${base}/prep/history`} className="mb-btn-secondary text-mb-xs">
          <History size={13} /> Run history
        </Link>
      </div>

      {/* Source cards */}
      <div className="space-y-3">
        {sources.map(src => {
          const recipe = src.pipeline_recipe_id ? recipes[src.pipeline_recipe_id] : null
          const isPrepared = src.pipeline_status === 'ready' || src.pipeline_status === 'scheduled'
          const stepsCount = Array.isArray(recipe?.steps) ? recipe.steps.length : 0

          return (
            <div key={src.id} className="mb-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-mb-md flex items-center justify-center ${
                    isPrepared ? 'bg-green-100' : 'bg-mb-bg-medium'
                  }`}>
                    {isPrepared
                      ? <CheckCircle2 size={18} className="text-mb-success" />
                      : <Wand2 size={18} className="text-mb-text-light" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-mb-sm font-black text-mb-text-dark">{src.name}</h3>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-mb-bg-medium text-mb-text-light">
                        {src.source_type}
                      </span>
                      {isPrepared && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                          Pipeline Ready
                        </span>
                      )}
                      {src.pipeline_status === 'scheduled' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-mb-brand-hover text-mb-brand">
                          Syncing
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-mb-xs text-mb-text-light">
                      <span>{src.row_count.toLocaleString()} rows</span>
                      {recipe?.last_quality_score != null && (
                        <span>Quality: {recipe.last_quality_score}/100</span>
                      )}
                      {recipe?.last_run_at && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatDistanceToNow(new Date(recipe.last_run_at), { addSuffix: true })}
                        </span>
                      )}
                      {stepsCount > 0 && (
                        <span>{stepsCount} transform{stepsCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isPrepared ? (
                    <Link href={`${base}/prep/${src.id}`} className="mb-btn-secondary text-mb-xs">
                      Re-run
                    </Link>
                  ) : (
                    <Link href={`${base}/prep/${src.id}`} className="mb-btn-primary text-mb-xs">
                      <Wand2 size={12} /> Prepare
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
