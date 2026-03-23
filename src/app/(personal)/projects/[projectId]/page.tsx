'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Database, BarChart2, MessageSquare, FlaskConical, ArrowRight,
  Zap, TrendingUp, GitBranch, AlertTriangle, Target, Layers, Search
} from 'lucide-react'
import { ProjectIconBadge } from '@/components/ProjectIcon'
import { useTranslations, useLocale } from 'next-intl'
import { translateFinding } from '@/lib/i18n/findingsMap'
import type { Project } from '@/types/database'

const INSIGHT_ICONS: Record<string, typeof Zap> = {
  correlation: GitBranch, group_difference: BarChart2, anomaly: AlertTriangle,
  distribution: Layers, association: GitBranch, trend: TrendingUp,
  change_point: Zap, majority: Target, key_influencer: Search,
  clustering: Layers, outlier_explanation: AlertTriangle, contribution: BarChart2,
  forecast: TrendingUp, leading_indicator: TrendingUp, temporal_pattern: TrendingUp,
  seasonality: TrendingUp,
}

const INSIGHT_COLORS: Record<string, string> = {
  correlation: 'border-l-blue-400', group_difference: 'border-l-green-400',
  anomaly: 'border-l-red-400', distribution: 'border-l-purple-400',
  association: 'border-l-teal-400', trend: 'border-l-indigo-400',
  majority: 'border-l-amber-400', key_influencer: 'border-l-cyan-400',
  clustering: 'border-l-gray-400', contribution: 'border-l-emerald-400',
}

interface TopInsight {
  type: string
  headline: string
  columns: string[]
  p_value: number
  effect_size: number
  source_name: string
}

interface SourceSummary {
  id: string
  name: string
  source_type: string
  row_count: number
  insight_count: number
  quality_score: number | null
  status: string
}

