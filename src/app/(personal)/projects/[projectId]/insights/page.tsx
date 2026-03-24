'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  BarChart2, Database, Zap, ArrowRight, Loader2, Play,
  CheckCircle2, Clock, AlertTriangle
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { translateFinding } from '@/lib/i18n/findingsMap'

interface SourceAnalysis {
  id: string
  name: string
  source_type: string
  row_count: number
  pipeline_status: string
  analyzed_at: string | null
  analysis_status: string | null
  insight_count: number
  top_insights: { type: string; headline: string }[]
}

export default function InsightsPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [sources, setSources] = useState<SourceAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: srcs } = await supabase
        .from('data_sources')
        .select('id, name, source_type, row_count, pipeline_status, analyzed_at, analysis_status, auto_analysis')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('analyzed_at', { ascending: false, nullsFirst: false })

      const mapped: SourceAnalysis[] = (srcs || []).map(src => {
        const analysis = src.auto_analysis as Record<string, unknown> | null
        const insights = (analysis?.top_insights as { type: string; headline: string }[]) || []
        return {
          id: src.id,
          name: src.name,
          source_type: src.source_type,
          row_count: src.row_count || 0,
          pipeline_status: src.pipeline_status || 'unprepared',
          analyzed_at: src.analyzed_at,
          analysis_status: src.analysis_status,
          insight_count: insights.length,
          top_insights: insights.slice(0, 3),
        }
      })

      setSources(mapped)
      setLoading(false)
    }
    load()
  }, [projectId])

  const handleRunAnalysis = async (sourceId: string) => {
    setRunningId(sourceId)
    try {
      const { data: src } = await supabase
        .from('data_sources').select('file_path, source_type, name')
        .eq('id', sourceId).single()
      if (!src?.file_path) return

      const { data: blob } = await supabase.storage.from('data-sources').download(src.file_path)
      if (!blob) return

      const fd = new FormData()
      fd.append('file', new File([blob], src.name), src.name)
      fd.append('file_type', src.source_type || 'csv')
      fd.append('source_id', sourceId)

      const res = await fetch('/api/pipeline/auto-analysis', { method: 'POST', body: fd })
      const data = await res.json()

      if (!data.error) {
        await supabase.from('data_sources').update({
          auto_analysis: data,
          analysis_status: 'complete',
          analyzed_at: new Date().toISOString(),
        }).eq('id', sourceId)

        // Refresh
        const insights = (data.top_insights as { type: string; headline: string }[]) || []
        setSources(prev => prev.map(s => s.id === sourceId ? {
          ...s, insight_count: insights.length, top_insights: insights.slice(0, 3),
          analysis_status: 'complete', analyzed_at: new Date().toISOString(),
        } : s))
      }
    } finally {
      setRunningId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="text-dl-brand animate-spin" />
      </div>
    )
  }

  const base = `/projects/${projectId}`
  const analyzed = sources.filter(s => s.insight_count > 0)
  const pending = sources.filter(s => s.insight_count === 0)

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-black text-dl-text-dark">{t('insights.title')}</h1>
          <p className="text-dl-text-light text-dl-xs mt-0.5">
            {t('insights.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-dl-xs text-dl-text-light">
            {analyzed.length} {t('common.of')} {sources.length} sources
          </span>
        </div>
      </div>

      {sources.length === 0 && (
        <div className="bg-white border border-dl-border rounded-dl-lg p-8 text-center">
          <Database size={32} className="text-dl-brand mx-auto mb-3" />
          <p className="text-dl-text-dark text-dl-sm font-medium mb-2">{t('insights.noSources')}</p>
          <p className="text-dl-text-light text-dl-xs mb-4">{t('insights.noSourcesDesc')}</p>
          <button onClick={() => router.push(`${base}/sources/new`)}
            className="dl-btn-primary text-dl-sm px-4 py-2">
            {t('home.addSource')}
          </button>
        </div>
      )}

      {/* Analyzed Sources */}
      {analyzed.length > 0 && (
        <section className="mb-6">
          <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light mb-3">
            {t('insights.analyzed')} ({analyzed.length})
          </p>
          <div className="space-y-3">
            {analyzed.map(src => (
              <button key={src.id}
                onClick={() => router.push(`${base}/sources/${src.id}/analysis`)}
                className="w-full bg-white border border-dl-border rounded-dl-lg p-4 text-left hover:border-dl-brand transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-dl-success flex-shrink-0" />
                    <span className="text-[14px] font-bold text-dl-text-dark">{src.name}</span>
                    <span className="text-dl-xs text-dl-text-light uppercase bg-dl-bg-light px-1.5 py-0.5 rounded">
                      {src.source_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-dl-xs text-dl-brand font-medium">{src.insight_count} {t('home.insights')}</span>
                    <ArrowRight size={14} className="text-dl-text-light group-hover:text-dl-brand transition-colors" />
                  </div>
                </div>

                {/* Preview of top insights */}
                <div className="ml-7 space-y-1">
                  {src.top_insights.map((ins, i) => (
                    <p key={i} className="text-[12px] text-dl-text-medium truncate">
                      <span className="text-dl-xs text-dl-text-light mr-1.5">{t(`insightTypes.${ins.type}` as Parameters<typeof t>[0])}</span>
                      {translateFinding(ins.headline, locale)}
                    </p>
                  ))}
                </div>

                <div className="ml-7 mt-2 flex items-center gap-3 text-dl-xs text-dl-text-light">
                  <span>{src.row_count.toLocaleString()} rows</span>
                  {src.analyzed_at && (
                    <span>{t('insights.analyzed')} {new Date(src.analyzed_at).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US')}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Pending Sources */}
      {pending.length > 0 && (
        <section>
          <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light mb-3">
            {t('insights.notAnalyzed')} ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map(src => (
              <div key={src.id}
                className="bg-white border border-dl-border rounded-dl-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock size={16} className="text-dl-text-light flex-shrink-0" />
                  <div>
                    <span className="text-[13px] font-medium text-dl-text-dark">{src.name}</span>
                    <span className="text-dl-xs text-dl-text-light uppercase ml-2">{src.source_type}</span>
                    <p className="text-dl-xs text-dl-text-light">{src.row_count.toLocaleString()} rows</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRunAnalysis(src.id) }}
                  disabled={runningId === src.id}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-dl-brand hover:text-dl-brand-dark disabled:opacity-50 bg-dl-brand-hover px-3 py-1.5 rounded-dl-md">
                  {runningId === src.id ? (
                    <><Loader2 size={12} className="animate-spin" /> {t('common.analyzing')}</>
                  ) : (
                    <><Play size={12} /> {t('insights.runAnalysis')}</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
