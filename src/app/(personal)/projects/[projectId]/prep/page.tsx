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
        setUploadError(`Failed to save: ${insertErr?.message || 'Unknown error'}`)
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
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-3">
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
        <div className="h-10 rounded-mb-md bg-mb-bg-medium animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">Data Preparation</h1>
      <p className="text-mb-text-light text-mb-sm mb-6">Clean, transform, and validate your data sources</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-mb-border mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-mb-sm font-bold transition-colors relative
              ${tab === t.key ? 'text-mb-brand' : 'text-mb-text-medium hover:text-mb-text-dark'}`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${tab === t.key ? 'bg-mb-brand-hover text-mb-brand' : 'bg-mb-bg-medium text-mb-text-light'}`}>
                {t.count}
              </span>
            )}
            {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-mb-brand" />}
          </button>
        ))}
      </div>

      {/* ═══ TAB: CLEANED DATA ═══ */}
      {tab === 'cleaned' && (
        cleanedSources.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={32} className="text-mb-text-light mx-auto mb-3" />
            <p className="text-mb-text-dark text-mb-sm font-bold mb-1">No cleaned datasets yet</p>
            <p className="text-mb-text-light text-mb-xs mb-4">Prepare a data source to see your cleaned data here.</p>
            <button onClick={() => setTab('prepare')} className="mb-btn-primary text-mb-xs">
              Prepare a source <ArrowRight size={12} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cleanedSources.map(src => {
              const recipe = src.pipeline_recipe_id ? recipes[src.pipeline_recipe_id] : null
              const stepsCount = Array.isArray(recipe?.steps) ? recipe.steps.length : 0
              return (
                <div key={src.id} className="mb-card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-mb-md bg-green-100 flex items-center justify-center">
                        <CheckCircle2 size={18} className="text-mb-success" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-mb-sm font-black text-mb-text-dark">{src.name}</h3>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">Pipeline Ready</span>
                          {src.pipeline_status === 'scheduled' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-mb-brand-hover text-mb-brand">Auto-sync</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-mb-xs text-mb-text-light">
                          {recipe?.last_quality_score != null && (
                            <span className="flex items-center gap-1">
                              <BarChart2 size={10} /> Quality: <span className="font-bold text-mb-success">{recipe.last_quality_score}/100</span>
                            </span>
                          )}
                          <span>{recipe?.last_row_count?.toLocaleString() ?? src.row_count.toLocaleString()} rows</span>
                          {stepsCount > 0 && <span>{stepsCount} transform{stepsCount !== 1 ? 's' : ''}</span>}
                          {recipe?.last_run_at && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} /> {formatDistanceToNow(new Date(recipe.last_run_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`${base}/prep/${src.id}`} className="mb-btn-secondary text-mb-xs">
                      <RefreshCw size={12} /> Re-run
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
                className={`border-2 border-dashed rounded-mb-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-mb-brand bg-mb-brand-hover' : 'border-mb-border-dark hover:border-mb-brand'}`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="w-8 h-8 text-mb-text-light mx-auto mb-2" />
                <p className="text-mb-text-medium text-mb-sm font-bold">Upload a file to prepare</p>
                <p className="text-mb-text-light text-mb-xs mt-1">Drop a CSV, Excel, or JSON file here</p>
              </div>
            ) : (
              <div className="mb-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UploadCloud size={16} className="text-mb-brand" />
                    <span className="text-mb-sm font-bold text-mb-text-dark">{uploadedFile.file.name}</span>
                    <span className="text-mb-xs text-mb-text-light">
                      ({uploadedFile.rows.toLocaleString()} rows)
                    </span>
                  </div>
                  <button onClick={() => { setUploadedFile(null); setSourceName('') }} className="text-mb-text-light hover:text-mb-error">
                    <X size={14} />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="mb-label">Source name</label>
                  <input
                    className="mb-input"
                    value={sourceName}
                    onChange={e => setSourceName(e.target.value)}
                    placeholder="Name this data source"
                  />
                  {existingNames.has(sourceName) && sourceName !== '' && (
                    <p className="text-mb-xs text-orange-500 mt-1">
                      A source with this name already exists — it will be saved as a new version.
                    </p>
                  )}
                </div>

                {uploadError && (
                  <p className="text-mb-xs text-mb-error font-bold mb-3">{uploadError}</p>
                )}

                <button
                  onClick={handleStartPrep}
                  disabled={saving || !sourceName.trim()}
                  className={`mb-btn-primary w-full justify-center py-2.5 font-black
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
              <p className="mb-section-header mb-3">Existing unprepared sources</p>
              <div className="space-y-2">
                {unpreparedSources.map(src => (
                  <div key={src.id} className="mb-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Wand2 size={14} className="text-mb-text-light" />
                        <div>
                          <span className="text-mb-sm font-bold text-mb-text-dark">{src.name}</span>
                          <span className="text-mb-xs text-mb-text-light ml-2">
                            {src.row_count.toLocaleString()} rows · {formatDistanceToNow(new Date(src.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Link href={`${base}/prep/${src.id}`} className="mb-btn-primary text-mb-xs py-1">
                          Prepare
                        </Link>
                        <button
                          onClick={() => handleDelete(src.id, src.name)}
                          className="mb-btn-subtle p-1.5 hover:text-mb-error"
                          title="Delete"
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
            <History size={32} className="text-mb-text-light mx-auto mb-3" />
            <p className="text-mb-text-dark text-mb-sm font-bold mb-1">No pipeline runs yet</p>
            <p className="text-mb-text-light text-mb-xs">Prepare a data source to see run history here.</p>
          </div>
        ) : (
          <div className="mb-card overflow-hidden">
            <table className="mb-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>When</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Quality</th>
                  <th>Transforms</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => {
                  const duration = run.completed_at && run.started_at
                    ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                    : '—'
                  return (
                    <tr key={run.id}>
                      <td className="font-bold text-mb-xs">{sourceNames[run.source_id] || run.source_id.slice(0, 8)}</td>
                      <td className="text-mb-text-medium text-mb-xs">{formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</td>
                      <td className="text-mb-xs font-mono">{duration}</td>
                      <td>
                        <span className={run.status === 'success' ? 'mb-badge-success' : run.status === 'failed' ? 'mb-badge-error' : 'mb-badge-warning'}>
                          {run.status}
                        </span>
                      </td>
                      <td className="text-mb-xs font-mono">
                        {run.rows_before && run.rows_after
                          ? `${run.rows_before.toLocaleString()} → ${run.rows_after.toLocaleString()}`
                          : run.rows_after?.toLocaleString() ?? '—'}
                      </td>
                      <td className="text-mb-xs font-mono">{run.quality_score ?? '—'}</td>
                      <td className="text-mb-xs font-mono">{run.transformations_applied ?? '—'}</td>
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
