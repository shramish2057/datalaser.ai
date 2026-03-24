'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Loader2, CheckCircle2, AlertTriangle, XCircle,
  Database, MessageSquare, BarChart2, Sparkles, ArrowRight
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { isDbSource } from '@/lib/source-types'

interface TableProfile {
  name: string
  quality_score: number
  quality_level: string
  total_rows: number
  total_columns: number
  warnings: { column: string; issue: string; severity: string; detail: string; affected_rows?: number | null }[]
  error?: string
}

interface ProfileAllResponse {
  source_id: string
  tables: TableProfile[]
  overall_quality: number
  total_rows: number
  total_tables: number
  profiled_tables: number
  failed_tables: number
}

function qualityBadge(score: number) {
  if (score >= 80) return { label: 'Good', cls: 'dl-badge-success' }
  if (score >= 60) return { label: 'Fair', cls: 'bg-yellow-100 text-yellow-700' }
  return { label: 'Poor', cls: 'bg-red-100 text-red-700' }
}

function qualityBarColor(score: number) {
  if (score >= 80) return 'bg-dl-success'
  if (score >= 60) return 'bg-yellow-400'
  return 'bg-dl-error'
}

function overallQualityLevel(score: number) {
  if (score >= 80) return 'dl-badge-success'
  if (score >= 60) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

export default function DatabaseOverviewPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const sourceId = params.sourceId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [profileData, setProfileData] = useState<ProfileAllResponse | null>(null)
  const [profilingProgress, setProfilingProgress] = useState(0)
  const [tableCount, setTableCount] = useState(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function init() {
      // Fetch source record
      const { data: src, error: srcErr } = await supabase
        .from('data_sources')
        .select('*')
        .eq('id', sourceId)
        .single()

      if (srcErr || !src) {
        setError(t('errors.sourceNotFound'))
        setLoading(false)
        return
      }

      setSourceName(src.name)
      setSourceType(src.source_type)

      // If not a DB source, redirect to health page
      if (!isDbSource(src.source_type)) {
        router.replace(`/projects/${projectId}/sources/${sourceId}/health`)
        return
      }

      // Get table count for progress display
      const schema = src.schema_snapshot as { tables?: { name: string; row_count: number }[] } | null
      const tables = schema?.tables || []
      setTableCount(tables.length)

      // Start animated progress
      const progressInterval = setInterval(() => {
        setProfilingProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 8
        })
      }, 500)

      // Call profile-all API
      try {
        const res = await fetch('/api/sources/profile-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: sourceId }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Profiling failed')
        }

        setProfilingProgress(100)
        clearInterval(progressInterval)
        setProfileData(data)
      } catch (e: any) {
        clearInterval(progressInterval)
        setError(e.message || 'Failed to profile database tables')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [sourceId])

  const base = `/projects/${projectId}`

  // Loading state with animated progress
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center font-sans">
        <Loader2 className="w-10 h-10 text-dl-brand animate-spin mx-auto mb-4" />
        <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">
          {t('overview.profilingTables', { count: tableCount || '...' })}
        </h2>
        <p className="text-dl-text-medium text-dl-sm mb-6">
          {t('overview.title')}
        </p>

        {/* Progress bar */}
        <div className="max-w-sm mx-auto">
          <div className="w-full h-3 bg-dl-bg-medium rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-dl-brand transition-all duration-500 ease-out"
              style={{ width: `${Math.min(profilingProgress, 100)}%` }}
            />
          </div>
          <p className="text-dl-xs text-dl-text-light mt-2">
            {Math.round(profilingProgress)}%
          </p>
        </div>

        <div className="max-w-sm mx-auto mt-6 space-y-2">
          <div className="h-4 rounded-dl-md bg-dl-bg-medium animate-pulse" />
          <div className="h-4 rounded-dl-md bg-dl-bg-medium animate-pulse w-3/4" />
          <div className="h-4 rounded-dl-md bg-dl-bg-medium animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center font-sans">
        <XCircle className="w-10 h-10 text-dl-error mx-auto mb-4" />
        <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{t('health.couldNotAnalyze')}</h2>
        <p className="text-dl-text-medium text-dl-sm mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="dl-btn-primary">
          {t('health.tryAgain')}
        </button>
      </div>
    )
  }

  if (!profileData) return null

  const badge = qualityBadge(profileData.overall_quality)
  const allHealthy = profileData.tables.every(tbl => tbl.quality_score >= 80 && !tbl.error)

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 font-sans">

      {/* Header section */}
      <div className="mb-8">
        <p className="text-dl-xs text-dl-text-light font-bold uppercase tracking-wider mb-1">
          {t('overview.title')}
        </p>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-dl-2xl font-black text-dl-text-dark">{sourceName}</h1>
          <span className="px-2.5 py-1 rounded-full text-dl-xs font-black bg-blue-100 text-blue-700 capitalize">
            {sourceType}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-dl-xs font-black dl-badge-success">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {t('overview.connected')}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Overall quality */}
        <div className="dl-card p-6">
          <p className="text-dl-xs font-bold text-dl-text-light uppercase tracking-wider mb-2">
            {t('overview.overallQuality')}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-black text-dl-text-dark">{profileData.overall_quality}</span>
            <span className="text-dl-text-light text-dl-lg font-bold">/100</span>
            <span className={`px-2.5 py-1 rounded-full text-dl-xs font-black ${overallQualityLevel(profileData.overall_quality)}`}>
              {badge.label}
            </span>
          </div>
          <div className="w-full h-3 bg-dl-bg-medium rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${qualityBarColor(profileData.overall_quality)}`}
              style={{ width: `${profileData.overall_quality}%` }}
            />
          </div>
        </div>

        {/* Total tables */}
        <div className="dl-card p-6">
          <p className="text-dl-xs font-bold text-dl-text-light uppercase tracking-wider mb-2">
            {t('overview.tables')}
          </p>
          <div className="flex items-center gap-2">
            <Database size={20} className="text-dl-brand" />
            <span className="text-4xl font-black text-dl-text-dark">{profileData.total_tables}</span>
          </div>
          {profileData.failed_tables > 0 && (
            <p className="text-dl-xs text-dl-error mt-2">
              {profileData.failed_tables} failed
            </p>
          )}
        </div>

        {/* Total rows */}
        <div className="dl-card p-6">
          <p className="text-dl-xs font-bold text-dl-text-light uppercase tracking-wider mb-2">
            {t('overview.totalRows')}
          </p>
          <span className="text-4xl font-black text-dl-text-dark">
            {profileData.total_rows.toLocaleString()}
          </span>
        </div>
      </div>

      {/* All healthy banner */}
      {allHealthy && (
        <div className="dl-card p-4 mb-6 border-green-200 bg-green-50 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-600" />
          <p className="text-dl-sm font-black text-green-700">{t('overview.allHealthy')}</p>
        </div>
      )}

      {/* Profiling complete badge */}
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 size={14} className="text-dl-success" />
        <p className="text-dl-xs font-bold text-dl-text-light">{t('overview.profilingComplete')}</p>
      </div>

      {/* Table cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {profileData.tables.map(table => {
          const tBadge = qualityBadge(table.quality_score)
          const hasError = !!table.error

          return (
            <div key={table.name} className="dl-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-dl-sm font-black text-dl-text-dark">{table.name}</h3>
                  {hasError && (
                    <p className="text-dl-xs text-dl-error mt-1">{table.error}</p>
                  )}
                </div>
                {!hasError && table.quality_score >= 80 ? (
                  <CheckCircle2 size={20} className="text-dl-success flex-shrink-0" />
                ) : !hasError ? (
                  <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0" />
                ) : (
                  <XCircle size={20} className="text-dl-error flex-shrink-0" />
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-dl-xs text-dl-text-medium mb-3">
                <span>{t('overview.rows')}: {table.total_rows.toLocaleString()}</span>
                <span>{t('overview.columns')}: {table.total_columns}</span>
              </div>

              {/* Quality bar */}
              {!hasError && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-dl-xs text-dl-text-light">{t('overview.tableQuality')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-dl-xs font-black ${tBadge.cls}`}>
                      {table.quality_score}/100
                    </span>
                  </div>
                  <div className="w-full h-2 bg-dl-bg-medium rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${qualityBarColor(table.quality_score)}`}
                      style={{ width: `${table.quality_score}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Warnings count */}
              {!hasError && table.warnings.length > 0 && (
                <p className="text-dl-xs text-dl-text-medium mb-3">
                  {table.warnings.length} warning{table.warnings.length !== 1 ? 's' : ''}
                </p>
              )}

              {/* Action button */}
              {!hasError && table.quality_score < 80 && (
                <button
                  onClick={() => router.push(`${base}/prep/${sourceId}?table=${encodeURIComponent(table.name)}`)}
                  className="dl-btn-secondary text-dl-xs w-full"
                >
                  {t('overview.cleanTable')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-dl-border pt-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => router.push(`${base}/ask`)}
            className="dl-btn-primary inline-flex items-center gap-2"
          >
            <MessageSquare size={16} />
            {t('nav.askData')}
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => router.push(`${base}/insights`)}
            className="dl-btn-secondary inline-flex items-center gap-2"
          >
            <Sparkles size={16} />
            {t('nav.insights')}
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => router.push(`${base}/studio`)}
            className="dl-btn-secondary inline-flex items-center gap-2"
          >
            <BarChart2 size={16} />
            {t('nav.studio')}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
