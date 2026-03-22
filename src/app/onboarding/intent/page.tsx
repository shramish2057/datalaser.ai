'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { assessDataQuality, type DataQualityReport } from '@/lib/dataQuality'
import { DataQualityBanner } from '@/components/DataQualityBanner'
import {
  Loader2, CheckCircle2, AlertTriangle, XCircle,
  Wand2, MessageSquare, ArrowRight
} from 'lucide-react'
import type { DataProfile } from '@/types/pipeline'

type ColumnMeta = {
  name: string
  dtype: 'numeric' | 'categorical' | 'date' | 'id' | 'text'
  sample: string[]
  nullRate: number
  uniqueRate: number
  mixedTypes: boolean
  formatIssues: boolean
  totalValues: number
}

type ConnectInfo = {
  files: { name: string; rows: number; columns: ColumnMeta[]; sampleRows: string[][] }[]
  connectedSources: string[]
}

const CHART_TYPES = [
  { id: 'bar', label: 'Bar Chart', icon: '▬', desc: 'Compare values across categories' },
  { id: 'line', label: 'Line Chart', icon: '📈', desc: 'Show trends over time' },
  { id: 'area', label: 'Area Chart', icon: '◭', desc: 'Trends with filled area' },
  { id: 'pie', label: 'Pie / Donut', icon: '◕', desc: 'Show proportions of a whole' },
  { id: 'scatter', label: 'Scatter Plot', icon: '⁘', desc: 'Find correlations between variables' },
  { id: 'heatmap', label: 'Heatmap', icon: '▦', desc: 'Show intensity across two dimensions' },
  { id: 'funnel', label: 'Funnel', icon: '⬡', desc: 'Show conversion or drop-off stages' },
  { id: 'table', label: 'Data Table', icon: '⊞', desc: 'Browse and filter raw data' },
  { id: 'stacked_bar', label: 'Stacked Bar', icon: '▬', desc: 'Compare parts of a whole across categories' },
]

// step: 'configure' = axes/charts/question, 'health' = data quality results
type PageStep = 'configure' | 'saving' | 'profiling' | 'health'

