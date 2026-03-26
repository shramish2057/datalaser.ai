'use client'
import { useTranslations, useLocale } from 'next-intl'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { BarChart3, Clock, Zap, Calendar, Plus, X, Sparkles, FileText, Database, Hash, Tag, CalendarDays, Loader2 } from 'lucide-react'
import StepIndicator from '@/components/onboarding/StepIndicator'

// ─── Types ──────────────────────────────────────────────────────────────────

type ColumnMeta = {
  name: string
  dtype: 'numeric' | 'categorical' | 'date' | 'id' | 'text'
  sample: string[]
}

type ConnectedDbSource = {
  id: string
  name: string
  source_type: string
  schema_snapshot: Record<string, unknown> | null
  row_count: number
}

type ConnectInfo = {
  files: { name: string; rows: number; columns: ColumnMeta[]; sampleRows?: string[][] }[]
  connectedSources: (string | ConnectedDbSource)[]
}

type AIMetric = {
  name: string
  column: string
  aggregation: string
  reason: string
}

type AIDimension = {
  name: string
  column: string
  reason: string
}

type AIResponse = {
  metrics: AIMetric[]
  dimensions: AIDimension[]
  data_summary: string
}

// ─── Sync frequencies ───────────────────────────────────────────────────────

const FREQUENCIES = [
  { id: 'realtime', icon: Zap, labelKey: 'onboarding.freqRealtime', descKey: 'onboarding.freqRealtimeDesc' },
  { id: 'hourly', icon: Clock, labelKey: 'onboarding.freqHourly', descKey: 'onboarding.freqHourlyDesc' },
  { id: 'daily', icon: Calendar, labelKey: 'onboarding.freqDaily', descKey: 'onboarding.freqDailyDesc' },
  { id: 'weekly', icon: BarChart3, labelKey: 'onboarding.freqWeekly', descKey: 'onboarding.freqWeeklyDesc' },
]

const AGG_LABELS: Record<string, string> = {
  sum: 'Sum',
  avg: 'Average',
  rate: '% Rate',
  count: 'Count',
  min: 'Min',
  max: 'Max',
  median: 'Median',
  distribution: 'Breakdown',
}

// ─── DB source helpers ───────────────────────────────────────────────────────

function mapDbTypeToColumnDtype(dbType: string): 'numeric' | 'categorical' | 'date' | 'id' | 'text' {
  const t = dbType.toLowerCase()
  if (/int|float|double|decimal|numeric|real|money|serial/.test(t)) return 'numeric'
  if (/date|time|timestamp/.test(t)) return 'date'
  if (/uuid/.test(t)) return 'id'
  if (/bool/.test(t)) return 'categorical'
  return 'categorical'
}

