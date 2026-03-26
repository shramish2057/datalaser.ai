'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { normalizeInsights } from '@/lib/normalizeInsight'
import {
  Database, BarChart2, MessageSquare, FlaskConical, ArrowRight,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { useTranslations, useLocale } from 'next-intl'
import { useProjectContext } from '@/lib/hooks/useProjectContext'
import type { Project } from '@/types/database'

import { TopMetricCard } from '@/components/overview/TopMetricCard'
import { KeyKPIsCard } from '@/components/overview/KeyKPIsCard'
import { TrendChartCard } from '@/components/overview/TrendChartCard'
import { TopFindingsCard } from '@/components/overview/TopFindingsCard'
import { DataOverviewCard } from '@/components/overview/DataOverviewCard'

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

  if (loading) return null

  // Aggregate auto_analysis data across all sources
  const allAnalysis = sources
    .map(s => s.auto_analysis)
    .filter((a): a is Record<string, unknown> => a !== null)

  const allTrends = allAnalysis.flatMap(a => (a.trends as any[]) || [])
  const allForecasts = allAnalysis.flatMap(a => (a.forecasts as any[]) || [])
  const allMeasures = allAnalysis.flatMap(a => (a.measures as string[]) || [])

  const allInsights = allAnalysis.flatMap(a => {
    const raw = (a.top_insights as any[]) || []
    return normalizeInsights(raw) as any[]
  }).sort((a, b) => (b.effect_size || 0) - (a.effect_size || 0))

  const allContributions = allAnalysis.flatMap(a => (a.contribution_analysis as any[]) || [])
  const allMajority = allAnalysis.flatMap(a => (a.majority as any[]) || [])
  const allSegments = allAnalysis.flatMap(a => (a.segments as any[]) || [])

  const totalRecords = sources.reduce((s, src) => s + (src.row_count || 0), 0)
  const hasSources = sources.length > 0
  const hasAnalysis = allAnalysis.length > 0

  // Get first source with contribution data for chart
  const contribution = allContributions[0] || allMajority[0] || null

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      {/* Alert banner */}
      {alertCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-500" size={18} />
            <span className="text-sm font-medium text-gray-900">
              {t('alerts.issuesDetected', { count: alertCount })}
            </span>
          </div>
          <Link href={`${basePath}/alerts`} className="dl-btn-secondary text-xs">
            {t('alerts.viewAlerts')}
          </Link>
        </div>
      )}

      {/* Project header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          {project && <ProjectIconBadge icon={project.icon} color={project.color} size="lg" />}
          <h1 className="text-2xl font-black text-gray-900">{project?.name}</h1>
        </div>
        {project?.description && (
          <p className="text-gray-500 text-sm ml-12">{project.description}</p>
        )}
      </div>

      {/* Empty state */}
      {!hasSources && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-6">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database size={24} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">{t('home.connectFirst')}</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            {t('home.connectFirstDesc')}
          </p>
          <button onClick={() => router.push(`${basePath}/sources/new`)} className="dl-btn-primary px-6 py-2.5 font-black">
            {t('home.addSource')} →
          </button>
        </div>
      )}

      {/* 5 Intelligence Cards — features-8 grid layout */}
      {hasSources && (
        <div className="grid grid-cols-6 gap-3 mb-8">
          {/* Row 1: Top Metric | Key KPIs | Trend Chart */}
          <div className="col-span-full sm:col-span-3 lg:col-span-2">
            <TopMetricCard trends={allTrends} measures={allMeasures} />
          </div>
          <div className="col-span-full sm:col-span-3 lg:col-span-2">
            <KeyKPIsCard
              insights={allInsights}
              trends={allTrends}
              segments={allSegments}
              majority={allMajority}
            />
          </div>
          <div className="col-span-full lg:col-span-2">
            <TrendChartCard trends={allTrends} forecasts={allForecasts} />
          </div>

          {/* Row 2: Top Findings | Data Overview */}
          <div className="col-span-full lg:col-span-3">
            <TopFindingsCard
              insights={allInsights}
              basePath={basePath}
            />
          </div>
          <div className="col-span-full lg:col-span-3">
            <DataOverviewCard
              sources={sources}
              totalRecords={totalRecords}
              alertCount={alertCount}
              contribution={contribution}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {hasSources && (
        <section>
          <h2 className="text-[13px] font-black text-gray-900 uppercase tracking-wider mb-3">{t('home.quickActions')}</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Database, label: t('home.addSource'), desc: t('home.addSourceDesc'), href: `${basePath}/sources/new` },
              { icon: BarChart2, label: t('home.viewInsights'), desc: t('home.viewInsightsDesc'), href: `${basePath}/insights` },
              { icon: MessageSquare, label: t('home.askData'), desc: t('home.askDataDesc'), href: `${basePath}/ask` },
              { icon: FlaskConical, label: t('home.openStudio'), desc: t('home.openStudioDesc'), href: `${basePath}/studio` },
            ].map(action => (
              <button key={action.label} onClick={() => router.push(action.href)}
                className="text-left p-3 rounded-xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-all flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 group-hover:bg-gray-900 transition-colors flex-shrink-0">
                  <action.icon size={15} className="text-gray-400 group-hover:text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 mb-0.5">{action.label}</p>
                  <p className="text-xs text-gray-500">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
