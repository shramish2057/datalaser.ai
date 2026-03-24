'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Loader2, ArrowLeft, Zap, TrendingUp, BarChart3, GitBranch,
  AlertTriangle, Target, Layers, Search, Sparkles
} from 'lucide-react'
import { InteractiveChart, type ChartData } from '@/components/charts/InteractiveChart'
import { HeatmapChart } from '@/components/charts/HeatmapChart'
import { KPICard } from '@/components/charts/KPICard'
import { DrillProvider } from '@/components/charts/DrillContext'
import { DrillDownPanel } from '@/components/charts/DrillDownPanel'
import { useTranslations, useLocale } from 'next-intl'
import { translateFinding } from '@/lib/i18n/findingsMap'
import { isDbSource } from '@/lib/source-types'
import type { AutoAnalysisResult, AutoAnalysisInsight } from '@/types/pipeline'
import type { DrillFilter } from '@/types/drill'

const INSIGHT_ICONS: Record<string, typeof Zap> = {
  correlation: GitBranch,
  group_difference: BarChart3,
  anomaly: AlertTriangle,
  distribution: Layers,
  association: GitBranch,
  trend: TrendingUp,
  change_point: Zap,
  seasonality: TrendingUp,
  majority: Target,
  key_influencer: Search,
  clustering: Layers,
  outlier_explanation: AlertTriangle,
  forecast: TrendingUp,
  leading_indicator: Sparkles,
  contribution: BarChart3,
  temporal_pattern: TrendingUp,
}

const INSIGHT_COLORS: Record<string, string> = {
  correlation: 'border-blue-200 bg-blue-50',
  group_difference: 'border-green-200 bg-green-50',
  anomaly: 'border-red-200 bg-red-50',
  distribution: 'border-purple-200 bg-purple-50',
  association: 'border-teal-200 bg-teal-50',
  trend: 'border-indigo-200 bg-indigo-50',
  change_point: 'border-orange-200 bg-orange-50',
  majority: 'border-amber-200 bg-amber-50',
  key_influencer: 'border-cyan-200 bg-cyan-50',
  clustering: 'border-gray-200 bg-gray-50',
  forecast: 'border-emerald-200 bg-emerald-50',
}