export default function IntentPage() {
  const router = useRouter()
  const [connectInfo, setConnectInfo] = useState<ConnectInfo | null>(null)
  const [question, setQuestion] = useState('')
  const [selectedCharts, setSelectedCharts] = useState<string[]>(['bar'])
  const [xAxis, setXAxis] = useState('')
  const [yAxis, setYAxis] = useState('')
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null)

  // Step 4 state
  const [pageStep, setPageStep] = useState<PageStep>('configure')
  const [savedSourceId, setSavedSourceId] = useState<string | null>(null)
  const [pipelineProfile, setPipelineProfile] = useState<DataProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const raw = localStorage.getItem('datalaser_connect_info')
    if (raw) {
      const info = JSON.parse(raw) as ConnectInfo
      setConnectInfo(info)
      const file = info.files[0]
      if (file?.columns) {
        const report = assessDataQuality(file.columns, file.rows)
        setQualityReport(report)
        const dateCol = file.columns.find(c => c.dtype === 'date')
        const numCol = file.columns.find(c => c.dtype === 'numeric')
        const catCol = file.columns.find(c => c.dtype === 'categorical')
        if (dateCol) setXAxis(dateCol.name)
        else if (catCol) setXAxis(catCol.name)
        if (numCol) setYAxis(numCol.name)
        if (dateCol && numCol) setSelectedCharts(['line'])
        else if (catCol && numCol) setSelectedCharts(['bar'])
      }
    }
  }, [])

  const file = connectInfo?.files[0]
  const numericCols = file?.columns.filter(c => c.dtype === 'numeric') ?? []
  const categoricalCols = file?.columns.filter(c => c.dtype === 'categorical' || c.dtype === 'date') ?? []
  const projectId = typeof window !== 'undefined' ? localStorage.getItem('datalaser_project_id') : null

  const toggleChart = (id: string) => {
    setSelectedCharts(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  // ── Step 1: Save to Supabase + upload to Storage ──────────────

  const handleAnalyse = async () => {
    if (!file) return
    setPageStep('saving')
    setError(null)

    // Save intent to localStorage
    const intent = {
      question: question.trim() || `Give me a complete analysis of my ${file.name} data`,
      chartTypes: selectedCharts, xAxis, yAxis,
      fileName: file.name, columns: file.columns,
      sampleRows: file.sampleRows, rows: file.rows, qualityReport,
    }
    localStorage.setItem('datalaser_data_intent', JSON.stringify(intent))

    if (!projectId) {
      // No project context — go straight to ask (old flow)
      router.push('/app/ask')
      return
    }

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

      const cols = Array.isArray(file.columns) ? file.columns : []
      const sampleRows = Array.isArray(file.sampleRows) ? file.sampleRows : []
      const ext = file.name.split('.').pop()?.toLowerCase() || 'csv'
      const tableName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')

      const schemaSnapshot = {
        database_name: file.name,
        tables: [{ name: tableName, row_count: file.rows || 0,
          columns: cols.map(c => ({ name: c.name, type: c.dtype || 'text', nullable: true })) }],
      }
      const sampleData = {
        tables: [{ name: tableName, columns: cols.map(c => c.name),
          rows: sampleRows, total_rows: file.rows || 0, sampled_rows: sampleRows.length }],
      }

      const insertPayload: Record<string, unknown> = {
        workspace_id: user.id, project_id: projectId,
        name: file.name, source_type: ext, category: 'file',
        status: 'active', row_count: file.rows || 0,
        schema_snapshot: schemaSnapshot, sample_data: sampleData,
        sync_frequency: 'manual',
      }
      if (proj?.org_id) insertPayload.org_id = proj.org_id

      const { data: inserted, error: insertErr } = await supabase
        .from('data_sources').insert(insertPayload).select('id').single()

      if (insertErr) {
        setError(`Failed to save data source: ${insertErr.message}`)
        setPageStep('configure')
        return
      }

      if (!inserted) {
        setError('Failed to save data source — no record returned')
        setPageStep('configure')
        return
      }

      setSavedSourceId(inserted.id)

      // Use the raw file content (full data) if available, fallback to sample
      const rawFileContent = sessionStorage.getItem('datalaser_raw_file') || localStorage.getItem('datalaser_raw_file')
      let csvBlob: Blob
      if (rawFileContent) {
        csvBlob = new Blob([rawFileContent], { type: 'text/csv' })
      } else {
        const csvHeader = cols.map(c => c.name).join(',')
        const csvRows = sampleRows.map(r => r.join(','))
        csvBlob = new Blob([csvHeader + '\n' + csvRows.join('\n')], { type: 'text/csv' })
      }

      // Upload to Storage
      const storagePath = `${user.id}/${inserted.id}/${file.name}`
      await supabase.storage
        .from('data-sources')
        .upload(storagePath, csvBlob, { contentType: 'text/csv', upsert: true })

      await supabase.from('data_sources')
        .update({ file_path: storagePath })
        .eq('id', inserted.id)

      // Clean up raw file
      sessionStorage.removeItem('datalaser_raw_file')
      sessionStorage.removeItem('datalaser_raw_file_name')
      localStorage.removeItem('datalaser_raw_file')

      // Now profile via pipeline service
      setPageStep('profiling')

      console.log('[Intent] CSV blob size:', csvBlob.size, 'bytes, raw file found:', !!rawFileContent)

      const fd = new FormData()
      fd.append('file', csvBlob, file.name)
      fd.append('source_id', inserted.id)

      const res = await fetch('/api/pipeline/profile', { method: 'POST', body: fd })
      const profileData = await res.json()

      if (!res.ok) {
        // Pipeline service might be down — show error but still let user proceed
        setError(profileData.error || 'Pipeline service unavailable — you can still explore your data')
        setPageStep('health')
        return
      }

      setPipelineProfile(profileData)
      setPageStep('health')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPageStep('health') // Still show health step so user can proceed
    }
  }

  // ── Navigation from health step ──────────────────────────────

  const goToClean = () => {
    if (projectId && savedSourceId) {
      localStorage.removeItem('datalaser_project_id')
      localStorage.removeItem('datalaser_connect_info')
      router.push(`/projects/${projectId}/sources/${savedSourceId}/prepare`)
    }
  }

  const goToExplore = () => {
    if (projectId) {
      localStorage.removeItem('datalaser_project_id')
      localStorage.removeItem('datalaser_connect_info')
      router.push(`/projects/${projectId}/ask`)
    }
  }

  const goToInsights = () => {
    if (projectId) {
      localStorage.removeItem('datalaser_project_id')
      localStorage.removeItem('datalaser_connect_info')
      router.push(`/projects/${projectId}/insights`)
    }
  }

  if (!connectInfo) return null

  const currentStep = pageStep === 'configure' ? 3 : 4

  // ── RENDER ────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto pt-12 px-6 pb-24">
      <StepIndicator current={currentStep} labels={['Workspace', 'Connect', 'Configure', 'Data Health']} />

      {/* ════════════════════════════════════════════════════════════
          STEP 3: CONFIGURE
          ════════════════════════════════════════════════════════════ */}
      {pageStep === 'configure' && (
        <>
          <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">
            What do you want to understand?
          </h1>
          <p className="text-mb-text-medium text-mb-base mb-8">
            We detected {file?.columns.length} columns and {file?.rows.toLocaleString()} rows
            in <span className="font-bold text-mb-text-dark">{file?.name}</span>.
            Tell us what you want to explore.
          </p>

          {/* Detected columns */}
          <div className="mb-card p-4 mb-6">
            <p className="mb-section-header mb-3">Detected columns</p>
            <div className="flex flex-wrap gap-2">
              {file?.columns.map(col => (
                <span key={col.name} className={`
                  mb-badge font-mono text-mb-xs
                  ${col.dtype === 'numeric' ? 'mb-badge-info' :
                    col.dtype === 'date' ? 'mb-badge-warning' :
                    col.dtype === 'categorical' ? 'mb-badge-neutral' :
                    'bg-mb-bg-medium text-mb-text-light'}
                `}>
                  {col.name}
                  <span className="ml-1 opacity-60">({col.dtype})</span>
                </span>
              ))}
            </div>
          </div>

          {qualityReport && <DataQualityBanner report={qualityReport} />}

          {/* Question */}
          <div className="mb-6">
            <label className="mb-label">What question do you want answered? (optional)</label>
            <textarea
              className="mb-input min-h-[80px] resize-none"
              placeholder={`e.g. "What factors most influenced survival?" or "Show me sales by region over time"`}
              value={question}
              onChange={e => setQuestion(e.target.value)}
            />
            <p className="text-mb-text-light text-mb-xs mt-1">
              Leave blank and we&apos;ll auto-generate the most interesting analysis.
            </p>
          </div>

          {/* Axis selectors */}
          {categoricalCols.length > 0 && numericCols.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="mb-label">X Axis (categories / time)</label>
                <select className="mb-input" value={xAxis} onChange={e => setXAxis(e.target.value)}>
                  <option value="">Auto-detect</option>
                  {[...categoricalCols, ...file?.columns.filter(c => c.dtype === 'id') ?? []].map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-label">Y Axis (values to measure)</label>
                <select className="mb-input" value={yAxis} onChange={e => setYAxis(e.target.value)}>
                  <option value="">Auto-detect</option>
                  {numericCols.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Chart types */}
          <div className="mb-8">
            <label className="mb-label">Preferred visualisation types (select all that apply)</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {CHART_TYPES.map(chart => (
                <button
                  key={chart.id}
                  onClick={() => toggleChart(chart.id)}
                  className={`p-3 rounded-mb-lg border text-left transition-all
                    ${selectedCharts.includes(chart.id)
                      ? 'border-mb-brand bg-mb-brand-hover'
                      : 'border-mb-border-dark hover:border-mb-brand'}`}
                >
                  <div className="text-lg mb-1">{chart.icon}</div>
                  <div className="text-mb-sm font-bold text-mb-text-dark">{chart.label}</div>
                  <div className="text-mb-xs text-mb-text-light mt-0.5">{chart.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error from previous attempt */}
          {error && (
            <div className="px-4 py-3 rounded-mb-md bg-red-50 border border-mb-error text-mb-error text-mb-sm font-bold mb-4">
              {error}
            </div>
          )}

          {/* Bottom bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-mb-bg border-t border-mb-border px-8 py-3 flex items-center justify-between z-40">
            <span className="text-mb-text-medium text-mb-sm">
              Ready to analyse <span className="font-bold text-mb-text-dark">{file?.name}</span>
            </span>
            <button
              onClick={handleAnalyse}
              className="mb-btn-primary px-8 py-2 text-mb-base font-black"
            >
              Analyse data <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          SAVING / PROFILING LOADING STATES
          ════════════════════════════════════════════════════════════ */}
      {(pageStep === 'saving' || pageStep === 'profiling') && (
        <div className="text-center py-16">
          <Loader2 className="w-10 h-10 text-mb-brand animate-spin mx-auto mb-4" />
          <h2 className="text-mb-xl font-black text-mb-text-dark mb-2">
            {pageStep === 'saving' ? 'Saving your data...' : 'Analysing data quality...'}
          </h2>
          <p className="text-mb-text-medium text-mb-sm">
            {pageStep === 'saving'
              ? 'Uploading to secure storage'
              : 'Checking for missing values, type issues, outliers, and more'}
          </p>
          <div className="max-w-sm mx-auto mt-6 space-y-2">
            <div className="h-4 rounded-mb-md bg-mb-bg-medium animate-pulse" />
            <div className="h-4 rounded-mb-md bg-mb-bg-medium animate-pulse w-3/4" />
            <div className="h-4 rounded-mb-md bg-mb-bg-medium animate-pulse w-1/2" />
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          STEP 4: DATA HEALTH RESULTS
          ════════════════════════════════════════════════════════════ */}
      {pageStep === 'health' && (
        <div>
          <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">
            Data Health Report
          </h1>
          <p className="text-mb-text-medium text-mb-base mb-6">
            {file?.name}
          </p>

          {/* Pipeline profile results */}
          {pipelineProfile ? (
            <>
              {/* Quality score card */}
              <div className="mb-card p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-mb-xs font-bold text-mb-text-light uppercase tracking-wider mb-1">Quality Score</p>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-black text-mb-text-dark">{pipelineProfile.quality_score}</span>
                      <span className="text-mb-text-light text-mb-lg font-bold">/100</span>
                      <span className={`px-2.5 py-1 rounded-full text-mb-xs font-black ${
                        pipelineProfile.quality_level === 'good' ? 'bg-green-100 text-green-700' :
                        pipelineProfile.quality_level === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                        pipelineProfile.quality_level === 'amber' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {pipelineProfile.quality_level === 'good' ? 'Good' :
                         pipelineProfile.quality_level === 'yellow' ? 'Minor issues' :
                         pipelineProfile.quality_level === 'amber' ? 'Issues found' : 'Significant issues'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-mb-xs text-mb-text-light">
                    <p>{pipelineProfile.total_rows.toLocaleString()} rows</p>
                    <p>{pipelineProfile.total_columns} columns</p>
                  </div>
                </div>
                <div className="w-full h-3 bg-mb-bg-medium rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${
                    pipelineProfile.quality_score >= 90 ? 'bg-mb-success' :
                    pipelineProfile.quality_score >= 70 ? 'bg-yellow-400' :
                    pipelineProfile.quality_score >= 50 ? 'bg-orange-400' : 'bg-mb-error'
                  }`} style={{ width: `${pipelineProfile.quality_score}%` }} />
                </div>
              </div>

              {/* Warnings */}
              {pipelineProfile.warnings.length > 0 && (
                <div className="mb-6 space-y-2">
                  <p className="mb-section-header mb-2">
                    {pipelineProfile.warnings.length} issue{pipelineProfile.warnings.length !== 1 ? 's' : ''} found
                  </p>
                  {pipelineProfile.warnings.map((w, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-mb-md border ${
                      w.severity === 'red' ? 'border-mb-error bg-red-50' :
                      w.severity === 'amber' ? 'border-orange-300 bg-orange-50' :
                      'border-yellow-300 bg-yellow-50'
                    }`}>
                      {w.severity === 'red' ? <XCircle size={14} className="text-mb-error flex-shrink-0 mt-0.5" /> :
                       <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${w.severity === 'amber' ? 'text-orange-400' : 'text-yellow-400'}`} />}
                      <div>
                        <span className="text-mb-sm font-black text-mb-text-dark">{w.column}</span>
                        <span className="text-mb-sm text-mb-text-medium ml-2">{w.detail}</span>
                        {w.affected_rows != null && (
                          <span className="text-mb-xs text-mb-text-light ml-1">({w.affected_rows.toLocaleString()} rows)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No issues */}
              {pipelineProfile.warnings.length === 0 && (
                <div className="mb-6 p-4 rounded-mb-md bg-green-50 border border-mb-success flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-mb-success" />
                  <div>
                    <p className="text-mb-sm font-black text-green-700">No data quality issues found</p>
                    <p className="text-mb-xs text-green-600">Your data looks clean and ready for analysis.</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* No pipeline profile — show error or fallback */
            error && (
              <div className="mb-6 p-4 rounded-mb-md bg-orange-50 border border-orange-300 flex items-start gap-3">
                <AlertTriangle size={18} className="text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-mb-sm font-black text-orange-800">{error}</p>
                  <p className="text-mb-xs text-orange-600 mt-1">You can still explore your data — quality checks will be available later.</p>
                </div>
              </div>
            )
          )}

          {/* ── Decision CTAs ───────────────────────────────────── */}
          <div className="border-t border-mb-border pt-6 mt-6">
            <h2 className="text-mb-lg font-black text-mb-text-dark mb-2">What would you like to do?</h2>
            <p className="text-mb-text-medium text-mb-sm mb-5">
              {pipelineProfile && pipelineProfile.warnings.length > 0
                ? 'We found data quality issues. You can clean them before analysis, or explore the raw data.'
                : 'Your data is ready. You can explore it right away or run the preparation pipeline.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Clean first */}
              <button onClick={goToClean} disabled={!savedSourceId}
                className={`text-left p-5 rounded-mb-lg border transition-all group
                  ${pipelineProfile && pipelineProfile.warnings.length > 0
                    ? 'border-mb-brand bg-mb-brand-hover'
                    : 'border-mb-border hover:border-mb-brand hover:bg-mb-brand-hover'}
                  ${!savedSourceId ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <div className={`w-10 h-10 rounded-mb-md flex items-center justify-center mb-3 transition-colors
                  ${pipelineProfile && pipelineProfile.warnings.length > 0
                    ? 'bg-mb-brand' : 'bg-mb-bg-medium group-hover:bg-mb-brand'}`}>
                  <Wand2 size={18} className={pipelineProfile && pipelineProfile.warnings.length > 0
                    ? 'text-white' : 'text-mb-text-light group-hover:text-white'} />
                </div>
                <p className={`text-mb-sm font-black mb-1 ${
                  pipelineProfile && pipelineProfile.warnings.length > 0 ? 'text-mb-brand' : 'text-mb-text-dark'}`}>
                  Clean &amp; prepare first
                </p>
                <p className="text-mb-xs text-mb-text-medium">
                  Fix issues with AI-suggested transformations
                </p>
              </button>

              {/* Explore as-is */}
              <button onClick={goToExplore}
                className="text-left p-5 rounded-mb-lg border border-mb-border hover:border-mb-brand hover:bg-mb-brand-hover transition-all group">
                <div className="w-10 h-10 rounded-mb-md flex items-center justify-center mb-3 bg-mb-bg-medium group-hover:bg-mb-brand transition-colors">
                  <MessageSquare size={18} className="text-mb-text-light group-hover:text-white" />
                </div>
                <p className="text-mb-sm font-black text-mb-text-dark mb-1">Skip, explore as-is</p>
                <p className="text-mb-xs text-mb-text-medium">Go straight to Ask Data with the raw dataset</p>
              </button>
            </div>

            <div className="mt-4 text-center">
              <button onClick={goToInsights}
                className="text-mb-xs font-bold text-mb-text-light hover:text-mb-brand transition-colors inline-flex items-center gap-1">
                Or go to AI Insights <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