function dbSourceToColumns(source: { name: string; schema_snapshot: any; row_count: number }) {
  const schema = source.schema_snapshot as { tables?: { name: string; row_count: number; columns: { name: string; type: string }[] }[] } | null
  if (!schema?.tables) return []
  const columns: { name: string; dtype: 'numeric' | 'categorical' | 'date' | 'id' | 'text'; sample: string[]; nullRate: number; uniqueRate: number; mixedTypes: boolean; formatIssues: boolean; totalValues: number }[] = []
  for (const table of schema.tables) {
    for (const col of table.columns) {
      columns.push({
        name: col.name,
        dtype: mapDbTypeToColumnDtype(col.type),
        sample: [],
        nullRate: 0,
        uniqueRate: 0,
        mixedTypes: false,
        formatIssues: false,
        totalValues: table.row_count,
      })
    }
  }
  return columns
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CalibratePage() {
  const t = useTranslations()
  const locale = useLocale()
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [customMetric, setCustomMetric] = useState('')
  const [customMetrics, setCustomMetrics] = useState<string[]>([])
  const [frequency, setFrequency] = useState<string | null>('daily')
  const [loading, setLoading] = useState(false)
  const [connectInfo, setConnectInfo] = useState<ConnectInfo | null>(null)

  // AI state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiMetrics, setAiMetrics] = useState<AIMetric[]>([])
  const [aiDimensions, setAiDimensions] = useState<AIDimension[]>([])
  const [dataSummary, setDataSummary] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const hasConnectedDatabases = (connectInfo?.connectedSources.length ?? 0) > 0
  const hasUploadedFiles = (connectInfo?.files.length ?? 0) > 0
  const hasColumnData = connectInfo?.files.some(f => (f.columns?.length ?? 0) > 0) ?? false
  const totalColumns = connectInfo?.files.reduce((sum, f) => sum + (f.columns?.length ?? 0), 0) ?? 0

  // Load connect info + call AI on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('datalaser_connect_info')
      if (!raw) return

      const info: ConnectInfo = JSON.parse(raw)
      // Normalize: ensure every file has a columns array
      info.files = (info.files || []).map(f => ({
        ...f,
        columns: Array.isArray(f.columns) ? f.columns : [],
      }))
      setConnectInfo(info)

      const filesWithColumns = info.files.filter(f => f.columns.length > 0)
      console.log('[Calibrate] Files with columns:', filesWithColumns.length)

      // Convert DB sources with schema_snapshot into column format for AI analysis
      const rawDbSources = info.connectedSources || []
      console.log('[Calibrate] Raw DB sources:', rawDbSources.length, rawDbSources.map((s: any) => ({ name: s.name || s, hasSchema: !!(s?.schema_snapshot), tables: (s?.schema_snapshot as any)?.tables?.length })))

      const dbSources = rawDbSources
        .filter((s): s is ConnectedDbSource => typeof s === 'object' && s !== null && !!(s as ConnectedDbSource).schema_snapshot)
        .map(s => ({
          name: s.name,
          rows: s.row_count,
          columns: dbSourceToColumns(s),
        }))
        .filter(s => s.columns.length > 0)
      console.log('[Calibrate] DB sources with columns:', dbSources.length, dbSources.map(s => ({ name: s.name, cols: s.columns.length })))

      const allSources = [...filesWithColumns, ...dbSources]
      console.log('[Calibrate] Total sources for AI:', allSources.length)
      if (allSources.length > 0) {
        fetchAISuggestions({ ...info, files: allSources })
      } else {
        console.warn('[Calibrate] No sources with columns found, AI suggestions will not run')
      }
    } catch (e) {
      console.error('[Calibrate] Failed to load connect info:', e)
    }
  }, [])

  async function fetchAISuggestions(info: ConnectInfo) {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/onboarding/suggest-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: info.files, locale }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to analyze data')
      }

      const data: AIResponse = await res.json()
      setAiMetrics(data.metrics)
      setAiDimensions(data.dimensions)
      setDataSummary(data.data_summary)

      // Auto-select all AI-suggested metrics
      setSelectedMetrics(data.metrics.map(m => m.name))
    } catch (e) {
      console.error('AI suggestion error:', e)
      setAiError(e instanceof Error ? e.message : 'Failed to analyze data')
    } finally {
      setAiLoading(false)
    }
  }

  const toggleMetric = (m: string) => {
    setSelectedMetrics(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const addCustomMetric = () => {
    const trimmed = customMetric.trim()
    if (!trimmed) return
    if (!customMetrics.includes(trimmed) && !selectedMetrics.includes(trimmed)) {
      setCustomMetrics(prev => [...prev, trimmed])
      setSelectedMetrics(prev => [...prev, trimmed])
    }
    setCustomMetric('')
  }

  const removeCustomMetric = (m: string) => {
    setCustomMetrics(prev => prev.filter(x => x !== m))
    setSelectedMetrics(prev => prev.filter(x => x !== m))
  }

  const handleLaunch = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 1. Ensure profile exists, then save metrics
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        primary_metrics: selectedMetrics,
        ...(hasConnectedDatabases ? { data_update_frequency: frequency } : {}),
      })

      if (upsertError) {
        console.error('Failed to save profile:', upsertError)
      }

      // 2. Save uploaded files as data_sources so insights pipeline can use them
      const files = connectInfo?.files || []
      let savedCount = 0
      let firstSourceId: string | null = null

      for (const file of files) {
        const cols = Array.isArray(file.columns) ? file.columns : []
        if (cols.length === 0) continue

        const ext = file.name.split('.').pop()?.toLowerCase() || 'csv'
        const tableName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')

        // Build schema_snapshot in the format sampler.ts expects
        const schemaSnapshot = {
          database_name: file.name,
          tables: [{
            name: tableName,
            row_count: file.rows || 0,
            columns: cols.map(c => ({
              name: c.name,
              type: c.dtype || 'text',
              nullable: true,
            })),
          }],
        }

        // Build sample_data in the format sampler.ts expects
        const sampleRows = Array.isArray(file.sampleRows) ? file.sampleRows : []
        const sampleData = {
          tables: [{
            name: tableName,
            columns: cols.map(c => c.name),
            rows: sampleRows,
            total_rows: file.rows || 0,
            sampled_rows: sampleRows.length,
          }],
        }

        const insertPayload: Record<string, unknown> = {
          workspace_id: user.id,
          name: file.name,
          source_type: ext,
          category: 'file',
          status: 'active',
          row_count: file.rows || 0,
          schema_snapshot: schemaSnapshot,
          sample_data: sampleData,
          sync_frequency: 'manual',
        }

        const storedProjId = localStorage.getItem('datalaser_project_id')
        if (storedProjId) {
          insertPayload.project_id = storedProjId
          // Resolve org_id from project
          const { data: projData } = await supabase
            .from('projects')
            .select('org_id')
            .eq('id', storedProjId)
            .single()
          if (projData?.org_id) {
            insertPayload.org_id = projData.org_id
          }
        }

        const { data: inserted, error: insertError } = await supabase
          .from('data_sources')
          .insert(insertPayload)
          .select('id')
          .single()

        if (insertError || !inserted) {
          console.error(`Failed to save data source "${file.name}":`, insertError)
        } else {
          savedCount++
          if (!firstSourceId) firstSourceId = inserted.id

          // Upload file data to Storage for pipeline profiling
          try {
            const csvHeader = cols.map(c => c.name).join(',')
            const csvRows = sampleRows.map(r => r.join(','))
            const csvContent = [csvHeader, ...csvRows].join('\n')
            const csvBlob = new Blob([csvContent], { type: 'text/csv' })
            const storagePath = `${user.id}/${inserted.id}/${file.name}`

            await supabase.storage
              .from('data-sources')
              .upload(storagePath, csvBlob, { contentType: 'text/csv', upsert: true })

            await supabase
              .from('data_sources')
              .update({ file_path: storagePath })
              .eq('id', inserted.id)
          } catch (uploadErr) {
            console.error(`Storage upload failed for "${file.name}":`, uploadErr)
          }
        }
      }

      console.log(`Saved ${savedCount}/${files.length} file sources to database`)

      const storedProjectId = localStorage.getItem('datalaser_project_id')

      // 3. Assign project_id to DB sources saved during connect (they may not have it)
      const dbSources = connectInfo?.connectedSources || []
      for (const dbSrc of dbSources) {
        const srcId = typeof dbSrc === 'object' ? (dbSrc as ConnectedDbSource).id : null
        if (srcId && storedProjectId) {
          const updateData: Record<string, string> = { project_id: storedProjectId }
          // Also resolve org_id
          const { data: projData } = await supabase
            .from('projects').select('org_id').eq('id', storedProjectId).single()
          if (projData?.org_id) updateData.org_id = projData.org_id
          await supabase.from('data_sources').update(updateData).eq('id', srcId)
          if (!firstSourceId) firstSourceId = srcId
        }
      }

      localStorage.removeItem('datalaser_connect_info')

      // 4. Fallback: find latest source for project
      if (!firstSourceId && storedProjectId) {
        const { data: latestSrc } = await supabase
          .from('data_sources')
          .select('id')
          .eq('project_id', storedProjectId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (latestSrc) firstSourceId = latestSrc.id
      }

      // 5. Redirect — DB sources go to overview, file sources go to health
      const storedBasePath = localStorage.getItem('datalaser_base_path') || (storedProjectId ? `/projects/${storedProjectId}` : null)
      const dbSource = dbSources.find(s => typeof s === 'object' && (s as ConnectedDbSource).id)
      localStorage.removeItem('datalaser_project_id')
      localStorage.removeItem('datalaser_base_path')

      if (storedBasePath && dbSource && typeof dbSource === 'object') {
        router.push(`${storedBasePath}/sources/${(dbSource as ConnectedDbSource).id}/overview`)
      } else if (storedBasePath && firstSourceId) {
        router.push(`${storedBasePath}/sources/${firstSourceId}/health`)
      } else if (storedBasePath) {
        router.push(storedBasePath)
      } else {
        router.push('/projects')
      }
    } catch (err) {
      console.error('Launch error:', err)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pt-12 px-6 pb-24">
      <StepIndicator current={3} labels={[t('onboarding.stepWorkspace'), t('onboarding.stepConnect'), t('onboarding.stepCalibrate')]} />

      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">{t('onboarding.almostThere')}</h1>
      <p className="text-dl-text-medium text-dl-base mb-8">
        {aiLoading
          ? t('onboarding.analyzingWithAI')
          : dataSummary
            ? dataSummary
            : hasColumnData
              ? t('onboarding.analyzingFields', { count: totalColumns })
              : t('onboarding.tellAIMetrics')}
      </p>

      {/* ── Data summary ── */}
      {(hasUploadedFiles || hasConnectedDatabases) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {connectInfo?.files.map(f => (
            <div key={f.name} className="flex items-center gap-2 px-3 py-1.5 rounded-dl-md bg-dl-bg-light border border-dl-border">
              <FileText className="w-3.5 h-3.5 text-dl-text-light" />
              <span className="text-dl-xs font-bold text-dl-text-dark">{f.name}</span>
              <span className="text-dl-xs text-dl-text-light">
                {f.columns?.length ?? 0} {t('onboarding.fields')} &middot; {f.rows.toLocaleString()} {t('common.rows')}
              </span>
            </div>
          ))}
          {connectInfo?.connectedSources?.map((s: any) => (
            <div key={s.id || s.name || s} className="flex items-center gap-2 px-3 py-1.5 rounded-dl-md bg-dl-bg-light border border-dl-border">
              <Database className="w-3.5 h-3.5 text-dl-text-light" />
              <span className="text-dl-xs font-bold text-dl-text-dark">{s.name || s}</span>
              {s.schema_snapshot?.tables && (
                <span className="text-dl-xs text-dl-text-light">
                  {s.schema_snapshot.tables.length} {t('overview.tables')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── AI Loading state ── */}
      {aiLoading && (
        <div className="mb-8 flex flex-col items-center justify-center py-12 dl-card">
          <Loader2 className="w-8 h-8 text-dl-brand animate-spin mb-3" />
          <p className="text-dl-sm font-bold text-dl-text-dark">{t('onboarding.aiAnalyzing')}</p>
          <p className="text-dl-xs text-dl-text-light mt-1">
            {t('onboarding.identifyingColumns')}
          </p>
        </div>
      )}

      {/* ── AI Error ── */}
      {aiError && (
        <div className="mb-6 px-4 py-3 rounded-dl-md bg-red-50 border border-dl-error">
          <p className="text-dl-sm font-bold text-dl-error">{t('onboarding.couldntAnalyze')}</p>
          <p className="text-dl-xs text-dl-text-medium mt-1">{aiError}</p>
          <button
            onClick={() => connectInfo && fetchAISuggestions(connectInfo)}
            className="dl-btn-secondary text-dl-xs mt-2"
          >
            {t('onboarding.retry')}
          </button>
        </div>
      )}

      {/* ── AI-suggested metrics ── */}
      {!aiLoading && aiMetrics.length > 0 && (
        <div className="mb-6">
          <label className="dl-label flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-dl-brand" />
            {t('onboarding.aiSuggestedMetrics')}
          </label>
          <div className="space-y-1.5 mt-2">
            {aiMetrics.map(m => (
              <button
                key={m.name}
                onClick={() => toggleMetric(m.name)}
                className={`
                  w-full flex items-center justify-between px-4 py-3
                  border rounded-dl-md cursor-pointer transition-all text-left
                  ${selectedMetrics.includes(m.name)
                    ? 'border-dl-brand bg-dl-brand-hover'
                    : 'border-dl-border-dark hover:border-dl-brand hover:bg-dl-brand-hover'}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-4 h-4 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors
                    ${selectedMetrics.includes(m.name) ? 'border-dl-brand bg-dl-brand' : 'border-dl-border-dark'}`}
                  >
                    {selectedMetrics.includes(m.name) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-dl-sm font-bold ${selectedMetrics.includes(m.name) ? 'text-dl-brand' : 'text-dl-text-dark'}`}>
                        {m.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-dl-xs font-bold bg-dl-bg-medium text-dl-text-light uppercase flex-shrink-0">
                        {AGG_LABELS[m.aggregation] || m.aggregation}
                      </span>
                    </div>
                    <p className="text-dl-xs text-dl-text-light mt-0.5 truncate">{m.reason}</p>
                  </div>
                </div>
                <span className="text-dl-xs text-dl-text-light font-mono flex-shrink-0 ml-3">
                  {m.column}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Dimensions ── */}
      {!aiLoading && aiDimensions.length > 0 && (
        <div className="mb-6">
          <label className="dl-label flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-purple-500" />
            {t('onboarding.dimensionsToGroup')}
          </label>
          <div className="space-y-1 mt-2">
            {aiDimensions.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-dl-md bg-dl-bg-light border border-dl-border"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Tag className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="text-dl-sm font-bold text-dl-text-dark">{d.name}</span>
                </div>
                <span className="text-dl-xs text-dl-text-light ml-3 truncate max-w-64">{d.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Fallback when no data or AI hasn't run — generic metric chips ── */}
      {!aiLoading && !hasColumnData && aiMetrics.length === 0 && (
        <div className="mb-6">
          <label className="dl-label">{t('onboarding.keyMetrics')}</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {['Revenue', 'MRR', 'Churn Rate', 'CAC', 'LTV', 'Conversion Rate',
              'Ad Spend', 'ROAS', 'Avg Order Value', 'Gross Margin', 'Burn Rate', 'NPS',
            ].map(m => (
              <button
                key={m}
                onClick={() => toggleMetric(m)}
                className={`
                  border rounded-dl-md px-4 py-2.5
                  text-dl-sm font-bold cursor-pointer transition-all
                  ${selectedMetrics.includes(m)
                    ? 'border-dl-brand text-dl-brand bg-dl-brand-hover'
                    : 'border-dl-border-dark text-dl-text-medium hover:border-dl-brand hover:text-dl-brand hover:bg-dl-brand-hover'}
                `}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Custom metrics added by user ── */}
      {customMetrics.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {customMetrics.map(m => (
            <span
              key={m}
              className="flex items-center gap-1.5 border border-dl-brand text-dl-brand bg-dl-brand-hover rounded-dl-md px-3 py-1.5 text-dl-sm font-bold"
            >
              {m}
              <button onClick={() => removeCustomMetric(m)} className="hover:text-dl-error transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Add custom metric ── */}
      <div className="mb-8">
        <label className="dl-label">{t('onboarding.addCustomMetric')}</label>
        <div className="flex gap-2 mt-1">
          <input
            className="dl-input flex-1"
            placeholder={t('onboarding.customMetricPlaceholder')}
            value={customMetric}
            onChange={e => setCustomMetric(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomMetric()}
          />
          <button
            onClick={addCustomMetric}
            disabled={!customMetric.trim()}
            className={`dl-btn-secondary flex items-center gap-1.5 ${!customMetric.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('common.add')}
          </button>
        </div>
      </div>

      {/* ── Sync frequency — only for connected databases ── */}
      {hasConnectedDatabases && (
        <div className="mb-8">
          <label className="dl-label">{t('onboarding.howOftenSync')}</label>
          <p className="text-dl-xs text-dl-text-light mb-2">
            {t('onboarding.syncExplanation')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FREQUENCIES.map(f => (
              <button
                key={f.id}
                onClick={() => setFrequency(f.id)}
                className={`
                  border rounded-dl-md p-4 text-left cursor-pointer transition-all
                  ${frequency === f.id
                    ? 'border-dl-brand bg-dl-brand-hover'
                    : 'border-dl-border-dark hover:border-dl-brand'}
                `}
              >
                <f.icon
                  className={`w-5 h-5 mb-2 ${frequency === f.id ? 'text-dl-brand' : 'text-dl-text-light'}`}
                />
                <div className={`text-dl-sm font-black ${frequency === f.id ? 'text-dl-brand' : 'text-dl-text-dark'}`}>
                  {t(f.labelKey)}
                </div>
                <div className="text-dl-xs text-dl-text-light">{t(f.descKey)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Launch ── */}
      <button
        onClick={handleLaunch}
        disabled={loading || aiLoading || selectedMetrics.length === 0}
        className={`dl-btn-primary w-full py-2.5 text-dl-base font-black justify-center
          ${loading || aiLoading || selectedMetrics.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {loading ? t('common.saving') : t('onboarding.startAnalyzing')}
      </button>

      {!aiLoading && selectedMetrics.length === 0 && (
        <p className="text-dl-xs text-dl-text-light text-center mt-2">
          {t('onboarding.selectMetric')}
        </p>
      )}
    </div>
  )
}
