'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { normalizeInsights } from '@/lib/normalizeInsight'
import {
  Database, BarChart2, MessageSquare, FlaskConical, ArrowRight,
  AlertTriangle, Shield, Layers, TrendingUp, Zap, GitBranch, Target, Search
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { useTranslations, useLocale } from 'next-intl'
import { translateFinding } from '@/lib/i18n/findingsMap'
import { useProjectContext } from '@/lib/hooks/useProjectContext'
import type { Project } from '@/types/database'

interface SourceData {
  id: string
  name: string
  source_type: string
  row_count: number
  status: string
  pipeline_status: string | null
  auto_analysis: Record<string, unknown> | null
  analyzed_at: string | null
}

function smartFormat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (n % 1 !== 0) return n.toFixed(1)
  return n.toLocaleString()
}

export default function ProjectHomePage() {
  const t = useTranslations()
  const locale = useLocale()
  const [project, setProject] = useState<Project | null>(null)
  const [sources, setSources] = useState<SourceData[]>([])
  const [alertCount, setAlertCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { projectId, basePath } = useProjectContext()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: proj } = await supabase
        .from('projects').select('*').eq('id', projectId).single()
      setProject(proj)

      const { data: srcs } = await supabase
        .from('data_sources')
        .select('id, name, source_type, row_count, status, auto_analysis, pipeline_status, analyzed_at')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      setSources(srcs || [])

      const { count } = await supabase
        .from('anomalies')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('is_read', false)
      setAlertCount(count ?? 0)

      setLoading(false)
    }
    load()
  }, [projectId])

  // Aggregate auto_analysis across sources
  const { topTrend, topInsights, totalRecords, qualityScore, chartPoints, topDimension } = useMemo(() => {
    const allAnalysis = sources.map(s => s.auto_analysis).filter((a): a is Record<string, unknown> => a !== null)
    const trends = allAnalysis.flatMap(a => (a.trends as any[]) || [])
    const insights = allAnalysis.flatMap(a => {
      const raw = (a.top_insights as any[]) || []
      return normalizeInsights(raw) as any[]
    }).sort((a, b) => (b.effect_size || 0) - (a.effect_size || 0))
    const majority = allAnalysis.flatMap(a => (a.majority as any[]) || [])
    const distributions = allAnalysis.flatMap(a => (a.distributions as any[]) || [])

    // Top trend (highest absolute change)
    const sorted = [...trends].sort((a, b) => Math.abs(b.total_change_pct || 0) - Math.abs(a.total_change_pct || 0))
    const topT = sorted[0] || null

    // Quality from distributions
    const anomalies = allAnalysis.flatMap(a => (a.anomalies as any[]) || [])
    const totalOutliers = anomalies.reduce((s: number, a: any) => s + (a.outlier_count || 0), 0)
    const totalRows = sources.reduce((s, src) => s + (src.row_count || 0), 0)
    const quality = totalRows > 0 ? Math.max(0, Math.round((1 - totalOutliers / totalRows) * 100)) : 100

    // Chart points from top trend
    let points: number[] = []
    if (topT?.chart_data?.data) {
      points = (topT.chart_data.data as any[]).map((d: any) => d.count || d.value || d.mean || 0).slice(-20)
    } else if (distributions[0]?.counts) {
      points = distributions[0].counts.slice(0, 15)
    }

    // Top dimension breakdown
    const topDim = majority[0] || null

    return {
      topTrend: topT,
      topInsights: insights.slice(0, 3),
      totalRecords: totalRows,
      qualityScore: quality,
      chartPoints: points,
      topDimension: topDim,
    }
  }, [sources])

  if (loading) return null

  const hasSources = sources.length > 0
  const trendPct = topTrend?.total_change_pct || 0
  const trendUp = trendPct > 0
  const trendLabel = topTrend?.measure_column?.replace(/_/g, ' ') || ''

  // Generate SVG chart path from data points
  const chartPath = useMemo(() => {
    if (chartPoints.length < 2) return ''
    const max = Math.max(...chartPoints, 1)
    const w = 386
    const h = 60
    const padY = 5
    const step = w / (chartPoints.length - 1)
    return chartPoints.map((v, i) => {
      const x = i * step
      const y = h - padY - (v / max) * (h - padY * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }, [chartPoints])

  const chartFillPath = chartPath ? `${chartPath} L386 65 L0 65 Z` : ''

  return (
    <div className="py-10 md:py-16">
      <div className="mx-auto max-w-3xl lg:max-w-5xl px-6">

        {/* Alert banner */}
        {alertCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-500" size={18} />
              <span className="text-sm font-medium text-gray-900">
                {t('alerts.issuesDetected', { count: alertCount })}
              </span>
            </div>
            <Link href={`${basePath}/alerts`} className="text-xs font-semibold text-amber-700 hover:text-amber-900 transition">
              {t('alerts.viewAlerts')} →
            </Link>
          </div>
        )}

        {/* Project header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            {project && <ProjectIconBadge icon={project.icon} color={project.color} size="lg" />}
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{project?.name}</h1>
          </div>
          {project?.description && (
            <p className="text-gray-500 text-sm ml-[52px]">{project.description}</p>
          )}
        </div>

        {/* Empty state */}
        {!hasSources && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border">
              <Database size={26} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('home.connectFirst')}</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">{t('home.connectFirstDesc')}</p>
            <button onClick={() => router.push(`${basePath}/sources/new`)} className="dl-btn-primary px-6 py-2.5 font-bold">
              {t('home.addSource')} →
            </button>
          </div>
        )}

        {/* ═══ FEATURES-8 INTELLIGENCE GRID ═══ */}
        {hasSources && (
          <div className="relative">
            <div className="relative z-10 grid grid-cols-6 gap-3">

              {/* ─── CARD 1: Top Metric (big number + SVG blob) ─── */}
              <Card className="relative col-span-full flex overflow-hidden lg:col-span-2">
                <CardContent className="relative m-auto size-fit pt-6">
                  <div className="relative flex h-24 w-56 items-center">
                    <svg className="text-muted absolute inset-0 size-full" viewBox="0 0 254 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M112.891 97.7022C140.366 97.0802 171.004 94.6715 201.087 87.5116C210.43 85.2881 219.615 82.6412 228.284 78.2473C232.198 76.3179 235.905 73.9942 239.348 71.3124C241.85 69.2557 243.954 66.7571 245.555 63.9408C249.34 57.3235 248.281 50.5341 242.498 45.6109C239.033 42.7237 235.228 40.2703 231.169 38.3054C219.443 32.7209 207.141 28.4382 194.482 25.534C184.013 23.1927 173.358 21.7755 162.64 21.2989C161.376 21.3512 160.113 21.181 158.908 20.796C158.034 20.399 156.857 19.1682 156.962 18.4535C157.115 17.8927 157.381 17.3689 157.743 16.9139C158.104 16.4588 158.555 16.0821 159.067 15.8066C160.14 15.4683 161.274 15.3733 162.389 15.5286C179.805 15.3566 196.626 18.8373 212.998 24.462C220.978 27.2494 228.798 30.4747 236.423 34.1232C240.476 36.1159 244.202 38.7131 247.474 41.8258C254.342 48.2578 255.745 56.9397 251.841 65.4892C249.793 69.8582 246.736 73.6777 242.921 76.6327C236.224 82.0192 228.522 85.4602 220.502 88.2924C205.017 93.7847 188.964 96.9081 172.738 99.2109C153.442 101.949 133.993 103.478 114.506 103.79C91.1468 104.161 67.9334 102.97 45.1169 97.5831C36.0094 95.5616 27.2626 92.1655 19.1771 87.5116C13.839 84.5746 9.1557 80.5802 5.41318 75.7725C-0.54238 67.7259 -1.13794 59.1763 3.25594 50.2827C5.82447 45.3918 9.29572 41.0315 13.4863 37.4319C24.2989 27.5721 37.0438 20.9681 50.5431 15.7272C68.1451 8.8849 86.4883 5.1395 105.175 2.83669C129.045 0.0992292 153.151 0.134761 177.013 2.94256C197.672 5.23215 218.04 9.01724 237.588 16.3889C240.089 17.3418 242.498 18.5197 244.933 19.6446C246.627 20.4387 247.725 21.6695 246.997 23.615C246.455 25.1105 244.814 25.5605 242.63 24.5811C230.322 18.9961 217.233 16.1904 204.117 13.4376C188.761 10.3438 173.2 8.36665 157.558 7.52174C129.914 5.70776 102.154 8.06792 75.2124 14.5228C60.6177 17.8788 46.5758 23.2977 33.5102 30.6161C26.6595 34.3329 20.4123 39.0673 14.9818 44.658C12.9433 46.8071 11.1336 49.1622 9.58207 51.6855C4.87056 59.5336 5.61172 67.2494 11.9246 73.7608C15.2064 77.0494 18.8775 79.925 22.8564 82.3236C31.6176 87.7101 41.3848 90.5291 51.3902 92.5804C70.6068 96.5773 90.0219 97.7419 112.891 97.7022Z" fill="currentColor" />
                    </svg>
                    <span className="mx-auto block w-fit text-5xl font-semibold tabular-nums">
                      {topTrend ? smartFormat(Math.abs(trendPct)) + '%' : smartFormat(totalRecords)}
                    </span>
                  </div>
                  <h2 className="mt-6 text-center text-3xl font-semibold">
                    {topTrend ? (trendUp ? '↑' : '↓') : ''} {trendLabel || (locale === 'de' ? 'Datensätze' : 'Records')}
                  </h2>
                </CardContent>
              </Card>

              {/* ─── CARD 2: Data Quality (fingerprint SVG + score ring) ─── */}
              <Card className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
                <CardContent className="pt-6">
                  <div className="relative mx-auto flex aspect-square size-32 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                    <span className={`m-auto text-4xl font-bold tabular-nums ${qualityScore >= 90 ? 'text-emerald-600' : qualityScore >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {qualityScore}%
                    </span>
                  </div>
                  <div className="relative z-10 mt-6 space-y-2 text-center">
                    <h2 className="text-lg font-medium text-zinc-800 transition">{locale === 'de' ? 'Datenqualität' : 'Data Quality'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {sources.length} {locale === 'de' ? 'Quellen' : 'sources'} · {smartFormat(totalRecords)} {locale === 'de' ? 'Datensätze' : 'records'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* ─── CARD 3: Trend Chart (SVG area + gradient) ─── */}
              <Card className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
                <CardContent className="pt-6">
                  <div className="pt-6 lg:px-2">
                    <svg className="w-full" viewBox="0 0 386 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="70" gradientUnits="userSpaceOnUse">
                          <stop stopColor={trendUp ? '#10b981' : '#ef4444'} stopOpacity="0.2" />
                          <stop offset="1" stopColor={trendUp ? '#10b981' : '#ef4444'} stopOpacity="0.01" />
                        </linearGradient>
                      </defs>
                      {chartFillPath && <path d={chartFillPath} fill="url(#trendGrad)" />}
                      {chartPath && <path d={chartPath} stroke={trendUp ? '#10b981' : '#ef4444'} strokeWidth="2.5" fill="none" />}
                      {!chartPath && (
                        <path d="M0 35 L386 35" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4 4" />
                      )}
                    </svg>
                  </div>
                  <div className="relative z-10 mt-8 space-y-2 text-center">
                    <h2 className="text-lg font-medium transition">
                      {topTrend?.measure_column?.replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase()) || (locale === 'de' ? 'Trend' : 'Trend')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {topTrend
                        ? `${trendUp ? '+' : ''}${trendPct.toFixed(1)}% ${locale === 'de' ? 'Veränderung' : 'change'} · R²=${(topTrend.r_squared || 0).toFixed(2)}`
                        : (locale === 'de' ? 'Keine Trenddaten verfügbar' : 'No trend data available')
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* ─── CARD 4: Top Findings (icon left + chart panel right) ─── */}
              <Card className="relative col-span-full overflow-hidden lg:col-span-3">
                <CardContent className="grid pt-6 sm:grid-cols-2">
                  <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6">
                    <div className="relative flex aspect-square size-12 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                      <Zap className="m-auto size-5" strokeWidth={1} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-medium text-zinc-800 transition">{locale === 'de' ? 'Wichtigste Erkenntnisse' : 'Top Findings'}</h2>
                      <p className="text-sm text-muted-foreground">
                        {topInsights.length > 0
                          ? (locale === 'de' ? `${topInsights.length} verifizierte Erkenntnisse` : `${topInsights.length} verified findings`)
                          : (locale === 'de' ? 'Analyse starten für Erkenntnisse' : 'Run analysis for findings')
                        }
                      </p>
                    </div>
                  </div>
                  <div className="rounded-tl-lg relative -mb-6 -mr-6 mt-6 h-fit border-l border-t p-5 py-5 sm:ml-6">
                    <div className="absolute left-3 top-2 flex gap-1">
                      <span className="block size-2 rounded-full border bg-red-200/60" />
                      <span className="block size-2 rounded-full border bg-amber-200/60" />
                      <span className="block size-2 rounded-full border bg-emerald-200/60" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {topInsights.length > 0 ? topInsights.map((ins: any, i: number) => {
                        const severity = (ins.effect_size || 0) > 0.5 ? 'text-red-600' : (ins.effect_size || 0) > 0.2 ? 'text-amber-600' : 'text-blue-600'
                        return (
                          <button key={i} onClick={() => router.push(`${basePath}/insights`)} className="block w-full text-left group">
                            <p className="text-xs leading-relaxed text-muted-foreground group-hover:text-foreground transition line-clamp-2">
                              <span className={`font-bold ${severity}`}>#{i + 1}</span>{' '}
                              {translateFinding(ins.headline || '', locale)}
                            </p>
                          </button>
                        )
                      }) : (
                        <p className="text-xs text-muted-foreground italic">
                          {locale === 'de' ? 'Noch keine Erkenntnisse' : 'No findings yet'}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ─── CARD 5: Data Overview (stats left + source indicators right) ─── */}
              <Card className="relative col-span-full overflow-hidden lg:col-span-3">
                <CardContent className="grid h-full pt-6 sm:grid-cols-2">
                  <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6">
                    <div className="relative flex aspect-square size-12 rounded-full border before:absolute before:-inset-2 before:rounded-full before:border dark:border-white/10 dark:before:border-white/5">
                      <Database className="m-auto size-5" strokeWidth={1} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-medium text-zinc-800 transition">{locale === 'de' ? 'Datenübersicht' : 'Data Overview'}</h2>
                      <p className="text-sm text-muted-foreground">
                        {smartFormat(totalRecords)} {locale === 'de' ? 'Datensätze aus' : 'records across'} {sources.length} {locale === 'de' ? 'Quellen' : 'sources'}
                      </p>
                    </div>
                  </div>
                  <div className="before:bg-border relative mt-6 before:absolute before:inset-0 before:mx-auto before:w-px sm:-my-6 sm:-mr-6">
                    <div className="relative flex h-full flex-col justify-center space-y-4 py-6">
                      {sources.slice(0, 3).map((src, i) => {
                        const isLeft = i % 2 === 0
                        return isLeft ? (
                          <div key={src.id} className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
                            <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm truncate max-w-[120px]">{src.name}</span>
                            <div className={`ring-background size-7 ring-4 rounded-full flex items-center justify-center text-[10px] font-bold ${src.source_type === 'postgres' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {src.source_type === 'postgres' ? 'PG' : src.source_type.slice(0, 2).toUpperCase()}
                            </div>
                          </div>
                        ) : (
                          <div key={src.id} className="relative ml-[calc(50%-1rem)] flex items-center gap-2">
                            <div className={`ring-background size-7 ring-4 rounded-full flex items-center justify-center text-[10px] font-bold ${src.source_type === 'postgres' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                              {src.source_type === 'postgres' ? 'PG' : src.source_type.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm truncate max-w-[120px]">{src.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        )}

        {/* Quick Actions */}
        {hasSources && (
          <section className="mt-10">
            <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{t('home.quickActions')}</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Database, label: t('home.addSource'), desc: t('home.addSourceDesc'), href: `${basePath}/sources/new` },
                { icon: BarChart2, label: t('home.viewInsights'), desc: t('home.viewInsightsDesc'), href: `${basePath}/insights` },
                { icon: MessageSquare, label: t('home.askData'), desc: t('home.askDataDesc'), href: `${basePath}/ask` },
                { icon: FlaskConical, label: t('home.openStudio'), desc: t('home.openStudioDesc'), href: `${basePath}/studio` },
              ].map(action => (
                <button key={action.label} onClick={() => router.push(action.href)}
                  className="text-left p-3.5 rounded-xl border hover:border-zinc-300 hover:shadow-sm transition-all flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center border group-hover:bg-zinc-900 group-hover:border-zinc-900 transition-colors flex-shrink-0">
                    <action.icon size={16} className="text-muted-foreground group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 mb-0.5">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
