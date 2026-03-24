'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  Loader2, CheckCircle2, AlertTriangle, XCircle,
  ArrowLeft, ArrowRight, ChevronDown, Zap
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { translateValidatorMessage } from '@/lib/i18n/validatorMessages'
import type { QualityWarning } from '@/types/pipeline'

/* ---------- types ---------- */

type Step = 'issues' | 'fix'

interface FixOption {
  warning: QualityWarning
  enabled: boolean
  method: string          // e.g. 'median', 'clip', 'cast_numeric', 'normalize'
  methodOptions: string[] // available choices for dropdown
  label: string           // display label for the fix
}

/* ---------- helpers ---------- */

function severityIcon(s: string) {
  if (s === 'red') return <XCircle size={16} className="text-dl-error flex-shrink-0" />
  if (s === 'amber') return <AlertTriangle size={16} className="text-orange-400 flex-shrink-0" />
  return <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
}

function severityBadge(s: string) {
  if (s === 'red') return 'bg-red-100 text-red-700'
  if (s === 'amber') return 'bg-orange-100 text-orange-700'
  return 'bg-yellow-100 text-yellow-700'
}

function severityBorder(s: string) {
  if (s === 'red') return 'border-red-200 bg-red-50/50'
  if (s === 'amber') return 'border-orange-200 bg-orange-50/50'
  return 'border-yellow-200 bg-yellow-50/50'
}

function issueToFixDefaults(
  issue: string,
): { method: string; options: string[]; category: string } {
  if (issue === 'missing_values' || issue.includes('missing') || issue.includes('null'))
    return { method: 'median', options: ['median', 'mean', 'mode', 'drop'], category: 'fill' }
  if (issue === 'mixed_types' || issue.includes('mixed'))
    return { method: 'cast_numeric', options: ['cast_numeric', 'cast_text'], category: 'cast' }
  if (issue === 'outliers' || issue.includes('outlier'))
    return { method: 'clip', options: ['clip'], category: 'clip' }
  if (issue === 'format_inconsistency' || issue.includes('format') || issue.includes('date'))
    return { method: 'normalize', options: ['normalize'], category: 'normalize' }
  // Fallback
  return { method: 'drop', options: ['drop'], category: 'fill' }
}

function buildTransformSteps(fixes: FixOption[]) {
  return fixes
    .filter(f => f.enabled)
    .map(f => {
      const { category } = issueToFixDefaults(f.warning.issue)
      if (category === 'fill') {
        return {
          operation: f.method === 'drop' ? 'drop_null_rows' : 'fill_missing',
          column: f.warning.column,
          params: f.method === 'drop' ? {} : { strategy: f.method },
        }
      }
      if (category === 'cast') {
        const targetType = f.method === 'cast_numeric' ? 'numeric' : 'text'
        return {
          operation: 'cast_type',
          column: f.warning.column,
          params: { target_type: targetType },
        }
      }
      if (category === 'clip') {
        return {
          operation: 'clip_outliers',
          column: f.warning.column,
          params: { method: 'iqr' },
        }
      }
      // normalize
      return {
        operation: 'normalize_format',
        column: f.warning.column,
        params: { target: 'iso' },
      }
    })
}

/* ---------- component ---------- */

