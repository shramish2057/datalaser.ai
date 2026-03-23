'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { BarChart2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTeamProjectContext } from '@/lib/teamContext'

type InsightDoc = {
  id: string; title: string; executive_summary: string
  severity_chips: { label: string; type: string }[]
  kpis: { name: string; value: string; change: string; positive: boolean }[]
  key_findings: { headline: string; explanation: string; severity: string }[]
  recommendations: { text: string; priority: string; impact?: string }[]
  generated_at: string
}

const CYCLING_MESSAGES = [
  'Connecting to your data sources...', 'Sampling rows across all tables...',
  'Building context for AI analysis...', 'Claude is reading your business data...',
  'Identifying patterns and anomalies...', 'Writing executive summary...',
  'Generating recommendations...', 'Almost there...',
]

export default function TeamInsightsPage() {
  const t = useTranslations()
  const { projectId, base } = useTeamProjectContext()
  const [state, setState] = useState<'loading' | 'no-sources' | 'generating' | 'ready'>('loading')
  const [doc, setDoc] = useState<InsightDoc | null>(null)
  const [cycleIdx, setCycleIdx] = useState(0)
  const router = useRouter()
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const loadInsights = useCallback(async () => {
    if (!projectId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { count } = await supabase.from('data_sources').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'active')
    if (!count || count === 0) { setState('no-sources'); return }
    const { data: docs } = await supabase.from('insight_documents').select('*').eq('project_id', projectId).order('generated_at', { ascending: false }).limit(1)
    if (docs && docs.length > 0) { setDoc(docs[0] as unknown as InsightDoc); setState('ready'); return }
    setState('generating')
    try {
      const res = await fetch('/api/insights/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projectId }) })
      const json = await res.json()
      if (json.success && json.document) { setDoc(json.document as InsightDoc); setState('ready') } else { setState('no-sources') }
    } catch { setState('no-sources') }
  }, [projectId, supabase, router])

  useEffect(() => { loadInsights() }, [loadInsights])
  useEffect(() => {
    if (state !== 'generating') return
    const interval = setInterval(() => setCycleIdx(prev => (prev + 1) % CYCLING_MESSAGES.length), 2500)
    return () => clearInterval(interval)
  }, [state])

  const regenerate = async () => {
    setState('generating'); setCycleIdx(0)
    try {
      const res = await fetch('/api/insights/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projectId }) })
      const json = await res.json()
      if (json.success && json.document) { setDoc(json.document as InsightDoc); setState('ready') }
    } catch { if (doc) setState('ready') }
  }

  if (state === 'no-sources') return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-dl-bg-medium flex items-center justify-center mx-auto mb-4"><BarChart2 size={28} className="text-dl-text-light" /></div>
        <h2 className="text-dl-xl font-black text-dl-text-dark mb-2">Connect your first database</h2>
        <p className="text-dl-text-medium text-dl-base mb-6">DataLaser needs a data source to generate insights.</p>
        <button className="dl-btn-primary px-6 py-2" onClick={() => router.push(`${base}/sources/new`)}>Add a database</button>
      </div>
    </div>
  )

  if (state === 'loading' || state === 'generating') return (
    <div className="max-w-[860px] mx-auto px-6 py-8 space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-4 h-4 rounded-full border-2 border-dl-brand border-t-transparent animate-spin" />
        <span className="text-dl-text-medium text-dl-base font-bold">{state === 'loading' ? t('common.loading') : CYCLING_MESSAGES[cycleIdx]}</span>
      </div>
      <div className="h-28 rounded-dl-lg dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" />
      <div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-10 rounded-dl-md dl-shimmer" /><div className="h-56 rounded-dl-lg dl-shimmer" />
    </div>
  )

  if (!doc) return null

  return (
    <div className="max-w-[860px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-dl-2xl font-black text-dl-text-dark">{doc.title}</h1>
          <p className="text-dl-text-light text-dl-sm mt-0.5">Generated {formatDistanceToNow(new Date(doc.generated_at))} ago</p>
        </div>
        <div className="flex items-center">
          <button onClick={regenerate} className="dl-btn-subtle gap-1.5 text-dl-sm">↻ Regenerate</button>
          <button className="dl-btn-subtle gap-1.5 text-dl-sm ml-1">⬇ Export</button>
        </div>
      </div>

      <div className="mb-6 p-5 rounded-dl-lg bg-dl-bg border border-dl-border shadow-dl-sm">
        <div className="flex items-center gap-2 mb-3"><div className="w-2 h-2 rounded-full bg-dl-success" /><span className="dl-section-header">AI Executive Summary</span></div>
        <p className="text-dl-text-dark text-dl-base leading-relaxed">{doc.executive_summary}</p>
        {doc.severity_chips?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {doc.severity_chips.map(chip => (
              <span key={chip.label} className={chip.type === 'positive' ? 'dl-badge-success' : chip.type === 'warning' ? 'dl-badge-warning' : chip.type === 'critical' ? 'dl-badge-error' : 'dl-badge-neutral'}>{chip.label}</span>
            ))}
          </div>
        )}
      </div>

      {doc.kpis?.length > 0 && (
        <div className="mb-6"><p className="dl-section-header mb-3">Key Metrics</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {doc.kpis.map(kpi => (
              <div key={kpi.name} className="bg-dl-bg rounded-dl-lg border border-dl-border p-4 shadow-dl-sm">
                <p className="text-dl-xs font-bold text-dl-text-light uppercase tracking-wider mb-1">{kpi.name}</p>
                <p className="text-dl-2xl font-black text-dl-text-dark font-mono">{kpi.value}</p>
                <p className={`text-dl-sm font-bold mt-0.5 ${kpi.positive ? 'text-dl-success' : 'text-dl-error'}`}>{kpi.positive ? '↑' : '↓'} {kpi.change}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {doc.key_findings?.length > 0 && (
        <div className="mb-6"><p className="dl-section-header mb-3">Key Findings</p>
          {doc.key_findings.map((f, i) => (
            <div key={i} className="flex gap-4 py-4 border-b border-dl-border last:border-0">
              <span className="text-dl-xl font-black text-dl-text-light w-6 flex-shrink-0">{i + 1}</span>
              <div className="flex-1">
                <p className="font-black text-dl-text-dark text-dl-base mb-1">{f.headline}</p>
                <p className="text-dl-text-medium text-dl-sm leading-relaxed">{f.explanation}</p>
                <span className={`inline-block mt-2 ${f.severity === 'positive' ? 'dl-badge-success' : f.severity === 'warning' ? 'dl-badge-warning' : f.severity === 'critical' ? 'dl-badge-error' : 'dl-badge-neutral'}`}>{f.severity}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {doc.recommendations?.length > 0 && (
        <div className="mb-6"><p className="dl-section-header mb-3">Recommendations</p>
          {doc.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 py-3 border-b border-dl-border last:border-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-dl-xs font-bold mt-0.5 flex-shrink-0 ${rec.priority === 'high' ? 'bg-red-100 text-red-700' : rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-dl-brand'}`}>{rec.priority}</span>
              <div className="flex-1">
                <p className="text-dl-text-dark text-dl-sm font-bold">{rec.text}</p>
                {rec.impact && <p className="text-dl-text-light text-dl-xs mt-0.5">{rec.impact}</p>}
              </div>
              <button className="dl-btn-subtle text-dl-xs py-1 px-2 flex-shrink-0">Assign</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-dl-border">
        <p className="text-dl-text-medium text-dl-sm">Want to dig deeper into this data?</p>
        <div className="flex gap-2">
          <button className="dl-btn-primary" onClick={() => router.push(`${base}/ask`)}>Ask a question</button>
          <button className="dl-btn-secondary" onClick={() => router.push(`${base}/dashboard`)}>Build a dashboard</button>
        </div>
      </div>
    </div>
  )
}
