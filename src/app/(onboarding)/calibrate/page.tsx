'use client'

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

type ConnectInfo = {
  files: { name: string; rows: number; columns: ColumnMeta[]; sampleRows?: string[][] }[]
  connectedSources: string[]
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
  { id: 'realtime', icon: Zap, label: 'Real-time', desc: 'Continuous sync' },
  { id: 'hourly', icon: Clock, label: 'Hourly', desc: 'Every hour' },
  { id: 'daily', icon: Calendar, label: 'Daily', desc: 'Once per day' },
  { id: 'weekly', icon: BarChart3, label: 'Weekly', desc: 'Once per week' },
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

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CalibratePage() {
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
      if (filesWithColumns.length > 0) {
        fetchAISuggestions({ ...info, files: filesWithColumns })
      }
    } catch { /* ignore */ }
  }, [])

  async function fetchAISuggestions(info: ConnectInfo) {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/onboarding/suggest-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: info.files }),
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

        const { error: insertError } = await supabase.from('data_sources').insert({
          workspace_id: user.id,
          name: file.name,
          source_type: ext,
          category: 'file',
          status: 'active',
          row_count: file.rows || 0,
          schema_snapshot: schemaSnapshot,
          sample_data: sampleData,
          sync_frequency: 'manual',
        })

        if (insertError) {
          console.error(`Failed to save data source "${file.name}":`, insertError)
        } else {
          savedCount++
        }
      }

      console.log(`Saved ${savedCount}/${files.length} file sources to database`)

      // 3. Verify sources exist before redirecting
      const { count } = await supabase
        .from('data_sources')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', user.id)
        .eq('status', 'active')

      console.log(`Active data sources in DB: ${count}`)

      localStorage.removeItem('datalaser_connect_info')
      router.push('/app/insights')
    } catch (err) {
      console.error('Launch error:', err)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pt-12 px-6 pb-24">
      <StepIndicator current={3} labels={['Workspace', 'Connect', 'Calibrate']} />

      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">Almost there</h1>
      <p className="text-mb-text-medium text-mb-base mb-8">
        {aiLoading
          ? 'Analyzing your data with AI...'
          : dataSummary
            ? dataSummary
            : hasColumnData
              ? `Analyzing ${totalColumns} fields from your data...`
              : 'Tell the AI what metrics matter most to you.'}
      </p>

      {/* ── Data summary ── */}
      {(hasUploadedFiles || hasConnectedDatabases) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {connectInfo?.files.map(f => (
            <div key={f.name} className="flex items-center gap-2 px-3 py-1.5 rounded-mb-md bg-mb-bg-light border border-mb-border">
              <FileText className="w-3.5 h-3.5 text-mb-text-light" />
              <span className="text-mb-xs font-bold text-mb-text-dark">{f.name}</span>
              <span className="text-mb-xs text-mb-text-light">
                {f.columns?.length ?? 0} fields &middot; {f.rows.toLocaleString()} rows
              </span>
            </div>
          ))}
          {connectInfo?.connectedSources.map(s => (
            <div key={s} className="flex items-center gap-2 px-3 py-1.5 rounded-mb-md bg-mb-bg-light border border-mb-border">
              <Database className="w-3.5 h-3.5 text-mb-text-light" />
              <span className="text-mb-xs font-bold text-mb-text-dark">{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── AI Loading state ── */}
      {aiLoading && (
        <div className="mb-8 flex flex-col items-center justify-center py-12 mb-card">
          <Loader2 className="w-8 h-8 text-mb-brand animate-spin mb-3" />
          <p className="text-mb-sm font-bold text-mb-text-dark">AI is analyzing your data</p>
          <p className="text-mb-xs text-mb-text-light mt-1">
            Identifying columns, data types, and meaningful metrics...
          </p>
        </div>
      )}

      {/* ── AI Error ── */}
      {aiError && (
        <div className="mb-6 px-4 py-3 rounded-mb-md bg-red-50 border border-mb-error">
          <p className="text-mb-sm font-bold text-mb-error">Couldn&apos;t analyze data automatically</p>
          <p className="text-mb-xs text-mb-text-medium mt-1">{aiError}</p>
          <button
            onClick={() => connectInfo && fetchAISuggestions(connectInfo)}
            className="mb-btn-secondary text-mb-xs mt-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── AI-suggested metrics ── */}
      {!aiLoading && aiMetrics.length > 0 && (
        <div className="mb-6">
          <label className="mb-label flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-mb-brand" />
            AI-suggested metrics from your data
          </label>
          <div className="space-y-1.5 mt-2">
            {aiMetrics.map(m => (
              <button
                key={m.name}
                onClick={() => toggleMetric(m.name)}
                className={`
                  w-full flex items-center justify-between px-4 py-3
                  border rounded-mb-md cursor-pointer transition-all text-left
                  ${selectedMetrics.includes(m.name)
                    ? 'border-mb-brand bg-mb-brand-hover'
                    : 'border-mb-border-dark hover:border-mb-brand hover:bg-mb-brand-hover'}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-4 h-4 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors
                    ${selectedMetrics.includes(m.name) ? 'border-mb-brand bg-mb-brand' : 'border-mb-border-dark'}`}
                  >
                    {selectedMetrics.includes(m.name) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-mb-sm font-bold ${selectedMetrics.includes(m.name) ? 'text-mb-brand' : 'text-mb-text-dark'}`}>
                        {m.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-mb-bg-medium text-mb-text-light uppercase flex-shrink-0">
                        {AGG_LABELS[m.aggregation] || m.aggregation}
                      </span>
                    </div>
                    <p className="text-mb-xs text-mb-text-light mt-0.5 truncate">{m.reason}</p>
                  </div>
                </div>
                <span className="text-mb-xs text-mb-text-light font-mono flex-shrink-0 ml-3">
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
          <label className="mb-label flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-purple-500" />
            Dimensions to group &amp; filter by
          </label>
          <div className="space-y-1 mt-2">
            {aiDimensions.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-mb-md bg-mb-bg-light border border-mb-border"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Tag className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="text-mb-sm font-bold text-mb-text-dark">{d.name}</span>
                </div>
                <span className="text-mb-xs text-mb-text-light ml-3 truncate max-w-64">{d.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Fallback when no data or AI hasn't run — generic metric chips ── */}
      {!aiLoading && !hasColumnData && aiMetrics.length === 0 && (
        <div className="mb-6">
          <label className="mb-label">Key metrics you track</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {['Revenue', 'MRR', 'Churn Rate', 'CAC', 'LTV', 'Conversion Rate',
              'Ad Spend', 'ROAS', 'Avg Order Value', 'Gross Margin', 'Burn Rate', 'NPS',
            ].map(m => (
              <button
                key={m}
                onClick={() => toggleMetric(m)}
                className={`
                  border rounded-mb-md px-4 py-2.5
                  text-mb-sm font-bold cursor-pointer transition-all
                  ${selectedMetrics.includes(m)
                    ? 'border-mb-brand text-mb-brand bg-mb-brand-hover'
                    : 'border-mb-border-dark text-mb-text-medium hover:border-mb-brand hover:text-mb-brand hover:bg-mb-brand-hover'}
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
              className="flex items-center gap-1.5 border border-mb-brand text-mb-brand bg-mb-brand-hover rounded-mb-md px-3 py-1.5 text-mb-sm font-bold"
            >
              {m}
              <button onClick={() => removeCustomMetric(m)} className="hover:text-mb-error transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Add custom metric ── */}
      <div className="mb-8">
        <label className="mb-label">Add a custom metric</label>
        <div className="flex gap-2 mt-1">
          <input
            className="mb-input flex-1"
            placeholder="e.g. Customer Retention Rate"
            value={customMetric}
            onChange={e => setCustomMetric(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomMetric()}
          />
          <button
            onClick={addCustomMetric}
            disabled={!customMetric.trim()}
            className={`mb-btn-secondary flex items-center gap-1.5 ${!customMetric.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* ── Sync frequency — only for connected databases ── */}
      {hasConnectedDatabases && (
        <div className="mb-8">
          <label className="mb-label">How often should data sync?</label>
          <p className="text-mb-xs text-mb-text-light mb-2">
            Applies to your connected databases &amp; apps. Uploaded files are imported once.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FREQUENCIES.map(f => (
              <button
                key={f.id}
                onClick={() => setFrequency(f.id)}
                className={`
                  border rounded-mb-md p-4 text-left cursor-pointer transition-all
                  ${frequency === f.id
                    ? 'border-mb-brand bg-mb-brand-hover'
                    : 'border-mb-border-dark hover:border-mb-brand'}
                `}
              >
                <f.icon
                  className={`w-5 h-5 mb-2 ${frequency === f.id ? 'text-mb-brand' : 'text-mb-text-light'}`}
                />
                <div className={`text-mb-sm font-black ${frequency === f.id ? 'text-mb-brand' : 'text-mb-text-dark'}`}>
                  {f.label}
                </div>
                <div className="text-mb-xs text-mb-text-light">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Launch ── */}
      <button
        onClick={handleLaunch}
        disabled={loading || aiLoading || selectedMetrics.length === 0}
        className={`mb-btn-primary w-full py-2.5 text-mb-base font-black justify-center
          ${loading || aiLoading || selectedMetrics.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Launching...' : 'Launch DataLaser'}
      </button>

      {!aiLoading && selectedMetrics.length === 0 && (
        <p className="text-mb-xs text-mb-text-light text-center mt-2">
          Select at least one metric to continue
        </p>
      )}
    </div>
  )
}