export default function QuickCleanPage() {
  const t = useTranslations()
  const tQc = useTranslations('quickClean')
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const projectId = params.projectId as string
  const sourceId = params.sourceId as string
  const tableName = searchParams.get('table') || ''

  const [step, setStep] = useState<Step>('issues')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<QualityWarning[]>([])
  const [fixes, setFixes] = useState<FixOption[]>([])
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const [newScore, setNewScore] = useState<number | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const overviewUrl = `/projects/${projectId}/sources/${sourceId}/overview`

  /* Step 1: profile the table and extract warnings */
  useEffect(() => {
    if (!tableName) {
      setError('No table specified')
      setLoading(false)
      return
    }

    async function profile() {
      try {
        const res = await fetch('/api/pipeline/profile-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: sourceId, table_name: tableName }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Profiling failed')

        const w: QualityWarning[] = data.warnings || []
        setWarnings(w)

        // Build fix options from warnings
        const fixOpts: FixOption[] = w.map(warning => {
          const defaults = issueToFixDefaults(warning.issue)
          return {
            warning,
            enabled: warning.severity === 'red' || warning.severity === 'amber',
            method: defaults.method,
            methodOptions: defaults.options,
            label: warning.detail,
          }
        })
        setFixes(fixOpts)
      } catch (e: any) {
        setError(e.message || 'Failed to profile table')
      } finally {
        setLoading(false)
      }
    }

    profile()
  }, [sourceId, tableName])

  /* Toggle a fix on/off */
  const toggleFix = useCallback((idx: number) => {
    setFixes(prev => prev.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f))
  }, [])

  /* Change fix method */
  const changeMethod = useCallback((idx: number, method: string) => {
    setFixes(prev => prev.map((f, i) => i === idx ? { ...f, method } : f))
  }, [])

  /* Apply selected fixes */
  async function applyFixes() {
    setApplying(true)
    try {
      const steps = buildTransformSteps(fixes)

      // Call transform API with JSON body for DB transforms
      const res = await fetch('/api/pipeline/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: sourceId,
          table_name: tableName,
          steps,
        }),
      })

      const data = await res.json()

      // Save recipe to pipeline_recipes
      const { data: src } = await supabase
        .from('data_sources')
        .select('project_id, org_id')
        .eq('id', sourceId)
        .single()

      if (src) {
        await supabase.from('pipeline_recipes').insert({
          source_id: sourceId,
          project_id: src.project_id || projectId,
          org_id: src.org_id,
          steps,
          last_run_at: new Date().toISOString(),
          last_run_status: res.ok ? 'success' : 'failed',
          last_quality_score: data.quality_score ?? null,
          last_row_count: data.rows_after ?? null,
        })
      }

      if (!res.ok) throw new Error(data.error || 'Transform failed')

      setNewScore(data.quality_score ?? null)
      setDone(true)
    } catch (e: any) {
      setError(e.message || 'Failed to apply fixes')
    } finally {
      setApplying(false)
    }
  }

  const selectedCount = fixes.filter(f => f.enabled).length

  /* ---- method label helper ---- */
  function methodLabel(method: string): string {
    switch (method) {
      case 'median': return tQc('fillMedian')
      case 'mean': return tQc('fillMean')
      case 'mode': return tQc('fillMode')
      case 'drop': return tQc('fillDrop')
      case 'clip': return tQc('clipOutliers')
      case 'cast_numeric': return tQc('castType', { type: 'numeric' })
      case 'cast_text': return tQc('castType', { type: 'text' })
      case 'normalize': return tQc('normalizeFormat')
      default: return method
    }
  }

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center font-sans">
        <Loader2 className="w-10 h-10 text-dl-brand animate-spin mx-auto mb-4" />
        <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{tQc('title')}</h2>
        <p className="text-dl-text-medium text-dl-sm">{t('common.loading')}</p>
        <div className="max-w-sm mx-auto mt-6 space-y-2">
          <div className="h-4 rounded-dl-md bg-dl-bg-medium animate-pulse" />
          <div className="h-4 rounded-dl-md bg-dl-bg-medium animate-pulse w-3/4" />
          <div className="h-4 rounded-dl-md bg-dl-bg-medium animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  /* ---- Error ---- */
  if (error && !done) {
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

  /* ---- No issues ---- */
  if (warnings.length === 0 && !done) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center font-sans">
        <CheckCircle2 className="w-12 h-12 text-dl-success mx-auto mb-4" />
        <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{tQc('noIssues')}</h2>
        <p className="text-dl-text-medium text-dl-sm mb-6">{tQc('noIssuesDesc')}</p>
        <button onClick={() => router.push(overviewUrl)} className="dl-btn-primary">
          <ArrowLeft size={14} className="mr-2 inline" />
          {tQc('backToOverview')}
        </button>
      </div>
    )
  }

  /* ---- Success state ---- */
  if (done) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-9 h-9 text-dl-success" />
        </div>
        <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{tQc('fixComplete')}</h2>
        {newScore !== null && (
          <p className="text-dl-lg font-bold text-dl-text-medium mb-6">
            {tQc('newScore', { score: newScore })}
          </p>
        )}
        <button onClick={() => router.push(overviewUrl)} className="dl-btn-primary">
          <ArrowLeft size={14} className="mr-2 inline" />
          {tQc('backToOverview')}
        </button>
      </div>
    )
  }

  /* ---- Main 2-step UI ---- */
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 font-sans">

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(overviewUrl)}
          className="inline-flex items-center gap-1.5 text-dl-xs font-bold text-dl-text-light hover:text-dl-brand transition-colors mb-3"
        >
          <ArrowLeft size={13} />
          {tQc('backToOverview')}
        </button>
        <h1 className="text-dl-2xl font-black text-dl-text-dark">{tQc('title')}</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {/* Step 1 */}
        <button
          onClick={() => setStep('issues')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-l-dl-md border text-dl-sm font-black transition-all
            ${step === 'issues'
              ? 'bg-dl-brand text-white border-dl-brand'
              : 'bg-dl-bg-light text-dl-text-medium border-dl-border hover:bg-dl-bg-medium'
            }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-dl-xs font-black
            ${step === 'issues' ? 'bg-white/20 text-white' : 'bg-dl-bg-medium text-dl-text-light'}`}>
            1
          </span>
          {tQc('step1')}
        </button>

        {/* Step 2 */}
        <button
          onClick={() => warnings.length > 0 && setStep('fix')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-r-dl-md border border-l-0 text-dl-sm font-black transition-all
            ${step === 'fix'
              ? 'bg-dl-brand text-white border-dl-brand'
              : 'bg-dl-bg-light text-dl-text-medium border-dl-border hover:bg-dl-bg-medium'
            }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-dl-xs font-black
            ${step === 'fix' ? 'bg-white/20 text-white' : 'bg-dl-bg-medium text-dl-text-light'}`}>
            2
          </span>
          {tQc('step2')}
        </button>
      </div>

      {/* ===== STEP 1: Issues ===== */}
      {step === 'issues' && (
        <div>
          <h2 className="text-dl-lg font-black text-dl-text-dark mb-5">
            {tQc('issuesIn', { count: warnings.length, table: tableName })}
          </h2>

          <div className="space-y-3 mb-8">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={`dl-card p-4 border ${severityBorder(w.severity)}`}
              >
                <div className="flex items-start gap-3">
                  {severityIcon(w.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-dl-sm font-black text-dl-text-dark">{w.column}</span>
                      <span className={`px-2 py-0.5 rounded-full text-dl-xs font-black ${severityBadge(w.severity)}`}>
                        {w.severity}
                      </span>
                    </div>
                    <p className="text-dl-sm text-dl-text-medium">
                      {translateValidatorMessage(w.detail, (key, params) => t(key, params))}
                    </p>
                    {w.affected_rows != null && w.affected_rows > 0 && (
                      <p className="text-dl-xs text-dl-text-light mt-1">
                        {tQc('affectedRows', { count: w.affected_rows.toLocaleString() })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('fix')}
            className="dl-btn-primary w-full inline-flex items-center justify-center gap-2"
          >
            <Zap size={16} />
            {tQc('fixIssues')}
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ===== STEP 2: Fix ===== */}
      {step === 'fix' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-dl-lg font-black text-dl-text-dark">
              {tQc('step2')}
            </h2>
            <span className="text-dl-xs font-bold text-dl-text-medium px-3 py-1.5 bg-dl-bg-medium rounded-full">
              {tQc('selectFixes', { selected: selectedCount, total: fixes.length })}
            </span>
          </div>

          <div className="space-y-3 mb-8">
            {fixes.map((fix, i) => {
              const { category } = issueToFixDefaults(fix.warning.issue)
              return (
                <div
                  key={i}
                  className={`dl-card p-4 border transition-all ${
                    fix.enabled ? 'border-dl-brand bg-dl-brand-hover/30' : 'border-dl-border opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleFix(i)}
                      className={`relative w-10 h-5 rounded-full flex-shrink-0 mt-0.5 transition-colors ${
                        fix.enabled ? 'bg-dl-brand' : 'bg-dl-bg-dark'
                      }`}
                      role="switch"
                      aria-checked={fix.enabled}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          fix.enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-dl-sm font-black text-dl-text-dark">{fix.warning.column}</span>
                        <span className={`px-2 py-0.5 rounded-full text-dl-xs font-black ${severityBadge(fix.warning.severity)}`}>
                          {fix.warning.severity}
                        </span>
                      </div>
                      <p className="text-dl-xs text-dl-text-medium mb-2">
                        {translateValidatorMessage(fix.warning.detail, (key, params) => t(key, params))}
                      </p>

                      {/* Method selector */}
                      {fix.methodOptions.length > 1 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-dl-xs font-bold text-dl-text-light">
                            {category === 'fill' ? tQc('fillMethod') : tQc('castType', { type: '' }).replace(/ $/, '')}:
                          </span>
                          <div className="relative">
                            <select
                              value={fix.method}
                              onChange={e => changeMethod(i, e.target.value)}
                              disabled={!fix.enabled}
                              className="dl-input text-dl-xs py-1 pl-2 pr-7 appearance-none"
                            >
                              {fix.methodOptions.map(opt => (
                                <option key={opt} value={opt}>{methodLabel(opt)}</option>
                              ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-dl-text-light pointer-events-none" />
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-dl-xs font-bold text-dl-brand bg-dl-brand-hover px-2 py-1 rounded-dl-sm">
                          {methodLabel(fix.method)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Apply button */}
          <button
            onClick={applyFixes}
            disabled={applying || selectedCount === 0}
            className="dl-btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {tQc('applying')}
              </>
            ) : (
              <>
                <Zap size={16} />
                {tQc('applyFixes')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