export default function ProjectHomePage() {
  const t = useTranslations()
  const locale = useLocale()
  const [project, setProject] = useState<Project | null>(null)
  const [sources, setSources] = useState<SourceSummary[]>([])
  const [topInsights, setTopInsights] = useState<TopInsight[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

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
        .select('id, name, source_type, row_count, status, auto_analysis, pipeline_status')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      const sourceSummaries: SourceSummary[] = []
      const allInsights: TopInsight[] = []

      for (const src of srcs || []) {
        const analysis = src.auto_analysis as Record<string, unknown> | null
        const insights = (analysis?.top_insights as { type: string; headline: string; columns: string[]; p_value: number; effect_size: number }[]) || []

        sourceSummaries.push({
          id: src.id,
          name: src.name,
          source_type: src.source_type,
          row_count: src.row_count || 0,
          insight_count: insights.length,
          quality_score: null,
          status: src.pipeline_status || 'unprepared',
        })

        for (const ins of insights.slice(0, 3)) {
          allInsights.push({ ...ins, source_name: src.name })
        }
      }

      // Sort insights by effect size (most impactful first), take top 5
      allInsights.sort((a, b) => b.effect_size - a.effect_size)
      setTopInsights(allInsights.slice(0, 5))
      setSources(sourceSummaries)
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) return null

  const base = `/projects/${projectId}`
  const hasSources = sources.length > 0
  const hasInsights = topInsights.length > 0

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Project header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          {project && <ProjectIconBadge icon={project.icon} color={project.color} size="lg" />}
          <h1 className="text-dl-2xl font-black text-dl-text-dark">{project?.name}</h1>
        </div>
        {project?.description && (
          <p className="text-dl-text-medium text-dl-base ml-12">{project.description}</p>
        )}
      </div>

      {/* Empty state */}
      {!hasSources && (
        <div className="bg-white border border-dl-border rounded-dl-lg p-8 text-center mb-6">
          <div className="w-14 h-14 bg-dl-bg-medium rounded-full flex items-center justify-center mx-auto mb-4">
            <Database size={24} className="text-dl-text-light" />
          </div>
          <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{t('home.connectFirst')}</h2>
          <p className="text-dl-text-medium text-dl-base mb-6 max-w-sm mx-auto">
            {t('home.connectFirstDesc')}
          </p>
          <button onClick={() => router.push(`${base}/sources/new`)} className="dl-btn-primary px-6 py-2.5 font-black">
            {t('home.addSource')} →
          </button>
        </div>
      )}

      {/* Top Insights (from engine auto-analysis) */}
      {hasInsights && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-black text-dl-text-dark uppercase tracking-wider flex items-center gap-2">
              <Zap size={14} className="text-dl-brand" /> {t('home.topInsights')}
            </h2>
            <button onClick={() => router.push(`${base}/insights`)}
              className="text-[11px] text-dl-brand hover:underline flex items-center gap-1">
              {t('common.viewAll')} <ArrowRight size={10} />
            </button>
          </div>
          <div className="space-y-2">
            {topInsights.map((ins, i) => {
              const Icon = INSIGHT_ICONS[ins.type] || Zap
              const borderColor = INSIGHT_COLORS[ins.type] || 'border-l-dl-border'
              return (
                <div key={i} className={`bg-white border border-dl-border ${borderColor} border-l-4 rounded-dl-md px-4 py-3 flex items-start gap-3`}>
                  <Icon size={14} className="text-dl-text-light mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-dl-text-dark leading-relaxed">{translateFinding(ins.headline, locale)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-dl-text-light">{ins.source_name}</span>
                      <span className="text-[10px] text-dl-text-light">•</span>
                      <span className="text-[10px] text-dl-text-light">{t(`insightTypes.${ins.type}` as Parameters<typeof t>[0])}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Data Sources mini-list */}
      {hasSources && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-black text-dl-text-dark uppercase tracking-wider flex items-center gap-2">
              <Database size={14} className="text-dl-text-light" /> {t('home.dataSources')}
            </h2>
            <button onClick={() => router.push(`${base}/sources`)}
              className="text-[11px] text-dl-brand hover:underline flex items-center gap-1">
              {t('common.manage')} <ArrowRight size={10} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sources.slice(0, 4).map(src => (
              <button key={src.id}
                onClick={() => router.push(`${base}/sources/${src.id}/analysis`)}
                className="bg-white border border-dl-border rounded-dl-md p-3 text-left hover:border-dl-brand transition-colors group">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    src.status === 'ready' ? 'bg-dl-success' : src.insight_count > 0 ? 'bg-dl-brand' : 'bg-dl-border-dark'
                  }`} />
                  <span className="text-[13px] font-medium text-dl-text-dark truncate">{src.name}</span>
                  <span className="text-[10px] text-dl-text-light uppercase ml-auto">{src.source_type}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-dl-text-light">
                  {src.row_count > 0 && <span>{src.row_count.toLocaleString()} rows</span>}
                  {src.insight_count > 0 && (
                    <span className="text-dl-brand font-medium">{src.insight_count} {t('home.insights')}</span>
                  )}
                  {src.insight_count === 0 && <span>{t('home.notAnalyzed')}</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-[13px] font-black text-dl-text-dark uppercase tracking-wider mb-3">{t('home.quickActions')}</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Database, label: t('home.addSource'), desc: t('home.addSourceDesc'), href: `${base}/sources/new` },
            { icon: BarChart2, label: t('home.viewInsights'), desc: t('home.viewInsightsDesc'), href: `${base}/insights` },
            { icon: MessageSquare, label: t('home.askData'), desc: t('home.askDataDesc'), href: `${base}/ask` },
            { icon: FlaskConical, label: t('home.openStudio'), desc: t('home.openStudioDesc'), href: `${base}/studio` },
          ].map(action => (
            <button key={action.label} onClick={() => router.push(action.href)}
              className="text-left p-3 rounded-dl-md border border-dl-border hover:border-dl-brand hover:bg-dl-brand-hover transition-all flex items-start gap-3 group">
              <div className="w-8 h-8 rounded-dl-md flex items-center justify-center bg-dl-bg-medium group-hover:bg-dl-brand transition-colors flex-shrink-0">
                <action.icon size={15} className="text-dl-text-light group-hover:text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-dl-sm font-black text-dl-text-dark mb-0.5">{action.label}</p>
                <p className="text-[11px] text-dl-text-medium">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
