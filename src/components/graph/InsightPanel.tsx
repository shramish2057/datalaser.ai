'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  BarChart3,
  PlusCircle,
  Bell,
  ShieldCheck,
  Hash,
  Layers,
  Sigma as SigmaIcon,
  Calendar,
  CircleDot,
  Table2,
  Loader2,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface GraphNode {
  id: string
  label: string
  type: string
  value?: string | number | null
  trend?: number | string | null
  importance?: number
  insight?: string
  verified?: boolean
  values?: { label: string; count: number }[]
  formula?: string
  unit?: string
  parent?: string
  metadata?: Record<string, unknown>
}

interface GraphData {
  nodes: GraphNode[]
  edges: { source: string; target: string; label?: string; weight?: number; color?: string }[]
  industry?: { type: string; confidence: number }
  top_insights?: { text: string; type: 'warning' | 'positive' | 'info'; node_id?: string }[]
}

interface InsightPanelProps {
  node: GraphNode
  graphData: GraphData | null
  onClose: () => void
  projectId: string
  locale?: string
  sourceId?: string
  insightCache?: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const TYPE_ICON: Record<string, typeof TrendingUp> = {
  table: Table2,
  metric: TrendingUp,
  dimension: Layers,
  kpi: SigmaIcon,
  date: Calendar,
  id: Hash,
}

const TYPE_COLOR: Record<string, string> = {
  table: '#71717a',
  metric: '#10b981',
  dimension: '#3b82f6',
  kpi: '#7c3aed',
  date: '#f59e0b',
  id: '#71717a',
}

const TYPE_BG: Record<string, string> = {
  table: 'bg-zinc-100 border-zinc-200',
  metric: 'bg-emerald-50 border-emerald-200',
  dimension: 'bg-blue-50 border-blue-200',
  kpi: 'bg-purple-50 border-purple-200',
  date: 'bg-amber-50 border-amber-200',
  id: 'bg-zinc-100 border-zinc-200',
}

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function InsightPanel({ node, graphData, onClose, projectId, locale = 'en', sourceId = '', insightCache = {} }: InsightPanelProps) {
  const t = useTranslations()
  const router = useRouter()

  type InsightData = {
    trend_text?: string,
    finding: string,
    recommendation: string,
    financial_impact?: string,
    data_points: {label: string, value: string, severity: string}[]
  }
  const [insight, setInsight] = useState<InsightData | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  useEffect(() => {
    if (!node) return

    // Check external cache first — only use if it has a valid finding
    const cached = insightCache[node.id] as InsightData | undefined
    if (cached && cached.finding) {
      setInsight(cached)
      setInsightLoading(false)
      return
    }

    setInsight(null)
    setInsightLoading(true)

    const tableName = (node.metadata as Record<string, unknown>)?.table || ''
    const columnName = (node.metadata as Record<string, unknown>)?.column || ''

    fetch('/api/vil/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: sourceId,
        table_name: tableName,
        column_name: columnName,
        node_type: node.type,
        node_label: node.label,
        node_value: node.value,
        business_role: (node.metadata as Record<string, unknown>)?.business_role || '',
        locale,
      }),
    })
    .then(r => r.json())
    .then(data => {
      // Only cache successful responses with actual findings
      if (data && data.finding) {
        insightCache[node.id] = data
      }
      setInsight(data)
    })
    .catch(() => {})
    .finally(() => setInsightLoading(false))
  }, [node?.id])

  const Icon = TYPE_ICON[node.type] || CircleDot
  const trendDir = typeof node.trend === 'number' ? (node.trend > 0 ? 'up' : node.trend < 0 ? 'down' : 'flat') : (node.trend || 'flat')
  const TrendIcon = TREND_ICON[trendDir as keyof typeof TREND_ICON] || null

  // Connected nodes
  const connectedEdges = graphData?.edges.filter(
    e => e.source === node.id || e.target === node.id
  ) || []
  const connectedNodeIds = connectedEdges.map(e =>
    e.source === node.id ? e.target : e.source
  )
  const connectedNodes = graphData?.nodes.filter(n =>
    connectedNodeIds.includes(n.id)
  ) || []

  const navigate = useCallback((path: string) => {
    router.push(`/projects/${projectId}/${path}`)
  }, [router, projectId])

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-200">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${TYPE_BG[node.type]}`}>
            <Icon size={18} style={{ color: TYPE_COLOR[node.type] }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 truncate">{node.label}</h2>
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: TYPE_COLOR[node.type] }}
            >
              {node.type}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Value display */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-gray-900">
            {node.value != null ? (typeof node.value === 'number' ? node.value.toLocaleString() : node.value) : '\u2014'}
          </span>
          {node.trend && (
            <span className={`text-sm font-semibold ${node.trend === 'up' ? 'text-emerald-600' : node.trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
              {node.trend === 'up' ? '\u2191' : node.trend === 'down' ? '\u2193' : '\u2192'} {node.trend}
            </span>
          )}
        </div>
      </div>

      {/* Insight content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {insightLoading ? (
          <div className="flex flex-col items-center gap-3 text-gray-400 text-sm py-12">
            <Loader2 size={20} className="animate-spin" />
            <span>{locale === 'de' ? 'Analyse wird erstellt...' : 'Generating insight...'}</span>
          </div>
        ) : insight ? (
          <>
            {/* Trend line */}
            {insight.trend_text && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                <p className="text-sm font-semibold text-gray-900">{insight.trend_text}</p>
              </div>
            )}

            {/* Verified Finding */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">{t('graph.verified')}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{insight.finding}</p>
            </div>

            {/* Financial Impact (most important for CFO) */}
            {insight.financial_impact && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
                  {locale === 'de' ? 'Finanzieller Einfluss' : 'Financial Impact'}
                </p>
                <p className="text-sm font-bold text-amber-700">{insight.financial_impact}</p>
              </div>
            )}

            {/* Recommendation */}
            {insight.recommendation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
                  {locale === 'de' ? 'Empfehlung' : 'Recommendation'}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{insight.recommendation}</p>
              </div>
            )}

            {/* Data Points */}
            {insight.data_points?.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-200">
                {insight.data_points.map((dp, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-gray-500">{dp.label}</span>
                    <span className={`text-sm font-bold ${
                      dp.severity === 'critical' ? 'text-red-500' :
                      dp.severity === 'warning' ? 'text-amber-500' :
                      dp.severity === 'success' ? 'text-emerald-500' : 'text-gray-700'
                    }`}>{dp.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            {locale === 'de' ? 'Klicken Sie auf einen Knoten' : 'Click a node to see insights'}
          </p>
        )}

        {/* Connected nodes */}
        {connectedNodes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t('graph.connections')} ({connectedNodes.length})
            </h3>
            <div className="space-y-1">
              {connectedNodes.slice(0, 6).map(n => (
                <div key={n.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: TYPE_COLOR[n.type] }}
                  />
                  <span className="text-xs text-gray-700 truncate">{n.label}</span>
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{n.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 pt-3 border-t border-gray-200 space-y-2">
        <button
          onClick={() => navigate('ask')}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200
            hover:bg-gray-100 hover:border-gray-300 transition-all text-sm text-gray-700"
        >
          <MessageSquare size={15} className="text-gray-400 flex-shrink-0" />
          {t('graph.askAbout')}
        </button>
        <button
          onClick={() => navigate('insights')}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200
            hover:bg-gray-100 hover:border-gray-300 transition-all text-sm text-gray-700"
        >
          <BarChart3 size={15} className="text-gray-400 flex-shrink-0" />
          {t('graph.runAnalysis')}
        </button>
        <button
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200
            hover:bg-gray-100 hover:border-gray-300 transition-all text-sm text-gray-700"
        >
          <PlusCircle size={15} className="text-gray-400 flex-shrink-0" />
          {t('graph.addToStudio')}
        </button>
        <button
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200
            hover:bg-gray-100 hover:border-gray-300 transition-all text-sm text-gray-700"
        >
          <Bell size={15} className="text-gray-400 flex-shrink-0" />
          {t('graph.setAlert')}
        </button>
      </div>
    </div>
  )
}
