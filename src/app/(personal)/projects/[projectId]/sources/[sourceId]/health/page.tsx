'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useProjectContext } from '@/lib/hooks/useProjectContext'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  ArrowRight, Wand2, BarChart2, MessageSquare
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { DataProfile } from '@/types/pipeline'
import { isDbSource } from '@/lib/source-types'

const DTYPE_COLORS: Record<string, string> = {
  numeric: 'bg-blue-100 text-blue-700',
  categorical: 'bg-purple-100 text-purple-700',
  text: 'bg-dl-bg-medium text-dl-text-medium',
  date: 'bg-green-100 text-green-700',
  id: 'bg-orange-100 text-orange-700',
  empty: 'bg-dl-bg-medium text-dl-text-light',
}

function qualityColor(score: number) {
  if (score >= 90) return 'bg-dl-success'
  if (score >= 70) return 'bg-yellow-400'
  if (score >= 50) return 'bg-orange-400'
  return 'bg-dl-error'
}

function qualityLabel(level: string) {
  if (level === 'good') return { text: 'Good', class: 'bg-green-100 text-green-700' }
  if (level === 'yellow') return { text: 'Minor issues', class: 'bg-yellow-100 text-yellow-700' }
  if (level === 'amber') return { text: 'Issues found', class: 'bg-orange-100 text-orange-700' }
  return { text: 'Significant issues', class: 'bg-red-100 text-red-700' }
}

function severityIcon(s: string) {
  if (s === 'red') return <XCircle size={14} className="text-dl-error flex-shrink-0" />
  if (s === 'amber') return <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
  return <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
}

function severityBg(s: string) {
  if (s === 'red') return 'border-dl-error bg-red-50'
  if (s === 'amber') return 'border-orange-300 bg-orange-50'
  return 'border-yellow-300 bg-yellow-50'
}

