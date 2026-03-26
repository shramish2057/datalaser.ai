'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { normalizeInsights } from '@/lib/normalizeInsight'
import {
  Database, BarChart2, MessageSquare, FlaskConical,
  AlertTriangle, ArrowRight, CheckCircle2, AlertCircle, Info
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

function fmt(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (n % 1 !== 0) return n.toFixed(1)
  return n.toLocaleString()
}

function timeAgo(dateStr: string | null, locale: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return locale === 'de' ? `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}` : `${days} ${days === 1 ? 'day' : 'days'} ago`
  if (hrs > 0) return locale === 'de' ? `vor ${hrs} ${hrs === 1 ? 'Stunde' : 'Stunden'}` : `${hrs}h ago`
  return locale === 'de' ? `vor ${mins} Minuten` : `${mins}m ago`
}

export default function ProjectHomePage() {
  const t = useTranslations()
  const locale = useLocale()
  const de = locale === 'de'
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

  const { totalRecords, trends, insights, healthStatus, healthMessage, lastAnalyzed, kpis } = useMemo(() => {
    const allA = sources.map(s => s.auto_analysis).filter((a): a is Record<string, unknown> => a !== null)
    const tr = allA.flatMap(a => (a.trends as any[]) || [])
    const ins = allA.flatMap(a => normalizeInsights((a.top_insights as any[]) || []) as any[])
      .sort((a, b) => (b.effect_size || 0) - (a.effect_size || 0))
    const anomalies = allA.flatMap(a => (a.anomalies as any[]) || [])
    const totalOut = anomalies.reduce((s: number, a: any) => s + (a.outlier_count || 0), 0)
    const totalR = sources.reduce((s, src) => s + (src.row_count || 0), 0)
    const quality = totalR > 0 ? Math.max(0, Math.round((1 - totalOut / totalR) * 100)) : 100

    // Health status: based on alerts, anomalies, quality
    const hasCritical = ins.some((i: any) => i.type === 'anomaly' || (i.effect_size || 0) > 0.6)
    const hasWarning = alertCount > 0 || ins.some((i: any) => (i.effect_size || 0) > 0.3)
    const status: 'ok' | 'warning' | 'critical' = hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok'

    const msg = status === 'ok'
      ? (de ? 'Alles in Ordnung. Keine kritischen Abweichungen erkannt.' : 'All clear. No critical deviations detected.')
      : status === 'warning'
        ? (de ? 'Aufmerksamkeit erforderlich. Einige Kennzahlen weichen vom Erwartungswert ab.' : 'Attention needed. Some metrics deviate from expected values.')
        : (de ? 'Kritische Abweichungen erkannt. Sofortige Prüfung empfohlen.' : 'Critical deviations detected. Immediate review recommended.')

    // Last analyzed
    const analyzedDates = sources.map(s => s.analyzed_at).filter(Boolean).sort().reverse()
    const lastA = analyzedDates[0] || null

    // Build KPI list from trends (business-readable)
    const kpiList = tr.slice(0, 4).map((trend: any) => {
      const pct = trend.total_change_pct || 0
      const name = (trend.measure_column || '').replace(/_/g, ' ')
      const isLarge = Math.abs(pct) > 30
      const significant = trend.significant
      return {
        label: name.charAt(0).toUpperCase() + name.slice(1),
        pct,
        up: pct > 0,
        severity: isLarge && !significant ? 'warning' : Math.abs(pct) > 50 ? 'critical' : pct > 5 ? 'positive' : pct < -5 ? 'negative' : 'neutral',
        context: isLarge && !significant
          ? (de ? 'Ungewöhnlich — prüfen Sie die Datenquelle' : 'Unusual — check data source')
          : significant
            ? (de ? 'Statistisch signifikant' : 'Statistically significant')
            : (de ? 'Im normalen Bereich' : 'Within normal range'),
      }
    })

    return {
      totalRecords: totalR,
      trends: tr,
      insights: ins.slice(0, 5),
      healthStatus: status,
      healthMessage: msg,
      lastAnalyzed: lastA,
      kpis: kpiList,
    }
  }, [sources, alertCount, de])

  if (loading) return null

  const hasSources = sources.length > 0
  const healthIcon = healthStatus === 'ok' ? CheckCircle2 : healthStatus === 'warning' ? AlertCircle : AlertTriangle
  const healthColor = healthStatus === 'ok' ? 'text-emerald-600' : healthStatus === 'warning' ? 'text-amber-600' : 'text-red-600'
  const healthBg = healthStatus === 'ok' ? 'bg-emerald-50 border-emerald-200' : healthStatus === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  const HealthIcon = healthIcon

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {project && <ProjectIconBadge icon={project.icon} color={project.color} size="lg" />}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{project?.name}</h2>
            {lastAnalyzed && (
              <p className="text-muted-foreground text-sm">
                {de ? 'Letzte Aktualisierung' : 'Last updated'}: {timeAgo(lastAnalyzed, locale)}
              </p>
            )}
          </div>
        </div>
        {hasSources && (
          <button onClick={() => router.push(`${basePath}/sources/new`)} className="dl-btn-primary text-sm">
            {t('home.addSource')}
          </button>
        )}
      </div>

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
          {/* ── 1. Health Indicator ── */}
          <div className={`rounded-lg border p-5 ${healthBg}`}>
            <div className="flex items-start gap-3">
              <HealthIcon className={`h-5 w-5 mt-0.5 ${healthColor}`} />
              <div>
                <p className={`text-sm font-semibold ${healthColor}`}>
                  {healthStatus === 'ok' ? (de ? 'Alles in Ordnung' : 'All clear')
                    : healthStatus === 'warning' ? (de ? 'Aufmerksamkeit erforderlich' : 'Attention needed')
                    : (de ? 'Kritische Abweichungen' : 'Critical deviations')}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{healthMessage}</p>
              </div>
            </div>
          </div>

          {/* ── 2. What changed (since last visit) ── */}
          {(insights.length > 0 || alertCount > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {de ? 'Neu seit Ihrem letzten Besuch' : 'Since your last visit'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {alertCount > 0 && (
                    <Link href={`${basePath}/alerts`} className="flex items-center gap-2 text-sm hover:underline">
                      <span className="text-amber-500">→</span>
                      <span>{alertCount} {de ? 'neue Warnungen' : 'new alerts'}</span>
                    </Link>
                  )}
                  {kpis.slice(0, 2).map((kpi, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={kpi.up ? 'text-emerald-500' : 'text-red-500'}>→</span>
                      <span>{kpi.label}: {kpi.up ? '+' : ''}{kpi.pct.toFixed(1)}%</span>
                      {kpi.severity === 'warning' && <span className="text-xs text-amber-600">⚠</span>}
                    </div>
                  ))}
                  {insights.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-blue-500">→</span>
                      <span>{insights.length} {de ? 'Erkenntnisse erkannt' : 'insights detected'}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 3. Key Metrics (with context, not just numbers) ── */}
          {kpis.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">{de ? 'Kennzahlen' : 'Key Metrics'}</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {kpis.map((kpi, i) => {
                  const sevColor = kpi.severity === 'critical' ? 'text-red-600' : kpi.severity === 'warning' ? 'text-amber-600' : kpi.severity === 'positive' ? 'text-emerald-600' : kpi.severity === 'negative' ? 'text-red-500' : 'text-muted-foreground'
                  const sevIcon = kpi.severity === 'critical' || kpi.severity === 'warning' ? ' ⚠' : kpi.severity === 'positive' ? ' ✓' : ''
                  return (
                    <Card key={i}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${sevColor}`}>
                          {kpi.up ? '+' : ''}{kpi.pct.toFixed(1)}%{sevIcon}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{kpi.context}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 4. Top Findings (with actions, business language) ── */}
          {insights.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">{de ? 'Wichtigste Erkenntnisse' : 'Key Findings'}</h3>
              <div className="space-y-2">
                {insights.map((ins: any, i: number) => {
                  const isAnomaly = ins.type === 'anomaly' || (ins.effect_size || 0) > 0.6
                  const isWarning = (ins.effect_size || 0) > 0.3
                  const icon = isAnomaly ? '🔴' : isWarning ? '⚠' : '✅'
                  const borderColor = isAnomaly ? 'border-l-red-500' : isWarning ? 'border-l-amber-500' : 'border-l-emerald-500'

                  return (
                    <Card key={i} className={`border-l-[3px] ${borderColor}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-sm mt-0.5">{icon}</span>
                            <div>
                              <p className="text-sm leading-relaxed">
                                {translateFinding(ins.headline || '', locale)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => router.push(`${basePath}/insights`)}
                            className="text-xs font-medium text-muted-foreground hover:text-foreground border rounded-md px-2.5 py-1 hover:bg-accent transition flex-shrink-0"
                          >
                            {de ? 'Analysieren' : 'Analyze'}
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 5. Quick Actions ── */}
          <div className="grid gap-3 md:grid-cols-4 pt-2">
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
