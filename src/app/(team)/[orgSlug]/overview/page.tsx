'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  RefreshCw, Zap, Loader2, BarChart2, ChevronRight, X,
  AlertTriangle, TrendingUp, Info, FileText, Share2,
  ChevronLeft as ChevronLeftIcon, ArrowRight,
} from 'lucide-react'
import type { OrgVilGraph } from '@/types/database'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type Tab = 'dashboard' | 'flipbook' | 'graph'

interface TeamHealth {
  score: number
  status: string
  name: string
  icon: string
  slug: string
  project_count: number
  industry_type: string | null
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function DLOverviewPage() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const params = useParams()
  const orgSlug = params.orgSlug as string

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [overview, setOverview] = useState<OrgVilGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  // Flipbook state
  const [currentSlide, setCurrentSlide] = useState(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchOverview = useCallback(async () => {
    const { data: org } = await supabase
      .from('organizations').select('id').eq('slug', orgSlug).single()
    if (!org) return
    setOrgId(org.id)

    const res = await fetch(`/api/org/${org.id}/overview`)
    if (res.ok) {
      const data = await res.json()
      if (data.exists) {
        setOverview(data as OrgVilGraph)
      }
    }
    setLoading(false)
  }, [orgSlug])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  const buildOverview = useCallback(async () => {
    if (!orgId) return
    setBuilding(true)
    try {
      const res = await fetch(`/api/org/${orgId}/overview/build`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setOverview(data as OrgVilGraph)
      }
    } catch {}
    setBuilding(false)
  }, [orgId])

  // Auto-build on first visit
  useEffect(() => {
    if (!loading && !overview && orgId && !building) {
      buildOverview()
    }
  }, [loading, overview, orgId])

  const teamHealthMap = (overview?.team_health_scores || {}) as unknown as Record<string, TeamHealth>
  const teams = Object.entries(teamHealthMap)
  const narrative = locale === 'de' ? overview?.narrative_de : overview?.narrative_en
  const healthScore = overview?.health_score || 0

  const healthColor = (score: number) =>
    score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'
  const healthBg = (score: number) =>
    score >= 80 ? 'bg-emerald-50 border-emerald-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  const statusIcon = (status: string) =>
    status === 'healthy' ? '✅' : status === 'warning' ? '🟡' : '🔴'

  // totalSlides: 1 (org overview) + teams + 1 (recommendations)
  const totalSlides = teams.length + 2

  /* ---- Keyboard nav for flipbook (must be before early returns) ---- */
  useEffect(() => {
    if (activeTab !== 'flipbook') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setCurrentSlide(s => Math.min(s + 1, totalSlides - 1))
      if (e.key === 'ArrowLeft') setCurrentSlide(s => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, totalSlides])

  /* ---- Loading / building ---- */
  if (loading || building) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-dl-bg-light font-sans">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center animate-pulse">
              <Zap size={28} className="text-white" />
            </div>
          </div>
          <h2 className="text-dl-xl font-black text-dl-text-dark">
            {building ? t('overview.building') : t('common.loading')}
          </h2>
          <p className="text-dl-text-medium text-dl-sm">
            {building ? t('overview.buildingDesc') : ''}
          </p>
          <Loader2 size={20} className="animate-spin text-dl-text-light" />
        </div>
      </div>
    )
  }

