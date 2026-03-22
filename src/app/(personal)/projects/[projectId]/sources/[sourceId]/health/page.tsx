'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  ArrowRight, Wand2, BarChart2, MessageSquare
} from 'lucide-react'
import type { DataProfile } from '@/types/pipeline'

const DTYPE_COLORS: Record<string, string> = {
  numeric: 'bg-blue-100 text-blue-700',
  categorical: 'bg-purple-100 text-purple-700',
  text: 'bg-mb-bg-medium text-mb-text-medium',
  date: 'bg-green-100 text-green-700',
  id: 'bg-orange-100 text-orange-700',
  empty: 'bg-mb-bg-medium text-mb-text-light',
}

function qualityColor(score: number) {
  if (score >= 90) return 'bg-mb-success'
  if (score >= 70) return 'bg-yellow-400'
  if (score >= 50) return 'bg-orange-400'
  return 'bg-mb-error'
}

function qualityLabel(level: string) {
  if (level === 'good') return { text: 'Good', class: 'bg-green-100 text-green-700' }
  if (level === 'yellow') return { text: 'Minor issues', class: 'bg-yellow-100 text-yellow-700' }
  if (level === 'amber') return { text: 'Issues found', class: 'bg-orange-100 text-orange-700' }
  return { text: 'Significant issues', class: 'bg-red-100 text-red-700' }
}

function severityIcon(s: string) {
  if (s === 'red') return <XCircle size={14} className="text-mb-error flex-shrink-0" />
  if (s === 'amber') return <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
  return <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
}

function severityBg(s: string) {
  if (s === 'red') return 'border-mb-error bg-red-50'
  if (s === 'amber') return 'border-orange-300 bg-orange-50'
  return 'border-yellow-300 bg-yellow-50'
}

