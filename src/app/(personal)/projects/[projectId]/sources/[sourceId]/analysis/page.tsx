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

        {/* KPI Cards — each with distinct color tint + icon */}
        {(() => {
          const qualityPct = analysis.row_count > 0 ? Math.max(0, Math.round((1 - analysis.anomalies.reduce((s: number, a: any) => s + (a.outlier_count || 0), 0) / analysis.row_count) * 100)) : 100
          const sigCorr = analysis.correlations.pairs.filter(p => p.significant).length
          const insightCount = analysis.top_insights.length
          const importantCount = analysis.top_insights.filter((i: any) => (i.effect_size || 0) > 0.3).length

          return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Data Volume */}
              <Card className="border-blue-200/50 bg-blue-50/30">
                <CardContent className="pt-5">
                  <div className="text-lg mb-1">📊</div>
                  <div className="text-2xl font-bold">{analysis.row_count.toLocaleString()}</div>
                  <p className="text-sm font-medium mt-1">{locale === 'de' ? 'Datensätze' : 'Records'}</p>
                  <p className="text-xs text-muted-foreground">{analysis.column_count} {locale === 'de' ? 'Spalten' : 'columns'} · {analysis.measures.length} {locale === 'de' ? 'Kennzahlen' : 'measures'}</p>
                </CardContent>
              </Card>

              {/* Quality */}
              <Card className={qualityPct >= 90 ? 'border-emerald-200/50 bg-emerald-50/30' : 'border-amber-200/50 bg-amber-50/30'}>
                <CardContent className="pt-5">
                  <div className="text-lg mb-1">{qualityPct >= 90 ? '✅' : '⚠️'}</div>
                  <div className="text-2xl font-bold">{qualityPct}%</div>
                  <p className="text-sm font-medium mt-1">{locale === 'de' ? 'Datenqualität' : 'Data Quality'}</p>
                  <p className="text-xs text-muted-foreground">
                    {qualityPct >= 90 ? (locale === 'de' ? 'Zuverlässig' : 'Reliable') : (locale === 'de' ? 'Ausreißer prüfen' : 'Check outliers')}
                  </p>
                </CardContent>
              </Card>

              {/* Insights */}
              <Card className="border-violet-200/50 bg-violet-50/30">
                <CardContent className="pt-5">
                  <div className="text-lg mb-1">💡</div>
                  <div className="text-2xl font-bold">{insightCount}</div>
                  <p className="text-sm font-medium mt-1">{locale === 'de' ? 'Erkenntnisse' : 'Findings'}</p>
                  <p className="text-xs text-muted-foreground">{importantCount} {locale === 'de' ? 'wichtig' : 'important'}</p>
                </CardContent>
              </Card>

              {/* Alerts */}
              <Card className={analysis.anomalies.length > 0 ? 'border-amber-200/50 bg-amber-50/30' : 'border-gray-200/50'}>
                <CardContent className="pt-5">
                  <div className="text-lg mb-1">{analysis.anomalies.length > 0 ? '⚠️' : '🔍'}</div>
                  <div className="text-2xl font-bold">{analysis.anomalies.length}</div>
                  <p className="text-sm font-medium mt-1">{locale === 'de' ? 'Ausreißer-Spalten' : 'Outlier Columns'}</p>
                  <p className="text-xs text-muted-foreground">
                    {analysis.anomalies.length > 0
                      ? (locale === 'de' ? 'Prüfung empfohlen' : 'Review recommended')
                      : (locale === 'de' ? 'Keine Auffälligkeiten' : 'No anomalies')
                    }
                  </p>
                </CardContent>
              </Card>
            </div>
          )
        })()}

        {/* Tab Navigation — active tab with background */}
        <div className="flex items-center gap-1 border-b">
          {([
            { id: 'insights' as const, label: locale === 'de' ? 'Erkenntnisse' : 'Findings', count: analysis.top_insights.length },
            { id: 'correlations' as const, label: locale === 'de' ? 'Zusammenhänge' : 'Correlations', count: analysis.correlations.pairs.length },
            { id: 'distributions' as const, label: locale === 'de' ? 'Verteilungen' : 'Distributions', count: analysis.distributions.length },
            { id: 'segments' as const, label: locale === 'de' ? 'Segmente' : 'Segments', count: analysis.segments.length + analysis.key_influencers.length },
            { id: 'advanced' as const, label: locale === 'de' ? 'Erweitert' : 'Advanced', count: analysis.clusters.n_clusters + analysis.contribution_analysis.length + analysis.majority.length },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-foreground text-foreground bg-muted/50 rounded-t-md'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-foreground/10' : 'bg-muted'
                }`}>{tab.count}</span>
              )}
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
        {activeTab === 'distributions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.distributions.slice(0, 6).map((dist, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{dist.column?.replace(/_/g, ' ')}</CardTitle>
                    <span className="text-xs text-muted-foreground">{dist.shape}</span>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <InteractiveChart chart={{
                    type: 'histogram',
                    title: '',
                    data: dist.counts.map((c: number, j: number) => ({
                      bin: Math.round((dist.bins[j] + dist.bins[j + 1]) / 2 * 100) / 100,
                      count: c,
                    })),
                    xKey: 'bin', yKey: 'count', yKeys: ['count'],
                  }} />
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{locale === 'de' ? 'Mittelwert' : 'Mean'}: <span className="font-medium text-foreground">{dist.mean?.toLocaleString()}</span></span>
                    <span>{locale === 'de' ? 'Median' : 'Median'}: <span className="font-medium text-foreground">{dist.median?.toLocaleString()}</span></span>
                    <span>{locale === 'de' ? 'Schiefe' : 'Skew'}: <span className="font-medium text-foreground">{dist.skewness}</span></span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {analysis.distributions.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center col-span-2">
                {locale === 'de' ? 'Keine Verteilungen verfügbar' : 'No distributions available'}
              </p>
            )}
          </div>
        )}

        {/* TAB: Segments & Influencers */}
        {activeTab === 'segments' && (
          <div className="space-y-4">
            {analysis.segments.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.segments.slice(0, 4).map((seg, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {seg.measure?.replace(/_/g, ' ')} {locale === 'de' ? 'nach' : 'by'} {seg.dimension?.replace(/_/g, ' ')}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        p={seg.p_value < 0.001 ? '<0.001' : seg.p_value?.toFixed(3)} · η²={seg.eta_squared?.toFixed(3)}
                      </p>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <InteractiveChart chart={{
                        type: 'bar',
                        title: '',
                        data: seg.groups,
                        xKey: 'group', yKey: 'mean', yKeys: ['mean'],
                        referenceLines: [{
                          value: seg.groups.reduce((sum: number, g: any) => sum + g.mean * g.n, 0) / Math.max(seg.groups.reduce((sum: number, g: any) => sum + g.n, 0), 1),
                          label: locale === 'de' ? 'Durchschnitt' : 'Average', color: '#ef4444',
                        }],
                      }} onDrillDown={handleDrill} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {analysis.key_influencers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {locale === 'de' ? 'Einflussfaktoren' : 'Key Influencers'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.key_influencers.map((inf, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{inf.influencer?.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-muted-foreground">→ {inf.target?.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${inf.type === 'categorical' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {inf.cramers_v ? `V=${inf.cramers_v.toFixed(2)}` : inf.correlation ? `r=${inf.correlation.toFixed(2)}` : inf.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {analysis.segments.length === 0 && analysis.key_influencers.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {locale === 'de' ? 'Keine Segmente oder Einflussfaktoren erkannt' : 'No segments or influencers detected'}
              </p>
            )}
          </div>
        )}

        {/* TAB: Advanced */}
        {activeTab === 'advanced' && (
          <div className="space-y-4">
            {/* Contribution Analysis */}
            {analysis.contribution_analysis.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.contribution_analysis.slice(0, 4).map((contrib, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {contrib.measure?.replace(/_/g, ' ')} {locale === 'de' ? 'nach' : 'by'} {contrib.dimension?.replace(/_/g, ' ')}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {locale === 'de' ? 'Top' : 'Top'}: {contrib.top_contributor} = {contrib.top_contribution_pct}%
                      </p>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <InteractiveChart chart={{
                        type: 'bar',
                        title: '',
                        data: (contrib.chart_data as { data: Record<string, unknown>[] })?.data || [],
                        xKey: 'category', yKey: 'contribution', yKeys: ['contribution'],
                      }} onDrillDown={handleDrill} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Clusters */}
            {analysis.clusters.n_clusters >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {locale === 'de' ? 'Automatisch erkannte Segmente' : 'Auto-Detected Segments'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {analysis.clusters.n_clusters} {locale === 'de' ? 'Cluster basierend auf' : 'clusters based on'} {analysis.clusters.columns_used?.join(', ')}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {analysis.clusters.clusters?.map((cl: any, i: number) => (
                      <div key={i} className="rounded-md border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Cluster {cl.cluster}</span>
                          <span className="text-xs text-muted-foreground">{cl.size} ({cl.pct}%)</span>
                        </div>
                        <div className="space-y-1">
                          {analysis.clusters.columns_used?.slice(0, 4).map((col: string) => (
                            <div key={col} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{col?.replace(/_/g, ' ')}</span>
                              <span className="font-medium tabular-nums">
                                {typeof cl[`${col}_mean`] === 'number' ? cl[`${col}_mean`].toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dominant Categories */}
            {analysis.majority.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {locale === 'de' ? 'Dominante Kategorien' : 'Dominant Categories'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.majority.slice(0, 8).map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{m.dominant_category}</span>
                          <span className="text-xs text-muted-foreground">{m.measure?.replace(/_/g, ' ')} {locale === 'de' ? 'nach' : 'by'} {m.dimension?.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-foreground/70 rounded-full" style={{ width: `${m.dominant_share}%` }} />
                          </div>
                          <span className="text-xs font-medium tabular-nums w-10 text-right">{m.dominant_share}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {analysis.contribution_analysis.length === 0 && analysis.clusters.n_clusters < 2 && analysis.majority.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {locale === 'de' ? 'Keine erweiterten Analysen verfügbar' : 'No advanced analyses available'}
              </p>
            )}
          </div>
        )}

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
  const de = locale === 'de'
  const router = useRouter()

  const es = insight.effect_size || 0
  const isAnomaly = insight.type === 'anomaly' || insight.type === 'outlier_explanation'
  const severity = isAnomaly || es > 0.6 ? 'critical' : es > 0.3 ? 'warning' : es > 0.1 ? 'info' : 'positive'

  const config = {
    critical: { border: 'border-l-red-500', icon: '🔴', bg: 'bg-red-50/40' },
    warning: { border: 'border-l-amber-500', icon: '⚠️', bg: 'bg-amber-50/40' },
    info: { border: 'border-l-blue-500', icon: 'ℹ️', bg: 'bg-blue-50/30' },
    positive: { border: 'border-l-emerald-500', icon: '✅', bg: 'bg-emerald-50/30' },
  }[severity]

  return (
    <Card className={`border-l-[4px] ${config.border} ${config.bg}`}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-sm mt-0.5 flex-shrink-0">{config.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-relaxed">
                {translateFinding(insight.headline, locale)}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (insight.chart_data?.data?.length) {
                onDrill({ column: insight.columns?.[0] || '', value: '', operator: 'eq', label: insight.headline || '' })
              }
            }}
            className="text-xs font-medium text-muted-foreground hover:text-foreground border rounded-md px-2.5 py-1 hover:bg-accent transition flex-shrink-0"
          >
            {de ? 'Details' : 'Details'} →
          </button>
        </div>

        {/* Inline chart */}
        {insight.chart_data && insight.chart_data.data && insight.chart_data.data.length > 0 && (
          <div className="mt-3 max-h-[200px] overflow-hidden rounded-md border bg-card">
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
      </CardContent>
    </Card>
  )
}