  /* ---- No overview yet ---- */
  if (!overview) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-dl-bg-light font-sans">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-dl-bg-medium border border-dl-border flex items-center justify-center">
            <BarChart2 size={24} className="text-dl-text-light" />
          </div>
          <h2 className="text-dl-xl font-black text-dl-text-dark">{t('overview.noOverview')}</h2>
          <p className="text-dl-text-medium text-dl-sm">{t('overview.noOverviewDesc')}</p>
          <button onClick={buildOverview} className="dl-btn-primary px-6 py-2.5 font-black">
            {t('overview.buildOverview')} &rarr;
          </button>
        </div>
      </div>
    )
  }

  /* ---- Flipbook slides ---- */
  const slides: { title: string; content: React.ReactNode }[] = [
    {
      title: t('overview.orgOverviewSlide'),
      content: (
        <div className="p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-dl-sm text-dl-text-medium leading-relaxed max-w-2xl">{narrative}</p>
            </div>
            <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center ${healthBg(healthScore)}`}>
              <span className={`text-2xl font-black ${healthColor(healthScore)}`}>{healthScore}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {teams.map(([id, team]) => (
              <div key={id} className={`p-3 rounded-dl-lg border ${healthBg(team.score)}`}>
                <p className="text-dl-xs font-bold text-dl-text-dark">{team.icon} {team.name}</p>
                <p className={`text-lg font-black ${healthColor(team.score)}`}>{team.score}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    ...teams.map(([id, team]) => ({
      title: `${team.icon} ${team.name}`,
      content: (
        <div className="p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dl-xs text-dl-text-light">{t('overview.healthScore')}</p>
              <p className={`text-3xl font-black ${healthColor(team.score)}`}>{team.score}/100</p>
            </div>
            <div className="text-right text-dl-xs text-dl-text-light">
              <p>{team.project_count} {t('overview.projects')}</p>
              {team.industry_type && <p>{team.industry_type}</p>}
            </div>
          </div>
        </div>
      ),
    })),
    {
      title: t('overview.recommendationsSlide'),
      content: (
        <div className="p-8 space-y-4">
          {teams.filter(([, t]) => t.status === 'critical').map(([id, team]) => (
            <div key={id} className="p-4 rounded-dl-lg bg-red-50 border border-red-200">
              <p className="text-dl-sm font-bold text-red-700">
                {team.icon} {team.name} — {t('overview.critical')} ({team.score}/100)
              </p>
            </div>
          ))}
          {teams.filter(([, t]) => t.status === 'warning').map(([id, team]) => (
            <div key={id} className="p-4 rounded-dl-lg bg-amber-50 border border-amber-200">
              <p className="text-dl-sm font-bold text-amber-700">
                {team.icon} {team.name} — {t('overview.warning')} ({team.score}/100)
              </p>
            </div>
          ))}
          {teams.filter(([, t]) => t.status === 'healthy').length === teams.length && (
            <div className="p-4 rounded-dl-lg bg-emerald-50 border border-emerald-200">
              <p className="text-dl-sm font-bold text-emerald-700">{t('overview.healthy')}</p>
            </div>
          )}
        </div>
      ),
    },
  ]

  /* ---- Main layout ---- */
  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: t('overview.dashboard') },
    { id: 'flipbook', label: t('overview.flipbook') },
    { id: 'graph', label: t('overview.graph') },
  ]

  return (
    <div className="h-screen flex flex-col bg-dl-bg-light font-sans overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-dl-border bg-dl-bg flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-dl-sm font-black text-dl-text-dark">{t('overview.title')}</h1>
          {overview.built_at && (
            <span className="text-dl-xs text-dl-text-light">
              {t('overview.lastUpdated')}: {new Date(overview.built_at).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex bg-dl-bg-light rounded-dl-md p-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-dl-md text-dl-xs font-bold transition-all
                  ${activeTab === tab.id
                    ? 'bg-white text-dl-text-dark shadow-sm'
                    : 'text-dl-text-light hover:text-dl-text-medium'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={buildOverview}
            disabled={building}
            className="dl-btn-secondary text-dl-xs py-1.5"
          >
            <RefreshCw size={13} className={building ? 'animate-spin' : ''} />
            {t('overview.refresh')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ===== DASHBOARD TAB ===== */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
            {/* Org Intelligence Card */}
            <div className="dl-card p-6 bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-dl-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {t('overview.orgIntelligence')}
                  </p>
                  <p className="text-sm leading-relaxed text-gray-200 max-w-2xl">{narrative}</p>
                </div>
                <div className="flex flex-col items-center ml-6">
                  <span className={`text-4xl font-black ${healthColor(healthScore)}`}>
                    {healthScore}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">/100</span>
                </div>
              </div>
            </div>

            {/* Team Health Grid */}
            <div>
              <h2 className="text-dl-sm font-black text-dl-text-dark mb-3">{t('overview.teamHealth')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {teams.map(([id, team]) => (
                  <button
                    key={id}
                    onClick={() => setSelectedTeam(selectedTeam === id ? null : id)}
                    className={`text-left dl-card p-4 transition-all hover:shadow-dl-md group
                      ${selectedTeam === id ? 'ring-2 ring-dl-brand' : 'hover:border-dl-brand'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">{team.icon}</span>
                      <span className="text-xs">{statusIcon(team.status)}</span>
                    </div>
                    <p className="text-dl-sm font-black text-dl-text-dark mb-1">{team.name}</p>
                    <p className={`text-2xl font-black ${healthColor(team.score)}`}>{team.score}</p>
                    <p className="text-dl-xs text-dl-text-light mt-1">
                      {team.project_count} {t('overview.projects')}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-dl-xs text-dl-brand opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('overview.diveIn')} <ChevronRight size={12} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Team Detail Panel (inline below grid when selected) */}
            {selectedTeam && teamHealthMap[selectedTeam] && (
              <div className="dl-card p-6 border-l-4 border-dl-brand">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-dl-base font-black text-dl-text-dark">
                      {teamHealthMap[selectedTeam].icon} {teamHealthMap[selectedTeam].name}
                    </h3>
                    <p className={`text-xl font-black ${healthColor(teamHealthMap[selectedTeam].score)}`}>
                      {teamHealthMap[selectedTeam].score}/100
                    </p>
                  </div>
                  <button onClick={() => setSelectedTeam(null)} className="p-1 hover:bg-dl-bg-light rounded-dl-md">
                    <X size={16} className="text-dl-text-light" />
                  </button>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => router.push(`/${orgSlug}/${teamHealthMap[selectedTeam].slug}`)}
                    className="dl-btn-primary text-dl-xs"
                  >
                    {t('overview.openTeam')} <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Cross-Team Intelligence */}
            {(overview.cross_team_insights as any[])?.length > 0 && (
              <div>
                <h2 className="text-dl-sm font-black text-dl-text-dark mb-1">{t('overview.crossTeam')}</h2>
                <p className="text-dl-xs text-dl-text-light mb-3">{t('overview.crossTeamSubtitle')}</p>
                <div className="space-y-2">
                  {(overview.cross_team_insights as any[]).map((insight: any, i: number) => (
                    <div key={i} className="dl-card p-4 flex items-start gap-3">
                      <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-dl-sm text-dl-text-dark font-bold">{insight.text}</p>
                        {insight.impact && (
                          <p className="text-dl-xs text-amber-600 font-bold mt-1">
                            {t('overview.estimatedImpact')}: {insight.impact}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== FLIPBOOK TAB ===== */}
        {activeTab === 'flipbook' && (
          <div className="h-full flex flex-col">
            {/* Slide content */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-4xl bg-white rounded-dl-xl shadow-dl-lg border border-dl-border overflow-hidden">
                <div className="px-6 py-4 border-b border-dl-border flex items-center justify-between bg-dl-bg">
                  <h3 className="text-dl-sm font-black text-dl-text-dark">{slides[currentSlide]?.title}</h3>
                  <span className="text-dl-xs text-dl-text-light">
                    {t('overview.slide')} {currentSlide + 1} / {totalSlides}
                  </span>
                </div>
                <div className="min-h-[300px]">
                  {slides[currentSlide]?.content}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 pb-6 flex-shrink-0">
              <button
                onClick={() => setCurrentSlide(s => Math.max(s - 1, 0))}
                disabled={currentSlide === 0}
                className="p-2 rounded-full hover:bg-dl-bg-light disabled:opacity-30 transition-colors"
              >
                <ChevronLeftIcon size={20} />
              </button>

              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all
                      ${i === currentSlide ? 'bg-dl-brand scale-125' : 'bg-dl-border hover:bg-dl-text-light'}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentSlide(s => Math.min(s + 1, totalSlides - 1))}
                disabled={currentSlide === totalSlides - 1}
                className="p-2 rounded-full hover:bg-dl-bg-light disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={20} />
              </button>

              <div className="ml-6 flex gap-2">
                <button onClick={() => window.print()} className="dl-btn-secondary text-dl-xs py-1.5">
                  <FileText size={13} /> {t('overview.exportPdf')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== GRAPH TAB ===== */}
        {activeTab === 'graph' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-dl-bg-medium border border-dl-border flex items-center justify-center mx-auto">
                <BarChart2 size={24} className="text-dl-text-light" />
              </div>
              <p className="text-dl-sm font-bold text-dl-text-medium">
                {t('overview.graph')}
              </p>
              <p className="text-dl-xs text-dl-text-light max-w-sm">
                Org-level visual graph with Sigma.js coming in next iteration.
                Use the Dashboard tab for team health and cross-team insights.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
