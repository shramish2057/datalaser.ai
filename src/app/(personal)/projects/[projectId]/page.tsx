'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { normalizeInsights } from '@/lib/normalizeInsight'
import {
  Database, BarChart2, MessageSquare, FlaskConical,
  AlertTriangle, DollarSign, Activity, Layers, Bell
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { useTranslations, useLocale } from 'next-intl'
import { translateFinding } from '@/lib/i18n/findingsMap'
import { useProjectContext } from '@/lib/hooks/useProjectContext'
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
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

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
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
        .eq('project_id', projectId).eq('status', 'active')
        .order('created_at', { ascending: false })
      setSources(srcs || [])
      const { count } = await supabase
        .from('anomalies').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).eq('is_read', false)
      setAlertCount(count ?? 0)
      setLoading(false)
    }
    load()
  }, [projectId])

  const { totalRecords, qualityScore, topTrend, topInsights, chartData } = useMemo(() => {
    const allA = sources.map(s => s.auto_analysis).filter((a): a is Record<string, unknown> => a !== null)
    const trends = allA.flatMap(a => (a.trends as any[]) || [])
    const insights = allA.flatMap(a => normalizeInsights((a.top_insights as any[]) || []) as any[])
      .sort((a, b) => (b.effect_size || 0) - (a.effect_size || 0))
    const anomalies = allA.flatMap(a => (a.anomalies as any[]) || [])
    const totalOut = anomalies.reduce((s: number, a: any) => s + (a.outlier_count || 0), 0)
    const totalR = sources.reduce((s, src) => s + (src.row_count || 0), 0)
    const q = totalR > 0 ? Math.max(0, Math.round((1 - totalOut / totalR) * 100)) : 100
    const sorted = [...trends].sort((a, b) => Math.abs(b.total_change_pct || 0) - Math.abs(a.total_change_pct || 0))
    const top = sorted[0] || null

    // Build chart data from distributions or trends
    let cd: { name: string; value: number }[] = []
    if (top?.chart_data?.data) {
      cd = (top.chart_data.data as any[]).slice(-12).map((d: any, i: number) => ({
        name: d.label || d.bin || `${i + 1}`,
        value: d.count || d.value || d.mean || 0,
      }))
    } else {
      const dists = allA.flatMap(a => (a.distributions as any[]) || [])
      if (dists[0]?.counts) {
        cd = (dists[0].counts as number[]).slice(0, 10).map((v: number, i: number) => ({
          name: `${i + 1}`,
          value: v,
        }))
      }
    }

    return { totalRecords: totalR, qualityScore: q, topTrend: top, topInsights: insights.slice(0, 5), chartData: cd }
  }, [sources])

  const trendPct = topTrend?.total_change_pct || 0
  const trendUp = trendPct > 0
  const trendColor = trendUp ? 'text-emerald-600' : trendPct < 0 ? 'text-red-600' : 'text-muted-foreground'

  if (loading) return null

  const hasSources = sources.length > 0

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {project && <ProjectIconBadge icon={project.icon} color={project.color} size="lg" />}
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{project?.name}</h2>
            {project?.description && (
              <p className="text-muted-foreground text-sm">{project.description}</p>
            )}
          </div>
        </div>
        {hasSources && (
          <button onClick={() => router.push(`${basePath}/sources/new`)} className="dl-btn-primary text-sm">
            {t('home.addSource')}
          </button>
        )}
      </div>

      {/* Alert banner */}
      {alertCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium">{t('alerts.issuesDetected', { count: alertCount })}</span>
          <Link href={`${basePath}/alerts`} className="ml-auto text-xs font-semibold text-amber-700 hover:underline">
            {t('alerts.viewAlerts')} →
          </Link>
        </div>
      )}

      {/* Empty state */}
      {!hasSources && (
        <Card className="p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('home.connectFirst')}</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">{t('home.connectFirstDesc')}</p>
          <button onClick={() => router.push(`${basePath}/sources/new`)} className="dl-btn-primary">
            {t('home.addSource')} →
          </button>
        </Card>
      )}

      {hasSources && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {locale === 'de' ? 'Datensätze' : 'Total Records'}
                </CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(totalRecords)}</div>
                <p className="text-xs text-muted-foreground">
                  {sources.length} {locale === 'de' ? 'Datenquellen verbunden' : 'sources connected'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {locale === 'de' ? 'Datenqualität' : 'Data Quality'}
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{qualityScore}%</div>
                <p className="text-xs text-muted-foreground">
                  {qualityScore >= 90
                    ? (locale === 'de' ? 'Zuverlässig — bereit für Analyse' : 'Reliable — ready for analysis')
                    : (locale === 'de' ? 'Einige Ausreißer erkannt' : 'Some outliers detected')
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {locale === 'de' ? 'Stärkster Trend' : 'Top Trend'}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {topTrend ? `${trendUp ? '+' : ''}${trendPct.toFixed(1)}%` : '—'}
                </div>
                <p className={`text-xs ${trendColor}`}>
                  {topTrend
                    ? `${topTrend.measure_column?.replace(/_/g, ' ')} ${locale === 'de' ? 'über den Zeitraum' : 'over the period'}`
                    : (locale === 'de' ? 'Keine Zeitreihe verfügbar' : 'No time series available')
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {locale === 'de' ? 'Warnungen' : 'Alerts'}
                </CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alertCount}</div>
                <p className="text-xs text-muted-foreground">
                  {alertCount === 0
                    ? (locale === 'de' ? 'Keine offenen Warnungen' : 'No open alerts')
                    : (locale === 'de' ? 'Erfordern Aufmerksamkeit' : 'Require attention')
                  }
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Chart + Findings ── */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Chart */}
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {topTrend
                    ? `${topTrend.measure_column?.replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase())} ${locale === 'de' ? 'Verlauf' : 'Overview'}`
                    : (locale === 'de' ? 'Datenverteilung' : 'Data Distribution')
                  }
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={trendUp ? '#10b981' : '#6366f1'} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={trendUp ? '#10b981' : '#6366f1'} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={trendUp ? '#10b981' : '#6366f1'}
                        strokeWidth={2}
                        fill="url(#fillGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                    {locale === 'de' ? 'Analyse starten für Visualisierung' : 'Run analysis for visualization'}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Findings */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {locale === 'de' ? 'Wichtigste Erkenntnisse' : 'Top Findings'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topInsights.length > 0 ? topInsights.map((ins: any, i: number) => {
                    const isHigh = (ins.effect_size || 0) > 0.5
                    const isMed = (ins.effect_size || 0) > 0.2
                    const dotColor = isHigh ? 'bg-red-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500'
                    return (
                      <button key={i} onClick={() => router.push(`${basePath}/insights`)}
                        className="flex items-start gap-3 w-full text-left group"
                      >
                        <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed group-hover:text-foreground transition line-clamp-2">
                            {translateFinding(ins.headline || '', locale)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ins.type?.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </button>
                    )
                  }) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {locale === 'de' ? 'Analyse starten für Erkenntnisse' : 'Run analysis for findings'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Quick Actions ── */}
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { icon: Database, label: t('home.addSource'), href: `${basePath}/sources/new` },
              { icon: BarChart2, label: t('home.viewInsights'), href: `${basePath}/insights` },
              { icon: MessageSquare, label: t('home.askData'), href: `${basePath}/ask` },
              { icon: FlaskConical, label: t('home.openStudio'), href: `${basePath}/studio` },
            ].map(a => (
              <button key={a.label} onClick={() => router.push(a.href)}
                className="flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-accent transition-colors text-left"
              >
                <a.icon className="h-4 w-4 text-muted-foreground" />
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
