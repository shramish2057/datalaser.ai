'use client'
import { useTranslations } from 'next-intl'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  ArrowRight, ChevronDown, ChevronUp, Check, X,
  BarChart2, Sparkles, Wand2, Shield, Rocket
} from 'lucide-react'
import type {
  PipelineStep, DataProfile, TransformSuggestion,
  TransformResult, ValidationReport, TransformStep
} from '@/types/pipeline'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STEP_INDEX: Record<PipelineStep, number> = { profile: 0, suggest: 1, transform: 2, validate: 3, ready: 4 }

const OP_COLORS: Record<string, string> = {
  fill_null: 'bg-blue-100 text-blue-700',
  drop_column: 'bg-red-100 text-red-700',
  clip_outliers: 'bg-orange-100 text-orange-700',
  one_hot_encode: 'bg-purple-100 text-purple-700',
  cast_type: 'bg-teal-100 text-teal-700',
  drop_null_rows: 'bg-red-100 text-red-700',
  deduplicate: 'bg-yellow-100 text-yellow-700',
}

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

function severityClass(s: string) {
  if (s === 'red') return 'border-dl-error bg-red-50'
  if (s === 'amber') return 'border-orange-400 bg-orange-50'
  return 'border-yellow-400 bg-yellow-50'
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PreparePage() {
  const t = useTranslations()

  const STEPS: { key: PipelineStep; label: string; icon: typeof BarChart2 }[] = [
    { key: 'profile', label: t('prep.stepProfile'), icon: BarChart2 },
    { key: 'suggest', label: t('prep.stepSuggestions'), icon: Sparkles },
    { key: 'transform', label: t('prep.stepTransform'), icon: Wand2 },
    { key: 'validate', label: t('prep.stepValidate'), icon: Shield },
    { key: 'ready', label: t('prep.stepReady'), icon: Rocket },
  ]

  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const sourceId = params.sourceId as string

  const [step, setStep] = useState<PipelineStep>('profile')
  const [profile, setProfile] = useState<DataProfile | null>(null)
  const [suggestions, setSuggestions] = useState<TransformSuggestion[]>([])
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<TransformResult | null>(null)
  const [validation, setValidation] = useState<ValidationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceFile, setSourceFile] = useState<{ name: string; bytes: Blob } | null>(null)
  const [sourceType, setSourceType] = useState('')
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set())
  const [dbTableName, setDbTableName] = useState('')
  const fileRef = useRef<File | null>(null)
  const transformedFileRef = useRef<Blob | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const DB_TYPES = ['postgres', 'mysql', 'mssql', 'mongodb', 'sqlite', 'snowflake', 'bigquery', 'redshift', 'databricks']
  const FILE_TYPES = ['csv', 'xlsx', 'xls', 'json', 'parquet', 'file']

  /** Get cached file or download from Storage */
  const getFile = useCallback(async (fileName: string, filePath: string | null): Promise<File | null> => {
    // Return cached if available
    if (fileRef.current) return fileRef.current

    // Try Storage download
    if (filePath) {
      console.log('[Prepare] Downloading from Storage:', filePath)
      const { data: blob, error: dlError } = await supabase.storage
        .from('data-sources')
        .download(filePath)
      if (dlError) {
        console.error('[Prepare] Storage download failed:', dlError.message)
      }
      if (!dlError && blob) {
        console.log('[Prepare] Storage download OK, size:', blob.size)
        const file = new File([blob], fileName, { type: blob.type || 'text/csv' })
        fileRef.current = file
        return file
      }
    } else {
      console.log('[Prepare] No file_path on source record, falling back to sample_data')
    }

    // Fallback: reconstruct from sample_data
    const { data: src } = await supabase
      .from('data_sources')
      .select('*')
      .eq('id', sourceId)
      .single()

    if (src) {
      const sample = src.sample_data as { tables?: { columns: string[]; rows: string[][] }[] } | null
      if (sample?.tables?.[0]) {
        const cols = sample.tables[0].columns
        const rows = sample.tables[0].rows
        const csvContent = [cols.join(','), ...rows.map(r => r.join(','))].join('\n')
        const file = new File([csvContent], fileName, { type: 'text/csv' })
        fileRef.current = file
        return file
      }
    }

    return null
  }, [sourceId, supabase])

  // Load source info + file on mount, then auto-profile
  useEffect(() => {
    async function init() {
      const { data: src, error: srcErr } = await supabase
        .from('data_sources')
        .select('*')
        .eq('id', sourceId)
        .single()

      if (!src) { setError(srcErr ? `Source error: ${srcErr.message}` : 'Data source not found'); return }
      setSourceType(src.source_type as string)

      if (FILE_TYPES.includes(src.source_type)) {
        const file = await getFile(src.name, src.file_path)
        if (file) {
          setSourceFile({ name: file.name, bytes: file })
          runProfile(file, file.name)
        } else {
          setError('Could not load file. Please re-upload the data source.')
        }
      } else if (DB_TYPES.includes(src.source_type)) {
        // Database source — show table selection UI (handled in render)
      } else {
        setError('Unsupported source type for preparation.')
      }
    }
    init()
  }, [sourceId])

  // ── API calls ──────────────────────────────────────────────

  const runProfile = async (blob: Blob, fileName: string) => {
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', blob, fileName)
      fd.append('source_id', sourceId)
      const res = await fetch('/api/pipeline/profile', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Profiling failed')
      setProfile(data)
      setStep('profile')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profiling failed')
    } finally {
      setLoading(false)
    }
  }

  const profileDbTable = async () => {
    if (!dbTableName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pipeline/profile-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: sourceId,
          connection_string: '', // Will be resolved server-side from encrypted_credentials
          table_name: dbTableName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Database profiling failed')
      setProfile(data)
      setStep('profile')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Database profiling failed')
    } finally {
      setLoading(false)
    }
  }

  const runSuggestions = async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    setStep('suggest')
    try {
      const res = await fetch('/api/pipeline/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Suggestion generation failed')
      const sugs = data.suggestions || []
      setSuggestions(sugs)
      setAccepted(new Set(sugs.map((s: TransformSuggestion) => s.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suggestion generation failed')
    } finally {
      setLoading(false)
    }
  }

  const runTransform = async () => {
    if (!sourceFile || accepted.size === 0) return
    setLoading(true)
    setError(null)
    setStep('transform')
    try {
      const steps: TransformStep[] = suggestions
        .filter(s => accepted.has(s.id))
        .sort((a, b) => a.priority - b.priority)
        .map(s => ({ id: s.id, operation: s.operation, column: s.column, params: s.params }))

      const fd = new FormData()
      fd.append('file', sourceFile.bytes, sourceFile.name)
      fd.append('steps', JSON.stringify(steps))
      fd.append('source_id', sourceId)
      fd.append('file_type', sourceFile.name.split('.').pop() || 'csv')

      const res = await fetch('/api/pipeline/transform', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Transform failed')
      setResult(data)

      // Store transformed CSV for validation step
      console.log('[Prepare] Transform response has transformed_csv_b64:', !!data.transformed_csv_b64,
        data.transformed_csv_b64 ? `(${data.transformed_csv_b64.length} chars)` : '')
      if (data.transformed_csv_b64) {
        const binaryStr = atob(data.transformed_csv_b64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
        transformedFileRef.current = new Blob([bytes], { type: 'text/csv' })
        console.log('[Prepare] Transformed blob size:', transformedFileRef.current.size)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transform failed')
    } finally {
      setLoading(false)
    }
  }

  const runValidation = async () => {
    if (!sourceFile) return
    setLoading(true)
    setError(null)
    setStep('validate')
    try {
      // Use transformed file if available, otherwise original
      const fileToValidate = transformedFileRef.current || sourceFile.bytes
      console.log('[Prepare] Validating:', transformedFileRef.current ? 'TRANSFORMED file' : 'ORIGINAL file',
        'size:', fileToValidate instanceof Blob ? fileToValidate.size : 'unknown')
      const fd = new FormData()
      fd.append('file', fileToValidate, sourceFile.name)
      fd.append('source_id', sourceId)
      const res = await fetch('/api/pipeline/validate', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Validation failed')
      setValidation(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setLoading(false)
    }
  }

  const finishPipeline = async () => {
    setStep('ready')
    try {
      const { data: proj } = await supabase
        .from('projects').select('org_id').eq('id', projectId).single()

      const acceptedSteps = suggestions
        .filter(s => accepted.has(s.id))
        .sort((a, b) => a.priority - b.priority)
        .map(s => ({ id: s.id, operation: s.operation, column: s.column, params: s.params }))

      const { data: recipe } = await supabase
        .from('pipeline_recipes')
        .upsert({
          source_id: sourceId,
          project_id: projectId,
          org_id: proj?.org_id,
          steps: acceptedSteps,
          last_run_at: new Date().toISOString(),
          last_run_status: 'success',
          last_quality_score: validation?.score ?? null,
          last_row_count: result?.rows_after ?? null,
        }, { onConflict: 'source_id' })
        .select()
        .single()

      if (recipe) {
        // Upload cleaned CSV to Storage
        let cleanedPath: string | null = null
        if (transformedFileRef.current) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const fileName = sourceFile?.name || 'cleaned.csv'
            cleanedPath = `${user.id}/${sourceId}/cleaned_${fileName}`
            await supabase.storage
              .from('data-sources')
              .upload(cleanedPath, transformedFileRef.current, {
                contentType: 'text/csv', upsert: true,
              })
          }
        }

        await supabase.from('data_sources').update({
          pipeline_status: 'ready',
          pipeline_recipe_id: recipe.id,
          ...(cleanedPath ? { cleaned_file_path: cleanedPath } : {}),
        }).eq('id', sourceId)

        await supabase.from('pipeline_run_history').insert({
          recipe_id: recipe.id,
          source_id: sourceId,
          status: 'success',
          quality_score: validation?.score,
          rows_processed: result?.rows_after,
          rows_before: result?.rows_before,
          rows_after: result?.rows_after,
          transformations_applied: acceptedSteps.length,
          tests_passed: validation?.tests.filter(t => t.status === 'passed').length ?? 0,
          tests_failed: validation?.tests.filter(t => t.status === 'failed').length ?? 0,
          completed_at: new Date().toISOString(),
        })
      }
      localStorage.setItem(`pipeline-ready-${sourceId}`, 'true')
    } catch (e) {
      console.error('Failed to save pipeline recipe:', e)
      localStorage.setItem(`pipeline-ready-${sourceId}`, 'true')
    }
  }

  const base = `/projects/${projectId}`

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full font-sans">
      {/* Stepper */}
      <div className="bg-dl-bg border-b border-dl-border px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {STEPS.map((s, i) => {
            const idx = STEP_INDEX[s.key]
            const currentIdx = STEP_INDEX[step]
            const done = idx < currentIdx
            const active = idx === currentIdx
            const Icon = s.icon
            return (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-dl-xs font-black
                    ${done ? 'bg-dl-success text-white' : active ? 'bg-dl-brand text-white' : 'bg-dl-bg-medium text-dl-text-light'}
                  `}>
                    {done ? <Check size={14} /> : i + 1}
                  </div>
                  <span className={`text-dl-xs font-bold hidden sm:block ${active ? 'text-dl-brand' : 'text-dl-text-light'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${done ? 'bg-dl-success' : 'bg-dl-border'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-dl-error px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-dl-error text-dl-sm font-bold">
            <XCircle size={16} />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-dl-error hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">

          {/* DATABASE TABLE SELECTION */}
          {step === 'profile' && !loading && !profile && DB_TYPES.includes(sourceType) && (
            <div className="max-w-md mx-auto py-12">
              <div className="dl-card p-6">
                <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">{t('prep.selectTable')}</h2>
                <p className="text-dl-text-medium text-dl-sm mb-4">
                  {t('prep.selectTableDesc')}
                </p>
                <div className="mb-4">
                  <label className="dl-label">{t('prep.tableName')}</label>
                  <input
                    className="dl-input"
                    placeholder={t('prep.tableNamePlaceholder')}
                    value={dbTableName}
                    onChange={e => setDbTableName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && dbTableName.trim() && profileDbTable()}
                  />
                </div>
                <button
                  onClick={profileDbTable}
                  disabled={!dbTableName.trim()}
                  className={`dl-btn-primary w-full justify-center ${!dbTableName.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {t('prep.profileTable')}
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: PROFILE */}
          {step === 'profile' && (DB_TYPES.includes(sourceType) ? !!profile : true) && (
            loading ? (
              <div className="space-y-4 py-12 text-center">
                <Loader2 className="w-8 h-8 text-dl-brand animate-spin mx-auto" />
                <p className="text-dl-text-medium text-dl-sm font-bold">{t('prep.analysing')}</p>
                <div className="max-w-md mx-auto space-y-2">
                  <div className="h-6 rounded-dl-md bg-dl-bg-medium animate-pulse" />
                  <div className="h-6 rounded-dl-md bg-dl-bg-medium animate-pulse" />
                  <div className="h-6 rounded-dl-md bg-dl-bg-medium animate-pulse" />
                </div>
              </div>
            ) : profile ? (
              <div>
                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: t('prep.totalRows'), value: profile.total_rows.toLocaleString() },
                    { label: t('prep.columns'), value: profile.total_columns },
                    { label: t('prep.qualityScore'), value: `${profile.quality_score}/100` },
                    { label: t('prep.encoding'), value: profile.detected_encoding.toUpperCase() },
                  ].map(s => (
                    <div key={s.label} className="bg-dl-bg border border-dl-border rounded-dl-lg p-4">
                      <p className="text-dl-xs font-bold text-dl-text-light uppercase tracking-wider mb-1">{s.label}</p>
                      <p className="text-dl-xl font-black text-dl-text-dark">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Quality bar */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-dl-xs font-bold text-dl-text-light uppercase tracking-wider">{t("common.quality")}</p>
                    <span className={`mb-badge-${profile.quality_level === 'good' ? 'success' : profile.quality_level === 'red' ? 'error' : 'warning'}`}>
                      {profile.quality_level}
                    </span>
                  </div>
                  <div className="w-[200px] h-2 bg-dl-bg-medium rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${qualityColor(profile.quality_score)}`}
                      style={{ width: `${profile.quality_score}%` }} />
                  </div>
                </div>

                {/* Column profiles table */}
                <div className="dl-card overflow-hidden mb-6">
                  <table className="dl-table">
                    <thead>
                      <tr>
                        <th>{t("common.column")}</th>
                        <th>{t("common.type")}</th>
                        <th>{t("common.nullRate")}</th>
                        <th>{t("common.unique")}</th>
                        <th>{t("common.min")}</th>
                        <th>{t("common.max")}</th>
                        <th>{t("common.issues")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.columns.map(col => (
                        <tr key={col.name}>
                          <td className="font-bold">{col.name}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-dl-xs font-bold ${DTYPE_COLORS[col.dtype] || DTYPE_COLORS.text}`}>
                              {col.dtype}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-dl-bg-medium rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${col.null_rate > 0.2 ? 'bg-dl-error' : col.null_rate > 0.05 ? 'bg-orange-400' : 'bg-dl-success'}`}
                                  style={{ width: `${Math.min(col.null_rate * 100, 100)}%` }} />
                              </div>
                              <span className="text-dl-xs text-dl-text-medium">{(col.null_rate * 100).toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="text-dl-text-medium text-dl-xs">{(col.unique_rate * 100).toFixed(0)}%</td>
                          <td className="text-dl-text-medium text-dl-xs font-mono">{col.min_value ?? '—'}</td>
                          <td className="text-dl-text-medium text-dl-xs font-mono">{col.max_value ?? '—'}</td>
                          <td>
                            {(col.mixed_types || col.format_issues || col.outlier_count > 0) ? (
                              <AlertTriangle size={14} className="text-orange-400" />
                            ) : (
                              <CheckCircle2 size={14} className="text-dl-success" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Warnings */}
                {profile.warnings.length > 0 && (
                  <div className="mb-6 space-y-2">
                    <p className="dl-section-header mb-2">{t('health.warnings')}</p>
                    {profile.warnings.map((w, i) => (
                      <div key={i} className={`border rounded-dl-md p-3 flex items-start gap-2 ${severityClass(w.severity)}`}>
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-dl-text-medium" />
                        <div>
                          <span className="text-dl-xs font-black text-dl-text-dark">{w.column}</span>
                          <span className="text-dl-xs text-dl-text-medium ml-2">{w.detail}</span>
                          {w.affected_rows != null && (
                            <span className="text-dl-xs text-dl-text-light ml-1">({w.affected_rows} rows)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={runSuggestions} className="dl-btn-primary px-6 py-2.5 font-black">
                  {t('prep.viewSuggestions')} <ArrowRight size={14} />
                </button>
              </div>
            ) : null
          )}

          {/* STEP 2: SUGGESTIONS */}
          {step === 'suggest' && (
            loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 text-dl-brand animate-spin mx-auto mb-3" />
                <p className="text-dl-text-dark text-dl-sm font-bold">{t('prep.claudeAnalysing')}</p>
                <p className="text-dl-text-light text-dl-xs mt-1">{t('prep.generatingSuggestions')}</p>
              </div>
            ) : (
              <div>
                <h2 className="text-dl-xl font-black text-dl-text-dark mb-4">{t('prep.suggestedTransforms')}</h2>
                <div className="space-y-3 mb-6">
                  {suggestions.map(s => {
                    const isAccepted = accepted.has(s.id)
                    return (
                      <div key={s.id} className={`border rounded-dl-lg p-4 transition-all ${isAccepted ? 'border-dl-brand bg-dl-brand-hover' : 'border-dl-border bg-dl-bg'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-dl-xs font-black text-dl-text-light">#{s.priority}</span>
                              <span className={`px-2 py-0.5 rounded text-dl-xs font-bold ${OP_COLORS[s.operation] || 'bg-dl-bg-medium text-dl-text-medium'}`}>
                                {s.operation}
                              </span>
                              {s.column && <span className="text-dl-xs font-mono text-dl-text-dark">{s.column}</span>}
                            </div>
                            <p className="text-dl-sm text-dl-text-dark">{s.reason}</p>
                            <p className="text-dl-xs text-dl-text-light mt-1">{s.impact}</p>
                            {/* Confidence bar */}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="w-24 h-1.5 bg-dl-bg-medium rounded-full overflow-hidden">
                                <div className="h-full bg-dl-brand rounded-full" style={{ width: `${s.confidence * 100}%` }} />
                              </div>
                              <span className="text-dl-xs text-dl-text-light">{Math.round(s.confidence * 100)}%</span>
                            </div>
                            {s.before_sample && s.after_sample && (
                              <div className="flex items-center gap-2 mt-2 text-dl-xs font-mono text-dl-text-light">
                                <span>{JSON.stringify(s.before_sample?.slice(0, 3))}</span>
                                <ArrowRight size={10} />
                                <span>{JSON.stringify(s.after_sample?.slice(0, 3))}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const next = new Set(accepted)
                              isAccepted ? next.delete(s.id) : next.add(s.id)
                              setAccepted(next)
                            }}
                            className={`px-3 py-1.5 rounded-dl-md text-dl-xs font-bold transition-colors flex items-center gap-1
                              ${isAccepted
                                ? 'bg-dl-success text-white'
                                : 'border border-dl-border text-dl-text-medium hover:border-dl-brand'}`}
                          >
                            {isAccepted ? <><Check size={12} /> {t('prep.accepted')}</> : t('prep.accept')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-dl-text-medium text-dl-sm">
                    {t('prep.acceptedOf', { accepted: accepted.size, total: suggestions.length })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAccepted(new Set(suggestions.map(s => s.id)))}
                      className="dl-btn-secondary text-dl-xs"
                    >
                      {t('prep.acceptAll')}
                    </button>
                    <button
                      onClick={runTransform}
                      disabled={accepted.size === 0}
                      className={`dl-btn-primary px-6 py-2 font-black ${accepted.size === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {t('prep.runTransformations', { count: accepted.size })} <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}

          {/* STEP 3: TRANSFORM */}
          {step === 'transform' && (
            loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 text-dl-brand animate-spin mx-auto mb-3" />
                <p className="text-dl-text-dark text-dl-sm font-bold">{t('prep.applyingTransformations')}</p>
              </div>
            ) : result ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-dl-2xl font-black text-dl-text-dark font-mono">{result.rows_before.toLocaleString()}</span>
                  <ArrowRight size={20} className="text-dl-text-light" />
                  <span className="text-dl-2xl font-black text-dl-text-dark font-mono">{result.rows_after.toLocaleString()}</span>
                  <span className="text-dl-text-medium text-dl-sm">{t('prep.rows')}</span>
                </div>

                {/* Lineage log */}
                <div className="mb-6 space-y-1">
                  {result.lineage.map((l: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-dl-xs">
                      <CheckCircle2 size={14} className="text-dl-success" />
                      <span className="font-bold text-dl-text-dark">{String(l.operation)}</span>
                      {l.column ? <span className="text-dl-text-light">on {String(l.column)}</span> : null}
                      <span className="text-dl-text-light">— {String(l.rows_affected ?? 0)} rows affected</span>
                    </div>
                  ))}
                  {result.errors.map((e, i) => (
                    <div key={`err-${i}`} className="flex items-center gap-2 text-dl-xs text-dl-error">
                      <XCircle size={14} />
                      <span className="font-bold">{e.operation}</span>
                      <span>{e.error}</span>
                    </div>
                  ))}
                </div>

                {/* Preview table */}
                {result.preview.length > 0 && (
                  <div className="dl-card overflow-x-auto mb-6">
                    <table className="dl-table">
                      <thead>
                        <tr>
                          {result.columns.map(c => <th key={c}>{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {result.preview.map((row, i) => (
                          <tr key={i}>
                            {result.columns.map(c => (
                              <td key={c} className="text-dl-xs font-mono whitespace-nowrap">
                                {String(row[c] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button onClick={runValidation} className="dl-btn-primary px-6 py-2.5 font-black">
                  {t('prep.validateData')} <ArrowRight size={14} />
                </button>
              </div>
            ) : null
          )}

          {/* STEP 4: VALIDATE */}
          {step === 'validate' && (
            loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 text-dl-brand animate-spin mx-auto mb-3" />
                <p className="text-dl-text-dark text-dl-sm font-bold">{t('prep.runningQualityChecks')}</p>
              </div>
            ) : validation ? (
              (() => {
                const issues = validation.tests.filter(t => t.category === 'issue' && t.status !== 'passed')
                const characteristics = validation.tests.filter(t => t.category === 'characteristic')
                const fixableResolved = (validation as unknown as { fixable_resolved?: boolean }).fixable_resolved ?? issues.length === 0

                return (
                <div>
                  {/* Status banner */}
                  <div className={`rounded-dl-lg p-4 mb-6 flex items-center gap-3 ${
                    fixableResolved ? 'bg-green-50 border border-dl-success' :
                    validation.overall_status === 'warning' ? 'bg-orange-50 border border-orange-400' :
                    validation.overall_status === 'failed' ? 'bg-red-50 border border-dl-error' :
                    'bg-green-50 border border-dl-success'
                  }`}>
                    {fixableResolved ? <CheckCircle2 size={20} className="text-dl-success" /> :
                     validation.overall_status === 'warning' ? <AlertTriangle size={20} className="text-orange-400" /> :
                     <XCircle size={20} className="text-dl-error" />}
                    <div>
                      <p className="text-dl-sm font-black text-dl-text-dark">{validation.summary}</p>
                      <p className="text-dl-xs text-dl-text-medium">Score: {validation.score}/100</p>
                    </div>
                  </div>

                  {/* Issues (if any) */}
                  {issues.length > 0 && (
                    <div className="mb-6">
                      <p className="dl-section-header mb-2">{t('prep.issuesToFix')}</p>
                      <div className="space-y-2">
                        {issues.map((t, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-dl-md border border-dl-error bg-red-50">
                            <XCircle size={14} className="text-dl-error flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-dl-xs font-black text-dl-text-dark">{t.column || 'Dataset'}</span>
                              <span className="text-dl-xs text-dl-text-medium ml-2">{t.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Characteristics */}
                  {characteristics.length > 0 && (
                    <div className="mb-6">
                      <p className="dl-section-header mb-2">{t('prep.dataCharacteristics')}</p>
                      <div className="space-y-2">
                        {characteristics.map((t, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-dl-md border border-dl-border bg-dl-bg-light">
                            <AlertTriangle size={13} className="text-dl-text-light flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-dl-xs font-bold text-dl-text-dark">{t.column || 'Dataset'}</span>
                              <span className="text-dl-xs text-dl-text-medium ml-2">{t.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full test table (collapsed by default) */}
                  <details className="mb-6">
                    <summary className="text-dl-xs font-bold text-dl-text-light cursor-pointer hover:text-dl-brand">
                      {t('prep.viewAllChecks', { count: validation.tests.length })}
                    </summary>
                    <div className="dl-card overflow-hidden mt-2">
                      <table className="dl-table">
                        <thead>
                          <tr><th>{t("common.test")}</th><th>{t("common.column")}</th><th>{t("common.status")}</th><th>{t("common.message")}</th></tr>
                        </thead>
                        <tbody>
                          {validation.tests.map((t, i) => (
                            <tr key={i}>
                              <td className="font-bold text-dl-xs">{t.test_name}</td>
                              <td className="text-dl-text-medium text-dl-xs">{t.column || '—'}</td>
                              <td>
                                <span className={
                                  t.status === 'passed' ? 'dl-badge-success' :
                                  t.status === 'warning' ? 'dl-badge-warning' : 'dl-badge-error'
                                }>{t.status}</span>
                              </td>
                              <td className="text-dl-xs text-dl-text-medium">{t.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>

                  <div className="flex gap-2">
                    {!fixableResolved ? (
                      <>
                        <button onClick={() => setStep('suggest')} className="dl-btn-secondary">{t('prep.fixIssuesBtn')}</button>
                        <button onClick={finishPipeline} className="dl-btn-subtle">{t('prep.useAnyway')}</button>
                      </>
                    ) : (
                      <button onClick={finishPipeline} className="dl-btn-primary px-6 py-2.5 font-black">
                        {t('prep.useThisData')} <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
                )
              })()
            ) : null
          )}

          {/* STEP 5: READY */}
          {step === 'ready' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-[scale-in_0.3s_ease-out]">
                <CheckCircle2 size={40} className="text-dl-success" />
              </div>
              <h2 className="text-dl-2xl font-black text-dl-text-dark mb-2">{t('prep.dataPipelineReady')}</h2>
              {profile && (
                <p className="text-dl-text-medium text-dl-sm mb-2">
                  Quality score: <span className="font-black">{profile.quality_score}/100</span>
                </p>
              )}
              {result && (
                <p className="text-dl-text-light text-dl-xs mb-6">
                  {result.rows_after.toLocaleString()} rows &middot; {result.columns.length} columns &middot; {result.lineage.length} transformations applied
                </p>
              )}

              {/* Summary of changes */}
              {result && result.lineage.length > 0 && (
                <div className="dl-card p-4 text-left max-w-md mx-auto mb-8">
                  <p className="dl-section-header mb-2">{t('prep.whatWasCleaned')}</p>
                  <ul className="space-y-1">
                    {result.lineage.map((l: Record<string, unknown>, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-dl-xs text-dl-text-medium">
                        <Check size={12} className="text-dl-success flex-shrink-0" />
                        <span><span className="font-bold text-dl-text-dark">{String(l.column || 'Dataset')}</span>: {String(l.operation)} ({String(l.rows_affected ?? 0)} rows)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button onClick={() => router.push(`${base}/insights`)} className="dl-btn-primary px-6 py-2.5 font-black">
                  {t('prep.goToInsights')} <ArrowRight size={14} />
                </button>
                <button onClick={() => router.push(`${base}/ask`)} className="dl-btn-secondary px-6 py-2.5">
                  {t('prep.askQuestions')}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
