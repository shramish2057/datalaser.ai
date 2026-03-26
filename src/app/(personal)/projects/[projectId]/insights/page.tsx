'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  BarChart2, Database, Zap, Loader2, Play,
  RefreshCw
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { translateFinding } from '@/lib/i18n/findingsMap'
import { isDbSource } from '@/lib/source-types'
import { normalizeInsights } from '@/lib/normalizeInsight'
import { useProjectContext } from '@/lib/hooks/useProjectContext'
import { useActiveSource } from '@/lib/context/ActiveSourceContext'
import { DataSourceSelector } from '@/components/DataSourceSelector'

export default function InsightsPage() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const { projectId, basePath } = useProjectContext()
  const { activeSourceId, activeSource } = useActiveSource()

  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const runAnalysis = async () => {
    if (!activeSourceId) return
    setRunning(true)
    try {
      const { data: src } = await supabase
        .from('data_sources').select('file_path, source_type, name')
        .eq('id', activeSourceId).single()
      if (!src) return

      let data: Record<string, unknown> | null = null

      if (isDbSource(src.source_type)) {
        // Full 17 auto-analyses on live DB (same as file analysis)
        const res = await fetch('/api/pipeline/auto-analysis-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: activeSourceId }),
        })
        data = await res.json()
        if (data?.error) {
          console.error('DB auto-analysis failed:', data.error)
          data = null
        }
      } else {
        if (!src.file_path) return
        const { data: blob } = await supabase.storage.from('data-sources').download(src.file_path)
        if (!blob) return

        const fd = new FormData()
        fd.append('file', new File([blob], src.name), src.name)
        fd.append('file_type', src.source_type || 'csv')
        fd.append('source_id', activeSourceId)

        const res = await fetch('/api/pipeline/auto-analysis', { method: 'POST', body: fd })
        data = await res.json()
      }

      if (data && !data.error) {
        await supabase.from('data_sources').update({
          auto_analysis: data,
          analysis_status: 'complete',
          analyzed_at: new Date().toISOString(),
        }).eq('id', activeSourceId)

        setAnalysis(data)
      }
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (!activeSourceId) { setLoading(false); return }
    async function loadAnalysis() {
      setLoading(true)
      setAnalysis(null)
      const { data: src } = await supabase
        .from('data_sources')
        .select('auto_analysis, analyzed_at')
        .eq('id', activeSourceId)
        .single()
      if (src?.auto_analysis) {
        setAnalysis(src.auto_analysis as Record<string, unknown>)
        setLoading(false)
      } else {
        setLoading(false)
        // Auto-trigger analysis for sources without it
        await runAnalysis()
      }
    }
    loadAnalysis()
  }, [activeSourceId])

  const base = basePath

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="text-dl-brand animate-spin" />
      </div>
    )
  }

  if (!activeSource) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="bg-white border border-dl-border rounded-dl-lg p-8 text-center">
          <Database size={32} className="text-dl-brand mx-auto mb-3" />
          <p className="text-dl-text-dark text-dl-sm font-medium mb-2">Select a data source</p>
          <p className="text-dl-text-light text-dl-xs">Choose a data source from the top bar to view insights.</p>
        </div>
      </div>
    )
  }

  // If full auto-analysis is available (has correlations, distributions etc.),
  // redirect to the dedicated analysis page which renders all tabs and charts
  const hasFullAnalysis = analysis?.correlations && analysis?.distributions
  if (hasFullAnalysis && activeSourceId) {
    router.replace(`${basePath}/sources/${activeSourceId}/analysis`)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="text-dl-brand animate-spin" />
      </div>
    )
  }

  const rawInsights = (analysis?.top_insights as { type: string; headline: unknown }[]) || []
  const insights = normalizeInsights(rawInsights)
  const summary = analysis?.summary as string | undefined
  const kpis = analysis?.kpis as { label: string; value: string | number }[] | undefined

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-black text-dl-text-dark">{t('insights.title')}</h1>
        <div className="flex items-center gap-3">
          <DataSourceSelector />
          <button
            onClick={() => runAnalysis()}
            disabled={running}
            className="dl-btn-secondary text-dl-xs px-3 py-1.5 flex items-center gap-1.5"
          >
          {running ? (
            <><Loader2 size={12} className="animate-spin" /> {t('common.analyzing')}</>
          ) : (
            <><RefreshCw size={12} /> {t('insights.runAnalysis')}</>
          )}
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="bg-white border border-dl-border rounded-dl-lg p-5 mb-4">
          <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light mb-2">Summary</p>
          <p className="text-dl-sm text-dl-text-dark leading-relaxed">{summary}</p>
        </div>
      )}

      {/* KPIs */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {kpis.map((kpi, i) => (
            <div key={i} className="bg-white border border-dl-border rounded-dl-lg p-4 text-center">
              <p className="text-dl-xs text-dl-text-light font-medium uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className="text-lg font-black text-dl-text-dark">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 ? (
        <div className="bg-white border border-dl-border rounded-dl-lg overflow-hidden">
          <div className="px-5 py-3 bg-dl-bg-light border-b border-dl-border">
            <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light">
              {t('insights.analyzed')} ({insights.length})
            </p>
          </div>
          <div className="divide-y divide-dl-border">
            {insights.map((ins, i) => {
              const severity = (ins as any).severity || 'info'
              const severityColor = severity === 'warning' ? 'border-l-amber-400 bg-amber-50/30' :
                severity === 'critical' ? 'border-l-red-400 bg-red-50/30' : 'border-l-blue-400 bg-blue-50/30'
              return (
                <div key={i} className={`px-5 py-3 border-l-3 ${severityColor} flex items-start gap-3`}>
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    severity === 'warning' ? 'bg-amber-400' : severity === 'critical' ? 'bg-red-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-dl-sm text-dl-text-dark leading-relaxed">
                      {translateFinding(ins.headline, locale)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : !running ? (
        <div className="bg-white border border-dl-border rounded-dl-lg p-8 text-center">
          <Zap size={28} className="text-dl-brand mx-auto mb-3" />
          <p className="text-dl-text-dark text-dl-sm font-medium mb-2">No insights yet</p>
          <p className="text-dl-text-light text-dl-xs mb-4">Run analysis to generate insights for this source.</p>
          <button
            onClick={() => runAnalysis()}
            disabled={running}
            className="dl-btn-primary text-dl-sm px-4 py-2"
          >
            <Play size={14} className="mr-1.5" /> {t('insights.runAnalysis')}
          </button>
        </div>
      ) : null}

      {/* Running indicator */}
      {running && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="text-dl-brand animate-spin mr-2" />
          <span className="text-dl-sm text-dl-text-medium">{t('common.analyzing')}...</span>
        </div>
      )}
    </div>
  )
}
