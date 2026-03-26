'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProjectContext } from '@/lib/hooks/useProjectContext'
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
import { DataSourceSelector } from '@/components/DataSourceSelector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  const locale = useLocale()
  const params = useParams()
  const router = useRouter()
  const { projectId, basePath } = useProjectContext()
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
          .from('data_sources').select('name, file_path, source_type, auto_analysis, row_count, schema_snapshot')
          .eq('id', sourceId).single()
        if (!src) { setError('Source not found'); setLoading(false); return }
        setSourceName(src.name)

        // If auto_analysis already cached, use it (with safe defaults for missing fields)
        if (src.auto_analysis) {
          const raw = src.auto_analysis as Record<string, unknown>
          const safe: AutoAnalysisResult = {
            row_count: (raw.row_count as number) || src.row_count || 0,
            column_count: (raw.column_count as number) || 0,
            measures: (raw.measures as string[]) || [],
            dimensions: (raw.dimensions as string[]) || [],
            binaries: (raw.binaries as string[]) || [],
            dates: (raw.dates as string[]) || [],
            top_insights: (raw.top_insights as AutoAnalysisResult['top_insights']) || [],
            correlations: (raw.correlations as AutoAnalysisResult['correlations']) || { matrix: [], columns: [], pairs: [] },
            distributions: (raw.distributions as AutoAnalysisResult['distributions']) || [],
            segments: (raw.segments as AutoAnalysisResult['segments']) || [],
            clusters: (raw.clusters as AutoAnalysisResult['clusters']) || { n_clusters: 0 },
            anomalies: (raw.anomalies as AutoAnalysisResult['anomalies']) || [],
            key_influencers: (raw.key_influencers as AutoAnalysisResult['key_influencers']) || [],
            contribution_analysis: (raw.contribution_analysis as AutoAnalysisResult['contribution_analysis']) || [],
            majority: (raw.majority as AutoAnalysisResult['majority']) || [],
          } as AutoAnalysisResult
          setAnalysis(safe)
          setLoading(false)
          return
        }

        // For DB sources without cached analysis, run full auto-analysis on live DB
        if (isDbSource(src.source_type) && !src.auto_analysis) {
          try {
            const schema = src.schema_snapshot as { tables?: { name: string }[] } | null
            const firstTable = schema?.tables?.[0]?.name
            const res = await fetch('/api/pipeline/auto-analysis-db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source_id: sourceId, table_name: firstTable }),
            })
            const data = await res.json()
            if (!data.error) {
              setAnalysis(data as AutoAnalysisResult)
              // Cache for next time
              await supabase.from('data_sources').update({
                auto_analysis: data,
                analysis_status: 'complete',
                analyzed_at: new Date().toISOString(),
              }).eq('id', sourceId)
            } else {
              setError(data.error || data.detail || 'Auto-analysis failed')
            }
          } catch (e: any) {
            setError(e.message || 'Auto-analysis failed')
          }
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
      <div className="flex-1 space-y-4 p-8 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('insights.title')}</h2>
            <p className="text-muted-foreground text-sm">
              {sourceName} — {analysis.row_count?.toLocaleString()} {locale === 'de' ? 'Zeilen' : 'rows'}, {analysis.column_count} {locale === 'de' ? 'Spalten' : 'columns'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DataSourceSelector />
            <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium">
              {analysis.top_insights.length} {locale === 'de' ? 'Erkenntnisse' : 'findings'}
            </span>
          </div>
        </div>

        {/* KPI Row — shadcn dashboard pattern */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('common.rows')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.row_count.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{analysis.column_count} {t('common.columns').toLowerCase()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analysis.measures')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.measures.length}</div>
              <p className="text-xs text-muted-foreground">{analysis.dimensions?.length || 0} {locale === 'de' ? 'Dimensionen' : 'dimensions'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analysis.sigCorrelations')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.correlations.pairs.filter(p => p.significant).length}</div>
              <p className="text-xs text-muted-foreground">{locale === 'de' ? 'von' : 'of'} {analysis.correlations.pairs.length} {locale === 'de' ? 'Paaren' : 'pairs'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analysis.outlierColumns')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.anomalies.length}</div>
              <p className="text-xs text-muted-foreground">{locale === 'de' ? 'Spalten mit Ausreißern' : 'columns with outliers'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analysis.clustersFound')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.clusters.n_clusters}</div>
              <p className="text-xs text-muted-foreground">{locale === 'de' ? 'Segmente erkannt' : 'segments detected'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation — clean, minimal */}
        <div className="flex items-center gap-1 border-b">
          {([
            { id: 'insights' as const, label: t('analysis.topInsights'), count: analysis.top_insights.length },
            { id: 'correlations' as const, label: t('analysis.correlationMatrix'), count: analysis.correlations.pairs.length },
            { id: 'distributions' as const, label: t('analysis.distributions'), count: analysis.distributions.length },
            { id: 'segments' as const, label: t('analysis.segmentsInfluencers'), count: analysis.segments.length + analysis.key_influencers.length },
            { id: 'advanced' as const, label: t('analysis.advanced'), count: analysis.clusters.n_clusters + analysis.contribution_analysis.length + analysis.majority.length },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
              {tab.count > 0 && <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>}
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
        {activeTab === 'correlations' && (
          <div className="space-y-4">
            {analysis.correlations.columns.length >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t('analysis.correlationMatrix')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <HeatmapChart
                    matrix={analysis.correlations.matrix}
                    columns={analysis.correlations.columns}
                    title=""
                  />
                </CardContent>
              </Card>
            )}

            {analysis.correlations.pairs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {locale === 'de' ? 'Stärkste Korrelationen' : 'Strongest Correlations'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.correlations.pairs.slice(0, 8).map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${p.significant ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          <span className="text-sm font-medium">{p.col1} ↔ {p.col2}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm tabular-nums text-muted-foreground">r={p.r}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${p.significant ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                            {t(`strength.${p.strength}` as Parameters<typeof t>[0])}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

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

      {showDrill && <DrillDownPanel onOpenInStudio={() => router.push(`${basePath}/studio`)} />}
    </DrillProvider>
  )
}


function InsightCard({ insight, index, onDrill }: { insight: AutoAnalysisInsight; index: number; onDrill: (f: DrillFilter) => void }) {
  const locale = useLocale()
  const t = useTranslations()

  // Severity from effect size — not type-based rainbow
  const es = insight.effect_size || 0
  const isAnomaly = insight.type === 'anomaly' || insight.type === 'outlier_explanation'
  const severity = isAnomaly || es > 0.6 ? 'critical' : es > 0.3 ? 'warning' : es > 0.1 ? 'info' : 'neutral'
  const borderColor = severity === 'critical' ? 'border-l-red-500' : severity === 'warning' ? 'border-l-amber-500' : severity === 'info' ? 'border-l-blue-500' : 'border-l-transparent'
  const dotColor = severity === 'critical' ? 'bg-red-500' : severity === 'warning' ? 'bg-amber-500' : severity === 'info' ? 'bg-blue-500' : 'bg-gray-300'
  const tagBg = severity === 'critical' ? 'bg-red-50 text-red-700' : severity === 'warning' ? 'bg-amber-50 text-amber-700' : severity === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'

  return (
    <div className={`rounded-lg border border-l-[3px] ${borderColor} bg-card p-4`}>
      <div className="flex items-start gap-3">
        <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${dotColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed">{translateFinding(insight.headline, locale)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tagBg}`}>
              {insight.type?.replace(/_/g, ' ')}
            </span>
            {insight.p_value != null && insight.p_value < 0.05 && (
              <span className="text-[10px] text-muted-foreground">
                p{insight.p_value < 0.001 ? '<0.001' : `=${insight.p_value.toFixed(3)}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Inline chart if available */}
      {insight.chart_data && insight.chart_data.data && insight.chart_data.data.length > 0 && (
        <div className="mt-3 max-h-[220px] overflow-hidden rounded-md border">
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
