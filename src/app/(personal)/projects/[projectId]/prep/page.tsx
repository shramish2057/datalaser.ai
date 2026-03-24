'use client'
import { useTranslations } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import {
  Wand2, CheckCircle2, Clock, History,
  RefreshCw, BarChart2, ArrowRight, UploadCloud,
  Trash2, X
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type SourceRow = {
  id: string
  name: string
  source_type: string
  row_count: number
  pipeline_status: string | null
  pipeline_recipe_id: string | null
  created_at: string
}

type RecipeInfo = {
  id: string
  last_run_at: string | null
  last_quality_score: number | null
  last_row_count: number | null
  steps: unknown[]
}

type RunRecord = {
  id: string
  source_id: string
  started_at: string
  completed_at: string | null
  status: string
  quality_score: number | null
  rows_before: number | null
  rows_after: number | null
  transformations_applied: number | null
}

type Tab = 'cleaned' | 'prepare' | 'history'

export default function DataPrepPage() {
  const t = useTranslations()
  const [tab, setTab] = useState<Tab>('cleaned')
  const [sources, setSources] = useState<SourceRow[]>([])
  const [recipes, setRecipes] = useState<Record<string, RecipeInfo>>({})
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<{ file: File; text: string; rows: number } | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const base = `/projects/${projectId}`

  const loadData = useCallback(async () => {
    const { data: srcList } = await supabase
      .from('data_sources')
      .select('id, name, source_type, row_count, pipeline_status, pipeline_recipe_id, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    setSources(srcList ?? [])

    const recipeIds = (srcList ?? [])
      .filter(s => s.pipeline_recipe_id)
      .map(s => s.pipeline_recipe_id!)

    if (recipeIds.length > 0) {
      const { data: recipeList } = await supabase
        .from('pipeline_recipes')
        .select('id, last_run_at, last_quality_score, last_row_count, steps')
        .in('id', recipeIds)

      const map: Record<string, RecipeInfo> = {}
      for (const r of recipeList ?? []) map[r.id] = r
      setRecipes(map)

      const { data: runList } = await supabase
        .from('pipeline_run_history')
        .select('id, source_id, started_at, completed_at, status, quality_score, rows_before, rows_after, transformations_applied')
        .in('recipe_id', recipeIds)
        .order('started_at', { ascending: false })
        .limit(30)
      setRuns(runList ?? [])
    }

    setLoading(false)
  }, [projectId, supabase])

  useEffect(() => { loadData() }, [loadData])

  const cleanedSources = sources.filter(s => s.pipeline_status === 'ready' || s.pipeline_status === 'scheduled')
  const unpreparedSources = sources.filter(s => !s.pipeline_status || s.pipeline_status === 'unprepared')
  const sourceNames = Object.fromEntries(sources.map(s => [s.id, s.name]))
  const existingNames = new Set(sources.map(s => s.name))

  // Auto-select tab
  useEffect(() => {
    if (!loading) {
      if (cleanedSources.length > 0) setTab('cleaned')
      else if (unpreparedSources.length > 0) setTab('prepare')
    }
  }, [loading])

  // ── Auto-dedup name ────────────────────────────────────────

  function getUniqueName(baseName: string): string {
    if (!existingNames.has(baseName)) return baseName
    let i = 2
    const ext = baseName.includes('.') ? '.' + baseName.split('.').pop() : ''
    const stem = ext ? baseName.slice(0, -ext.length) : baseName
    while (existingNames.has(`${stem} (${i})${ext}`)) i++
    return `${stem} (${i})${ext}`
  }

  // ── File upload ────────────────────────────────────────────

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setUploadError('')

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'json', 'xlsx', 'xls', 'parquet'].includes(ext || '')) {
      setUploadError('Unsupported file type. Use CSV, JSON, Excel, or Parquet.')
      return
    }

    if (ext === 'csv') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const result = Papa.parse(text, { header: false, skipEmptyLines: true })
        const rowCount = Math.max(0, (result.data as string[][]).length - 1)
        setUploadedFile({ file, text, rows: rowCount })
        setSourceName(getUniqueName(file.name))
      }
      reader.readAsText(file)
    } else {
      // For non-CSV, just store the file
      setUploadedFile({ file, text: '', rows: 0 })
      setSourceName(getUniqueName(file.name))
    }
  }, [existingNames])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  })

  const handleStartPrep = async () => {
    if (!uploadedFile || !sourceName.trim()) return
    setSaving(true)
    setUploadError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Ensure profile exists
      await supabase.from('profiles').upsert({
        id: user.id,
        workspace_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Workspace',
      })

      const { data: proj } = await supabase
        .from('projects').select('org_id').eq('id', projectId).single()

      const ext = uploadedFile.file.name.split('.').pop()?.toLowerCase() || 'csv'

      // Parse columns from CSV for schema
      let schemaSnapshot = {}
      let sampleData = {}
      if (uploadedFile.text) {
        const parsed = Papa.parse(uploadedFile.text, { header: false, skipEmptyLines: true })
        const allRows = parsed.data as string[][]
        const headers = allRows[0] || []
        const dataRows = allRows.slice(1)
        const tableName = sourceName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')

        schemaSnapshot = {
          database_name: sourceName,
          tables: [{ name: tableName, row_count: dataRows.length,
            columns: headers.map(h => ({ name: h, type: 'text', nullable: true })) }],
        }
        sampleData = {
          tables: [{ name: tableName, columns: headers, rows: dataRows.slice(0, 5),
            total_rows: dataRows.length, sampled_rows: Math.min(5, dataRows.length) }],
        }
      }

      const insertPayload: Record<string, unknown> = {
        workspace_id: user.id,
        project_id: projectId,
        name: sourceName.trim(),
        source_type: ext,
        category: 'file',
        status: 'active',
        row_count: uploadedFile.rows,
        schema_snapshot: schemaSnapshot,
        sample_data: sampleData,
        sync_frequency: 'manual',
      }
      if (proj?.org_id) insertPayload.org_id = proj.org_id

      const { data: inserted, error: insertErr } = await supabase
        .from('data_sources').insert(insertPayload).select('id').single()

      if (insertErr || !inserted) {
        setUploadError(`${t('common.error')}: ${insertErr?.message || ''}`)
        setSaving(false)
        return
      }

      // Upload to Storage
      const fileBlob = uploadedFile.text
        ? new Blob([uploadedFile.text], { type: 'text/csv' })
        : uploadedFile.file
      const storagePath = `${user.id}/${inserted.id}/${uploadedFile.file.name}`

      await supabase.storage
        .from('data-sources')
        .upload(storagePath, fileBlob, { contentType: 'text/csv', upsert: true })

      await supabase.from('data_sources')
        .update({ file_path: storagePath })
        .eq('id', inserted.id)

      // Store raw file for pipeline profiling
      if (uploadedFile.text) {
        try { sessionStorage.setItem('datalaser_raw_file', uploadedFile.text) } catch {}
      }

      // Navigate to wizard
      router.push(`${base}/prep/${inserted.id}`)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  // ── Delete source ──────────────────────────────────────────

  const handleDelete = async (srcId: string, srcName: string) => {
    if (!confirm(`Delete "${srcName}"? This cannot be undone.`)) return
    await supabase.from('data_sources').delete().eq('id', srcId)
    setSources(prev => prev.filter(s => s.id !== srcId))
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'cleaned', label: 'Cleaned Data', count: cleanedSources.length },
    { key: 'prepare', label: 'Prepare New', count: unpreparedSources.length },
    { key: 'history', label: 'History', count: runs.length },
  ]

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-10 space-y-3">
        <div className="h-10 rounded-dl-md bg-dl-bg-medium animate-pulse" />
        <div className="h-10 rounded-dl-md bg-dl-bg-medium animate-pulse" />
        <div className="h-10 rounded-dl-md bg-dl-bg-medium animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">{t('prep.title')}</h1>
      <p className="text-dl-text-light text-dl-sm mb-6">{t('prep.subtitle')}</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dl-border mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-dl-sm font-bold transition-colors relative
              ${tab === t.key ? 'text-dl-brand' : 'text-dl-text-medium hover:text-dl-text-dark'}`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-dl-xs font-bold
                ${tab === t.key ? 'bg-dl-brand-hover text-dl-brand' : 'bg-dl-bg-medium text-dl-text-light'}`}>
                {t.count}
              </span>
            )}
            {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-dl-brand" />}
          </button>
        ))}
      </div>

      {/* ═══ TAB: CLEANED DATA ═══ */}
      {tab === 'cleaned' && (
        cleanedSources.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={32} className="text-dl-brand mx-auto mb-3" />
            <p className="text-dl-text-dark text-dl-sm font-bold mb-1">{t('prep.noCleanedYet')}</p>
            <p className="text-dl-text-light text-dl-xs mb-4">{t('prep.noCleanedDesc')}</p>
            <button onClick={() => setTab('prepare')} className="dl-btn-primary text-dl-xs">
              {t('prep.prepareSource')} <ArrowRight size={12} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cleanedSources.map(src => {
              const recipe = src.pipeline_recipe_id ? recipes[src.pipeline_recipe_id] : null
              const stepsCount = Array.isArray(recipe?.steps) ? recipe.steps.length : 0
              return (
                <div key={src.id} className="dl-card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-dl-md bg-green-100 flex items-center justify-center">
                        <CheckCircle2 size={18} className="text-dl-success" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-dl-sm font-black text-dl-text-dark">{src.name}</h3>
                          <span className="px-1.5 py-0.5 rounded text-dl-xs font-bold bg-green-100 text-green-700">{t('prep.pipelineReady')}</span>
                          {src.pipeline_status === 'scheduled' && (
                            <span className="px-1.5 py-0.5 rounded text-dl-xs font-bold bg-dl-brand-hover text-dl-brand">{t('prep.autoSync')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-dl-xs text-dl-text-light">
                          {recipe?.last_quality_score != null && (
                            <span className="flex items-center gap-1">
                              <BarChart2 size={10} /> {t('prep.quality')} <span className="font-bold text-dl-success">{recipe.last_quality_score}/100</span>
                            </span>
                          )}
                          <span>{recipe?.last_row_count?.toLocaleString() ?? src.row_count.toLocaleString()} rows</span>
                          {stepsCount > 0 && <span>{t('prep.transforms', { count: stepsCount })}</span>}
                          {recipe?.last_run_at && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} /> {formatDistanceToNow(new Date(recipe.last_run_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`${base}/prep/${src.id}`} className="dl-btn-secondary text-dl-xs">
                      <RefreshCw size={12} /> {t('prep.rerun')}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ═══ TAB: PREPARE NEW ═══ */}
      {tab === 'prepare' && (
        <div>
          {/* Upload zone */}
          <div className="mb-6">
            {!uploadedFile ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-dl-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-dl-brand bg-dl-brand-hover' : 'border-dl-border-dark hover:border-dl-brand'}`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="w-8 h-8 text-dl-brand/60 mx-auto mb-2" />
                <p className="text-dl-text-medium text-dl-sm font-bold">{t('prep.uploadFile')}</p>
                <p className="text-dl-text-light text-dl-xs mt-1">{t('prep.dropzone')}</p>
              </div>
            ) : (
              <div className="dl-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UploadCloud size={16} className="text-dl-brand" />
                    <span className="text-dl-sm font-bold text-dl-text-dark">{uploadedFile.file.name}</span>
                    <span className="text-dl-xs text-dl-text-light">
                      ({uploadedFile.rows.toLocaleString()} rows)
                    </span>
                  </div>
                  <button onClick={() => { setUploadedFile(null); setSourceName('') }} className="text-dl-text-light hover:text-dl-error">
                    <X size={14} />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="dl-label">{t('prep.sourceName')}</label>
                  <input
                    className="dl-input"
                    value={sourceName}
                    onChange={e => setSourceName(e.target.value)}
                    placeholder={t("sources.displayName")}
                  />
                  {existingNames.has(sourceName) && sourceName !== '' && (
                    <p className="text-dl-xs text-orange-500 mt-1">
                      A source with this name already exists — it will be saved as a new version.
                    </p>
                  )}
                </div>

                {uploadError && (
                  <p className="text-dl-xs text-dl-error font-bold mb-3">{uploadError}</p>
                )}

                <button
                  onClick={handleStartPrep}
                  disabled={saving || !sourceName.trim()}
                  className={`dl-btn-primary w-full justify-center py-2.5 font-black
                    ${saving || !sourceName.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {saving ? 'Saving...' : 'Start preparation'} <Wand2 size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Existing unprepared sources */}
          {unpreparedSources.length > 0 && (
            <div>
              <p className="dl-section-header mb-3">{t('prep.existingSources')}</p>
              <div className="space-y-2">
                {unpreparedSources.map(src => (
                  <div key={src.id} className="dl-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Wand2 size={14} className="text-dl-text-light" />
                        <div>
                          <span className="text-dl-sm font-bold text-dl-text-dark">{src.name}</span>
                          <span className="text-dl-xs text-dl-text-light ml-2">
                            {src.row_count.toLocaleString()} rows · {formatDistanceToNow(new Date(src.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Link href={`${base}/prep/${src.id}`} className="dl-btn-primary text-dl-xs py-1">
                          {t('prep.prepare')}
                        </Link>
                        <button
                          onClick={() => handleDelete(src.id, src.name)}
                          className="dl-btn-subtle p-1.5 hover:text-dl-error"
                          title={t("common.delete")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: HISTORY ═══ */}
      {tab === 'history' && (
        runs.length === 0 ? (
          <div className="text-center py-12">
            <History size={32} className="text-dl-brand mx-auto mb-3" />
            <p className="text-dl-text-dark text-dl-sm font-bold mb-1">{t('prep.noRuns')}</p>
            <p className="text-dl-text-light text-dl-xs">{t('prep.noRunsDesc')}</p>
          </div>
        ) : (
          <div className="dl-card overflow-hidden">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>{t("common.source")}</th>
                  <th>{t("common.when")}</th>
                  <th>{t("common.duration")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.rows")}</th>
                  <th>{t("common.quality")}</th>
                  <th>{t("common.transforms")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => {
                  const duration = run.completed_at && run.started_at
                    ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                    : '—'
                  return (
                    <tr key={run.id}>
                      <td className="font-bold text-dl-xs">{sourceNames[run.source_id] || run.source_id.slice(0, 8)}</td>
                      <td className="text-dl-text-medium text-dl-xs">{formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</td>
                      <td className="text-dl-xs font-mono">{duration}</td>
                      <td>
                        <span className={run.status === 'success' ? 'dl-badge-success' : run.status === 'failed' ? 'dl-badge-error' : 'dl-badge-warning'}>
                          {run.status}
                        </span>
                      </td>
                      <td className="text-dl-xs font-mono">
                        {run.rows_before && run.rows_after
                          ? `${run.rows_before.toLocaleString()} → ${run.rows_after.toLocaleString()}`
                          : run.rows_after?.toLocaleString() ?? '—'}
                      </td>
                      <td className="text-dl-xs font-mono">{run.quality_score ?? '—'}</td>
                      <td className="text-dl-xs font-mono">{run.transformations_applied ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