export default function DataHealthPage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const { projectId, basePath } = useProjectContext()
  const sourceId = params.sourceId as string

  const [profile, setProfile] = useState<DataProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const fileRef = useRef<File | null>(null)
  const [dbTables, setDbTables] = useState<{ name: string; row_count: number }[]>([])
  const [selectedDbTable, setSelectedDbTable] = useState<string>('')
  const [profilingTable, setProfilingTable] = useState(false)

  async function profileDbTable(tableName: string) {
    setProfilingTable(true)
    setError(null)
    setSelectedDbTable(tableName)
    try {
      const res = await fetch('/api/pipeline/profile-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId, table_name: tableName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Database profiling failed')
      setProfile(data)
    } catch (e: any) {
      setError(e.message || 'Database profiling failed')
    } finally {
      setProfilingTable(false)
    }
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function init() {
      // Fetch source record — use select('*') to avoid column-not-found errors
      const { data: src, error: srcErr } = await supabase
        .from('data_sources')
        .select('*')
        .eq('id', sourceId)
        .single()

      if (srcErr) {
        console.error('Health page fetch error:', srcErr.message, srcErr.details)
        setError(`${t('errors.sourceNotFound')}: ${srcErr.message}`)
        setLoading(false)
        return
      }

      if (!src) { setError('Data source not found'); setLoading(false); return }
      setSourceName(src.name)

      // DB sources now use the dedicated overview page
      if (isDbSource(src.source_type)) {
        router.replace(`${basePath}/sources/${sourceId}/overview`)
        return
      }

      {
        // File path: download file and profile
        let file: File | null = null
        const filePath = src.file_path as string | null

        // Try Storage first
        if (filePath) {
          const { data: blob, error: dlErr } = await supabase.storage
            .from('data-sources')
            .download(filePath)
          if (!dlErr && blob) {
            file = new File([blob], src.name, { type: blob.type || 'text/csv' })
          }
        }

        // Fallback: reconstruct from sample_data
        if (!file) {
          const sample = src.sample_data as { tables?: { columns: string[]; rows: string[][] }[] } | null
          if (sample?.tables?.[0]) {
            const cols = sample.tables[0].columns
            const rows = sample.tables[0].rows
            const csv = [cols.join(','), ...rows.map(r => r.join(','))].join('\n')
            file = new File([csv], src.name, { type: 'text/csv' })
          }
        }

        if (!file) {
          setError('Could not load data file. Please re-upload.')
          setLoading(false)
          return
        }

        fileRef.current = file

        // Profile via pipeline service
        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('source_id', sourceId)
          const res = await fetch('/api/pipeline/profile', { method: 'POST', body: fd })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Profiling failed')
          setProfile(data)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Profiling failed. Is the pipeline service running?')
        } finally {
          setLoading(false)
        }
      }
    }
    init()
  }, [sourceId])

  const base = basePath

  // Loading state
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center font-sans">
        <Loader2 className="w-10 h-10 text-dl-brand animate-spin mx-auto mb-4" />
        <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{t('health.analyzing')}</h2>
        <p className="text-dl-text-medium text-dl-sm">
          {t('health.analyzingDesc')}
        </p>
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
        <button onClick={() => window.location.reload()} className="dl-btn-primary">{t('health.tryAgain')}</button>
      </div>
    )
  }

  if (!profile) return null

  const label = qualityLabel(profile.quality_level)
  const hasIssues = profile.warnings.length > 0
  const issueCount = profile.warnings.length
  const redCount = profile.warnings.filter(w => w.severity === 'red').length
  const amberCount = profile.warnings.filter(w => w.severity === 'amber').length

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 font-sans">

      {/* Header */}
      <div className="mb-8">
        <p className="text-dl-xs text-dl-text-light font-bold uppercase tracking-wider mb-1">
          {t('health.title')}
        </p>
        <h1 className="text-dl-2xl font-black text-dl-text-dark">{sourceName}</h1>

        {/* DB table selector */}
        {dbTables.length > 1 && (
          <div className="flex items-center gap-3 mt-3">
            <select
              className="dl-input max-w-xs"
              value={selectedDbTable}
              onChange={e => profileDbTable(e.target.value)}
              disabled={profilingTable}
            >
              {dbTables.map(tbl => (
                <option key={tbl.name} value={tbl.name}>
                  {tbl.name} ({tbl.row_count?.toLocaleString()} {t('common.rows')})
                </option>
              ))}
            </select>
            {profilingTable && <Loader2 size={16} className="animate-spin text-dl-brand" />}
          </div>
        )}
      </div>

      {/* Quality score card */}
      <div className="dl-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-dl-xs font-bold text-dl-text-light uppercase tracking-wider mb-1">{t('health.qualityScore')}</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black text-dl-text-dark">{profile.quality_score}</span>
              <span className="text-dl-text-light text-dl-lg font-bold">/100</span>
              <span className={`px-2.5 py-1 rounded-full text-dl-xs font-black ${label.class}`}>
                {label.text}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-dl-xs text-dl-text-light">{profile.total_rows.toLocaleString()} {t('common.rows')}</p>
            <p className="text-dl-xs text-dl-text-light">{profile.total_columns} {t('common.columns')}</p>
            {profile.detected_encoding && profile.detected_encoding !== 'N/A' && (
              <p className="text-dl-xs text-dl-text-light">{profile.detected_encoding.toUpperCase()}</p>
            )}
          </div>
        </div>

        {/* Quality bar */}
        <div className="w-full h-3 bg-dl-bg-medium rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${qualityColor(profile.quality_score)}`}
            style={{ width: `${profile.quality_score}%` }}
          />
        </div>
      </div>

      {/* Issues found */}
      {hasIssues && (
        <div className="mb-6">
          <p className="dl-section-header mb-3">
            {t('health.issuesFound', { count: issueCount })}
          </p>
          <div className="space-y-2">
            {profile.warnings.map((w, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-dl-md border ${severityBg(w.severity)}`}>
                {severityIcon(w.severity)}
                <div className="flex-1">
                  <span className="text-dl-sm font-black text-dl-text-dark">{w.column}</span>
                  <span className="text-dl-sm text-dl-text-medium ml-2">{w.detail}</span>
                  {w.affected_rows != null && (
                    <span className="text-dl-xs text-dl-text-light ml-1">
                      ({w.affected_rows.toLocaleString()} rows)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Column overview — compact */}
      <div className="mb-8">
        <p className="dl-section-header mb-3">{t('health.columnOverview')}</p>
        <div className="dl-card overflow-hidden">
          <table className="dl-table">
            <thead>
              <tr>
                <th>{t("common.column")}</th>
                <th>{t("common.type")}</th>
                <th>{t("common.nullRate")}</th>
                <th>{t("common.issues")}</th>
              </tr>
            </thead>
            <tbody>
              {profile.columns.map(col => {
                const hasColIssues = col.mixed_types || col.format_issues || col.outlier_count > 0 || col.null_rate > 0.05
                return (
                  <tr key={col.name}>
                    <td className="font-bold text-dl-xs">{col.name}</td>
                    <td>
                      <span className={`px-1.5 py-0.5 rounded text-dl-xs font-bold ${DTYPE_COLORS[col.dtype] || DTYPE_COLORS.text}`}>
                        {col.dtype}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-1.5 bg-dl-bg-medium rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${col.null_rate > 0.2 ? 'bg-dl-error' : col.null_rate > 0.05 ? 'bg-orange-400' : 'bg-dl-success'}`}
                            style={{ width: `${Math.min(col.null_rate * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-dl-xs text-dl-text-light">{(col.null_rate * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      {hasColIssues ? (
                        <AlertTriangle size={13} className="text-orange-400" />
                      ) : (
                        <CheckCircle2 size={13} className="text-dl-success" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision CTAs */}
      <div className="border-t border-dl-border pt-6">
        <h2 className="text-dl-lg font-black text-dl-text-dark mb-2">{t('health.whatToDo')}</h2>
        <p className="text-dl-text-medium text-dl-sm mb-5">
          {hasIssues
            ? t('health.issuesCTA')
            : t('health.dataCleanCTA')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Clean first */}
          <button
            onClick={() => router.push(`${basePath}/prep/${sourceId}`)}
            className={`text-left p-5 rounded-dl-lg border transition-all group
              ${hasIssues ? 'border-dl-brand bg-dl-brand-hover' : 'border-dl-border hover:border-dl-brand hover:bg-dl-brand-hover'}`}
          >
            <div className={`w-10 h-10 rounded-dl-md flex items-center justify-center mb-3
              ${hasIssues ? 'bg-dl-brand' : 'bg-dl-bg-medium group-hover:bg-dl-brand'} transition-colors`}>
              <Wand2 size={18} className={hasIssues ? 'text-white' : 'text-dl-text-light group-hover:text-white'} />
            </div>
            <p className={`text-dl-sm font-black mb-1 ${hasIssues ? 'text-dl-brand' : 'text-dl-text-dark'}`}>
              {t('health.cleanFirst')}
            </p>
            <p className="text-dl-xs text-dl-text-medium">
              {hasIssues
                ? t('health.cleanFirstDesc')
                : t('studio.runPipeline')}
            </p>
            {hasIssues && (redCount > 0 || amberCount > 0) && (
              <p className="text-dl-xs text-dl-text-light mt-2">
                {redCount > 0 && `${redCount} critical`}
                {redCount > 0 && amberCount > 0 && ' · '}
                {amberCount > 0 && `${amberCount} warning${amberCount !== 1 ? 's' : ''}`}
              </p>
            )}
          </button>

          {/* Option 2: Skip, explore raw */}
          <button
            onClick={() => router.push(`${base}/ask`)}
            className="text-left p-5 rounded-dl-lg border border-dl-border hover:border-dl-brand hover:bg-dl-brand-hover transition-all group"
          >
            <div className="w-10 h-10 rounded-dl-md flex items-center justify-center mb-3 bg-dl-bg-medium group-hover:bg-dl-brand transition-colors">
              <MessageSquare size={18} className="text-dl-text-light group-hover:text-white" />
            </div>
            <p className="text-dl-sm font-black text-dl-text-dark mb-1">
              {t('health.skipExplore')}
            </p>
            <p className="text-dl-xs text-dl-text-medium">
              {t('health.skipExploreDesc')}
            </p>
            {hasIssues && (
              <p className="text-dl-xs text-dl-text-light mt-2">
                {t('health.qualityWarnings')}
              </p>
            )}
          </button>
        </div>

        {/* Auto-Analysis CTA */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => router.push(`${basePath}/sources/${sourceId}/analysis`)}
            className="text-dl-xs font-bold text-dl-brand hover:text-dl-brand-dark transition-colors inline-flex items-center gap-1.5 bg-dl-brand-hover px-4 py-2 rounded-dl-md"
          >
            <BarChart2 size={13} /> {t('health.runAutoAnalysis')} <ArrowRight size={11} />
          </button>
          <button
            onClick={() => router.push(`${base}/insights`)}
            className="text-dl-xs font-bold text-dl-text-light hover:text-dl-brand transition-colors inline-flex items-center gap-1"
          >
            {t('health.aiInsights')} <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}