export default function AutoAnalysisPage() {
  const t = useTranslations()
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const sourceId = params.sourceId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [analysis, setAnalysis] = useState<AutoAnalysisResult | null>(null)
  const [drillFilters, setDrillFilters] = useState<DrillFilter[]>([])
  const [showDrill, setShowDrill] = useState(false)
  const [activeTab, setActiveTab] = useState<'insights' | 'correlations' | 'distributions' | 'segments' | 'advanced'>('insights')
  const fileRef = useRef<File | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      try {
        // Get source info
        const { data: src } = await supabase
          .from('data_sources').select('name, file_path, source_type, auto_analysis')
          .eq('id', sourceId).single()
        if (!src) { setError('Source not found'); setLoading(false); return }
        setSourceName(src.name)

        // DB sources use the overview page, not this file-analysis page
        if (isDbSource(src.source_type)) {
          router.replace(`/projects/${projectId}/sources/${sourceId}/overview`)
          return
        }

        // If auto_analysis already cached, use it
        if (src.auto_analysis) {
          setAnalysis(src.auto_analysis as AutoAnalysisResult)
          setLoading(false)
          return
        }

        // Otherwise, download file and run analysis
        if (!src.file_path) { setError('No file available for analysis'); setLoading(false); return }
        const { data: blob } = await supabase.storage.from('data-sources').download(src.file_path)
        if (!blob) { setError('Failed to download file'); setLoading(false); return }

        fileRef.current = new File([blob], src.name, { type: 'text/csv' })

        const fd = new FormData()
        fd.append('file', fileRef.current)
        fd.append('file_type', src.source_type || 'csv')
        fd.append('source_id', sourceId)

        const res = await fetch('/api/pipeline/auto-analysis', { method: 'POST', body: fd })
        const data = await res.json()

        if (data.error) { setError(data.error); setLoading(false); return }

        setAnalysis(data as AutoAnalysisResult)

        // Cache results to Supabase
        await supabase.from('data_sources').update({
          auto_analysis: data,
          analysis_status: 'complete',
          analyzed_at: new Date().toISOString(),
        }).eq('id', sourceId)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Analysis failed')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sourceId])

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 size={32} className="text-dl-brand animate-spin" />
        <p className="text-dl-text-dark text-dl-sm font-medium">{t('analysis.running')}</p>
        <p className="text-dl-text-light text-dl-xs">{t('analysis.runningDesc')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle size={32} className="text-dl-error mx-auto mb-3" />
        <p className="text-dl-text-dark text-dl-sm">{error}</p>
        <button onClick={() => router.back()} className="mt-4 text-dl-brand text-dl-sm hover:underline">Go back</button>
      </div>
    )
  }

  if (!analysis) return null

  const handleDrill = (filter: DrillFilter) => {
    setDrillFilters(prev => [...prev, filter])
    setShowDrill(true)
  }

  return (
    <DrillProvider>
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.back()} className="flex items-center gap-1 text-dl-text-light text-dl-xs hover:text-dl-brand mb-1">
              <ArrowLeft size={12} /> Back
            </button>
            <h1 className="text-[20px] font-black text-dl-text-dark">{sourceName}</h1>
            <p className="text-dl-text-light text-dl-xs mt-0.5">
              Auto-Analysis{analysis.row_count ? ` — ${analysis.row_count.toLocaleString()} rows, ${analysis.column_count} columns` : ''}
              {analysis.measures?.length ? ` (${analysis.measures.length} measures, ${analysis.dimensions?.length || 0} dimensions, ${analysis.binaries?.length || 0} binary, ${analysis.dates?.length || 0} dates)` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-dl-xs font-bold">
              {analysis.top_insights.length} {t('home.insights')}
            </span>
            <button onClick={() => router.push(`/projects/${projectId}/studio`)}
              className="text-[12px] bg-dl-brand text-white px-3 py-1.5 rounded-dl-md hover:bg-dl-brand-dark font-medium">
              {t('analysis.exploreStudio')}
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-3">
          <KPICard label={t('common.rows')} value={analysis.row_count} size="sm" />
          <KPICard label={t('analysis.measures')} value={analysis.measures.length} unit={`${t('common.of')} ${analysis.column_count} ${t('common.columns').toLowerCase()}`} size="sm" />
          <KPICard label={t('analysis.sigCorrelations')} value={analysis.correlations.pairs.filter(p => p.significant).length}
            unit={`${t('common.of')} ${analysis.correlations.pairs.length}`} size="sm" />
          <KPICard label={t('analysis.outlierColumns')} value={analysis.anomalies.length}
            unit={`${t('common.of')} ${analysis.measures.length}`} size="sm" />
          <KPICard label={t('analysis.clustersFound')} value={analysis.clusters.n_clusters} size="sm" />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-dl-border">
          {([
            { id: 'insights' as const, label: t('analysis.topInsights'), icon: Zap, count: analysis.top_insights.length },
            { id: 'correlations' as const, label: t('analysis.correlationMatrix'), icon: GitBranch, count: analysis.correlations.pairs.length },
            { id: 'distributions' as const, label: t('analysis.distributions'), icon: Layers, count: analysis.distributions.length },
            { id: 'segments' as const, label: t('analysis.segmentsInfluencers'), icon: BarChart3, count: analysis.segments.length + analysis.key_influencers.length },
            { id: 'advanced' as const, label: t('analysis.advanced'), icon: Sparkles, count: analysis.clusters.n_clusters + analysis.contribution_analysis.length + analysis.majority.length },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-dl-brand text-dl-brand'
                  : 'border-transparent text-dl-text-medium hover:text-dl-text-dark'
              }`}>
              <tab.icon size={13} />
              {tab.label}
              {tab.count > 0 && <span className="text-dl-xs bg-dl-bg-medium px-1.5 py-0.5 rounded-full">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* TAB: Top Insights */}
        {activeTab === 'insights' && (
        <section>
          <div className="space-y-3">
            {analysis.top_insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} index={i + 1} onDrill={handleDrill} />
            ))}
            {analysis.top_insights.length === 0 && (
              <p className="text-dl-text-light text-dl-sm py-8 text-center">No significant insights detected in this dataset.</p>
            )}
          </div>
        </section>
        )}

        {/* TAB: Correlations */}
        {activeTab === 'correlations' && (<>
        {/* Correlation Heatmap */}
        {analysis.correlations.columns.length >= 2 && (
          <section>
            <h2 className="text-[14px] font-black text-dl-text-dark uppercase tracking-wider mb-3 flex items-center gap-2">
              <GitBranch size={16} className="text-blue-500" /> Correlation Matrix
            </h2>
            <div className="bg-white border border-dl-border rounded-dl-lg p-4">
              <HeatmapChart
                matrix={analysis.correlations.matrix}
                columns={analysis.correlations.columns}
                title={t("analysis.correlationMatrix")}
              />
              {analysis.correlations.pairs.length > 0 && (
                <div className="mt-3 border-t border-dl-border pt-3">
                  <p className="text-dl-xs font-semibold uppercase tracking-wider text-dl-text-light mb-2">Top Pairs</p>
                  <div className="space-y-1">
                    {analysis.correlations.pairs.slice(0, 5).map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <span className={`w-2 h-2 rounded-full ${p.significant ? 'bg-dl-brand' : 'bg-dl-border-dark'}`} />
                        <span className="text-dl-text-dark font-medium">{p.col1} ↔ {p.col2}</span>
                        <span className="text-dl-text-light">r={p.r}</span>
                        <span className={`text-dl-xs px-1.5 py-0.5 rounded ${p.significant ? 'bg-green-50 text-green-700' : 'bg-dl-bg-light text-dl-text-light'}`}>
                          {t(`strength.${p.strength}` as Parameters<typeof t>[0])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        </>)}

        {/* TAB: Distributions */}
        {activeTab === 'distributions' && (<>
        {analysis.distributions.length > 0 && (
          <section>
            <h2 className="text-[14px] font-black text-dl-text-dark uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers size={16} className="text-purple-500" /> Distributions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {analysis.distributions.slice(0, 6).map((dist, i) => (
                <div key={i} className="bg-white border border-dl-border rounded-dl-lg overflow-hidden">
                  <InteractiveChart chart={{
                    type: 'histogram',
                    title: `${dist.column} — ${dist.shape}`,
                    data: dist.counts.map((c, j) => ({
                      bin: Math.round((dist.bins[j] + dist.bins[j + 1]) / 2 * 100) / 100,
                      count: c,
                    })),
                    xKey: 'bin', yKey: 'count', yKeys: ['count'],
                  }} />
                  <div className="px-4 pb-3 flex gap-4 text-dl-xs text-dl-text-medium">
                    <span>Mean: <b>{dist.mean.toLocaleString()}</b></span>
                    <span>Median: <b>{dist.median.toLocaleString()}</b></span>
                    <span>Skew: <b>{dist.skewness}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        </>)}

        {/* TAB: Segments & Influencers */}
        {activeTab === 'segments' && (<>
        {analysis.segments.length > 0 && (
          <section>
            <h2 className="text-[14px] font-black text-dl-text-dark uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-green-500" /> Segment Comparisons
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {analysis.segments.slice(0, 4).map((seg, i) => (
                <InteractiveChart key={i} chart={{
                  type: 'bar',
                  title: `${seg.measure} by ${seg.dimension} (p=${seg.p_value < 0.001 ? '<0.001' : seg.p_value.toFixed(4)})`,
                  data: seg.groups,
                  xKey: 'group', yKey: 'mean', yKeys: ['mean'],
                  referenceLines: [{
                    value: seg.groups.reduce((sum, g) => sum + g.mean * g.n, 0) / Math.max(seg.groups.reduce((sum, g) => sum + g.n, 0), 1),
                    label: 'Overall mean', color: '#ED6E6E',
                  }],
                }} onDrillDown={handleDrill} />
              ))}
            </div>
          </section>
        )}

        {/* Key Influencers */}
        {analysis.key_influencers.length > 0 && (
          <section>
            <h2 className="text-[14px] font-black text-dl-text-dark uppercase tracking-wider mb-3 flex items-center gap-2">
              <Search size={16} className="text-cyan-500" /> Key Influencers
            </h2>
            <div className="bg-white border border-dl-border rounded-dl-lg overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-dl-border bg-dl-bg-light">
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Target</th>
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Influencer</th>
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">{t("common.type")}</th>
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Effect</th>
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.key_influencers.map((inf, i) => (
                    <tr key={i} className="border-b border-dl-border hover:bg-dl-bg-light">
                      <td className="px-4 py-2 font-medium text-dl-text-dark">{inf.target}</td>
                      <td className="px-4 py-2 text-dl-brand font-medium">{inf.influencer}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-dl-xs font-bold ${inf.type === 'categorical' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {inf.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {inf.cramers_v ? `V=${inf.cramers_v.toFixed(3)}` : inf.correlation ? `r=${inf.correlation.toFixed(3)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-dl-text-medium">
                        {inf.best_group ? `${inf.best_group}: ${((inf.best_rate || 0) * 100).toFixed(1)}% vs ${inf.worst_group}: ${((inf.worst_rate || 0) * 100).toFixed(1)}%` :
                         inf.correlation ? `p=${inf.p_value < 0.001 ? '<0.001' : inf.p_value.toFixed(4)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        </>)}

        {/* TAB: Advanced */}
        {activeTab === 'advanced' && (<>
        {/* Contribution Analysis */}
        {analysis.contribution_analysis.length > 0 && (
          <section>
            <h2 className="text-[14px] font-black text-dl-text-dark uppercase tracking-wider mb-3 flex items-center gap-2">
              <Target size={16} className="text-amber-500" /> Contribution Analysis
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {analysis.contribution_analysis.slice(0, 4).map((contrib, i) => (
                <InteractiveChart key={i} chart={{
                  type: 'bar',
                  title: `${contrib.measure} by ${contrib.dimension} (top: ${contrib.top_contributor} = ${contrib.top_contribution_pct}%)`,
                  data: (contrib.chart_data as { data: Record<string, unknown>[] })?.data || [],
                  xKey: 'category', yKey: 'contribution', yKeys: ['contribution'],
                }} onDrillDown={handleDrill} />
              ))}
            </div>
          </section>
        )}

        {/* Clusters */}
        {analysis.clusters.n_clusters >= 2 && (
          <section>
            <h2 className="text-[14px] font-black text-dl-text-dark uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers size={16} className="text-gray-700" /> Auto-Detected Clusters
            </h2>
            <div className="bg-white border border-dl-border rounded-dl-lg p-4">
              <p className="text-[13px] text-dl-text-dark mb-3">
                Data naturally segments into <b>{analysis.clusters.n_clusters} clusters</b> based on {analysis.clusters.columns_used.join(', ')}.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {analysis.clusters.clusters.map((cl, i) => (
                  <div key={i} className="border border-dl-border rounded-dl-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-dl-text-dark">Cluster {(cl as Record<string, unknown>).cluster as number}</span>
                      <span className="text-dl-xs text-dl-text-light">{(cl as Record<string, unknown>).size as number} rows ({(cl as Record<string, unknown>).pct as number}%)</span>
                    </div>
                    <div className="space-y-1">
                      {analysis.clusters.columns_used.slice(0, 4).map(col => (
                        <div key={col} className="flex justify-between text-dl-xs">
                          <span className="text-dl-text-medium">{col}</span>
                          <span className="font-mono text-dl-text-dark">
                            {typeof (cl as Record<string, unknown>)[`${col}_mean`] === 'number'
                              ? ((cl as Record<string, unknown>)[`${col}_mean`] as number).toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Majority Detections */}
        {analysis.majority.length > 0 && (
          <section>
            <h2 className="text-[14px] font-black text-dl-text-dark uppercase tracking-wider mb-3 flex items-center gap-2">
              <Target size={16} className="text-amber-500" /> Dominant Categories
            </h2>
            <div className="bg-white border border-dl-border rounded-dl-lg overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-dl-border bg-dl-bg-light">
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Dimension</th>
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Measure</th>
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Dominant</th>
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Share</th>
                    <th className="px-4 py-2 text-left text-dl-xs font-bold text-dl-text-light uppercase">Categories</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.majority.slice(0, 8).map((m, i) => (
                    <tr key={i} className="border-b border-dl-border hover:bg-dl-bg-light">
                      <td className="px-4 py-2 text-dl-text-dark">{m.dimension}</td>
                      <td className="px-4 py-2 text-dl-text-medium">{m.measure}</td>
                      <td className="px-4 py-2 font-medium text-dl-brand">{m.dominant_category}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-dl-bg-medium rounded-full overflow-hidden">
                            <div className="h-full bg-dl-brand rounded-full" style={{ width: `${m.dominant_share}%` }} />
                          </div>
                          <span className="text-dl-xs font-mono">{m.dominant_share}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-dl-text-light">{m.total_categories}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        </>)}

        {/* Footer */}
        <div className="text-center py-4 border-t border-dl-border">
          <p className="text-dl-xs text-dl-text-light">
            {t('insights.allComputed')}
          </p>
        </div>
      </div>

      {showDrill && <DrillDownPanel onOpenInStudio={() => router.push(`/projects/${projectId}/studio`)} />}
    </DrillProvider>
  )
}


function InsightCard({ insight, index, onDrill }: { insight: AutoAnalysisInsight; index: number; onDrill: (f: DrillFilter) => void }) {
  const locale = useLocale()
  const t = useTranslations()
  const Icon = INSIGHT_ICONS[insight.type] || Zap
  const colorClass = INSIGHT_COLORS[insight.type] || 'border-dl-border bg-white'

  return (
    <div className={`border rounded-dl-lg p-4 ${colorClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-dl-xs font-black text-dl-text-light">#{index}</span>
          <Icon size={16} className="text-dl-text-medium" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-dl-text-dark leading-relaxed">{translateFinding(insight.headline, locale)}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-dl-xs px-1.5 py-0.5 rounded bg-white/70 text-dl-text-medium font-medium">{t(`insightTypes.${insight.type}` as Parameters<typeof t>[0])}</span>
            <span className="text-dl-xs text-dl-text-light">
              p={insight.p_value < 0.001 ? '<0.001' : insight.p_value.toFixed(4)}
            </span>
            <span className="text-dl-xs text-dl-text-light">
              effect={insight.effect_size.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {/* Inline chart if available — compact height */}
      {insight.chart_data && insight.chart_data.data && insight.chart_data.data.length > 0 && (
        <div className="mt-3 max-h-[240px] overflow-hidden rounded-dl-md border border-white/50">
          <InteractiveChart chart={{
            type: insight.chart_data.chart_type as ChartData['type'],
            title: '',
            data: insight.chart_data.data.slice(0, 15),
            xKey: insight.chart_data.x_key,
            yKey: insight.chart_data.y_keys[0],
            yKeys: insight.chart_data.y_keys,
          }} onDrillDown={onDrill} />
        </div>
      )}
    </div>
  )
}