export default function DataHealthPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const sourceId = params.sourceId as string

  const [profile, setProfile] = useState<DataProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const fileRef = useRef<File | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function init() {
      // Fetch source record
      const { data: src } = await supabase
        .from('data_sources')
        .select('name, source_type, file_path, sample_data, schema_snapshot')
        .eq('id', sourceId)
        .single()

      if (!src) { setError('Data source not found'); setLoading(false); return }
      setSourceName(src.name)

      // Get the file
      let file: File | null = null

      // Try Storage first
      if (src.file_path) {
        const { data: blob, error: dlErr } = await supabase.storage
          .from('data-sources')
          .download(src.file_path)
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
    init()
  }, [sourceId])

  const base = `/projects/${projectId}`

  // Loading state
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center font-sans">
        <Loader2 className="w-10 h-10 text-mb-brand animate-spin mx-auto mb-4" />
        <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">Analysing your data</h2>
        <p className="text-mb-text-medium text-mb-sm">
          Checking for missing values, type issues, outliers, and more...
        </p>
        <div className="max-w-sm mx-auto mt-6 space-y-2">
          <div className="h-4 rounded-mb-md bg-mb-bg-medium animate-pulse" />
          <div className="h-4 rounded-mb-md bg-mb-bg-medium animate-pulse w-3/4" />
          <div className="h-4 rounded-mb-md bg-mb-bg-medium animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center font-sans">
        <XCircle className="w-10 h-10 text-mb-error mx-auto mb-4" />
        <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">Could not analyse data</h2>
        <p className="text-mb-text-medium text-mb-sm mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="mb-btn-primary">Try again</button>
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
        <p className="text-mb-xs text-mb-text-light font-bold uppercase tracking-wider mb-1">
          Data Health Report
        </p>
        <h1 className="text-mb-2xl font-black text-mb-text-dark">{sourceName}</h1>
      </div>

      {/* Quality score card */}
      <div className="mb-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-mb-xs font-bold text-mb-text-light uppercase tracking-wider mb-1">Quality Score</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black text-mb-text-dark">{profile.quality_score}</span>
              <span className="text-mb-text-light text-mb-lg font-bold">/100</span>
              <span className={`px-2.5 py-1 rounded-full text-mb-xs font-black ${label.class}`}>
                {label.text}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-mb-xs text-mb-text-light">{profile.total_rows.toLocaleString()} rows</p>
            <p className="text-mb-xs text-mb-text-light">{profile.total_columns} columns</p>
            <p className="text-mb-xs text-mb-text-light">{profile.detected_encoding.toUpperCase()}</p>
          </div>
        </div>

        {/* Quality bar */}
        <div className="w-full h-3 bg-mb-bg-medium rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${qualityColor(profile.quality_score)}`}
            style={{ width: `${profile.quality_score}%` }}
          />
        </div>
      </div>

      {/* Issues found */}
      {hasIssues && (
        <div className="mb-6">
          <p className="mb-section-header mb-3">
            {issueCount} issue{issueCount !== 1 ? 's' : ''} found
          </p>
          <div className="space-y-2">
            {profile.warnings.map((w, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-mb-md border ${severityBg(w.severity)}`}>
                {severityIcon(w.severity)}
                <div className="flex-1">
                  <span className="text-mb-sm font-black text-mb-text-dark">{w.column}</span>
                  <span className="text-mb-sm text-mb-text-medium ml-2">{w.detail}</span>
                  {w.affected_rows != null && (
                    <span className="text-mb-xs text-mb-text-light ml-1">
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
        <p className="mb-section-header mb-3">Column Overview</p>
        <div className="mb-card overflow-hidden">
          <table className="mb-table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Null %</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {profile.columns.map(col => {
                const hasColIssues = col.mixed_types || col.format_issues || col.outlier_count > 0 || col.null_rate > 0.05
                return (
                  <tr key={col.name}>
                    <td className="font-bold text-mb-xs">{col.name}</td>
                    <td>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${DTYPE_COLORS[col.dtype] || DTYPE_COLORS.text}`}>
                        {col.dtype}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-1.5 bg-mb-bg-medium rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${col.null_rate > 0.2 ? 'bg-mb-error' : col.null_rate > 0.05 ? 'bg-orange-400' : 'bg-mb-success'}`}
                            style={{ width: `${Math.min(col.null_rate * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-mb-text-light">{(col.null_rate * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      {hasColIssues ? (
                        <AlertTriangle size={13} className="text-orange-400" />
                      ) : (
                        <CheckCircle2 size={13} className="text-mb-success" />
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
      <div className="border-t border-mb-border pt-6">
        <h2 className="text-mb-lg font-black text-mb-text-dark mb-2">What would you like to do?</h2>
        <p className="text-mb-text-medium text-mb-sm mb-5">
          {hasIssues
            ? 'We found data quality issues. You can clean them before analysis, or explore the raw data.'
            : 'Your data looks clean. You can explore it right away or run the full preparation pipeline.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Clean first */}
          <button
            onClick={() => router.push(`${base}/sources/${sourceId}/prepare`)}
            className={`text-left p-5 rounded-mb-lg border transition-all group
              ${hasIssues ? 'border-mb-brand bg-mb-brand-hover' : 'border-mb-border hover:border-mb-brand hover:bg-mb-brand-hover'}`}
          >
            <div className={`w-10 h-10 rounded-mb-md flex items-center justify-center mb-3
              ${hasIssues ? 'bg-mb-brand' : 'bg-mb-bg-medium group-hover:bg-mb-brand'} transition-colors`}>
              <Wand2 size={18} className={hasIssues ? 'text-white' : 'text-mb-text-light group-hover:text-white'} />
            </div>
            <p className={`text-mb-sm font-black mb-1 ${hasIssues ? 'text-mb-brand' : 'text-mb-text-dark'}`}>
              Clean &amp; prepare first
            </p>
            <p className="text-mb-xs text-mb-text-medium">
              {hasIssues
                ? `Fix ${issueCount} issue${issueCount !== 1 ? 's' : ''} with AI-suggested transformations`
                : 'Run the full pipeline for best results'}
            </p>
            {hasIssues && (redCount > 0 || amberCount > 0) && (
              <p className="text-mb-xs text-mb-text-light mt-2">
                {redCount > 0 && `${redCount} critical`}
                {redCount > 0 && amberCount > 0 && ' · '}
                {amberCount > 0 && `${amberCount} warning${amberCount !== 1 ? 's' : ''}`}
              </p>
            )}
          </button>

          {/* Option 2: Skip, explore raw */}
          <button
            onClick={() => router.push(`${base}/ask`)}
            className="text-left p-5 rounded-mb-lg border border-mb-border hover:border-mb-brand hover:bg-mb-brand-hover transition-all group"
          >
            <div className="w-10 h-10 rounded-mb-md flex items-center justify-center mb-3 bg-mb-bg-medium group-hover:bg-mb-brand transition-colors">
              <MessageSquare size={18} className="text-mb-text-light group-hover:text-white" />
            </div>
            <p className="text-mb-sm font-black text-mb-text-dark mb-1">
              Skip, explore as-is
            </p>
            <p className="text-mb-xs text-mb-text-medium">
              Go straight to Ask Data with the raw dataset
            </p>
            {hasIssues && (
              <p className="text-mb-xs text-mb-text-light mt-2">
                Quality warnings will be shown inline
              </p>
            )}
          </button>
        </div>

        {/* Also link to Insights */}
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push(`${base}/insights`)}
            className="text-mb-xs font-bold text-mb-text-light hover:text-mb-brand transition-colors inline-flex items-center gap-1"
          >
            Or go to AI Insights <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}
