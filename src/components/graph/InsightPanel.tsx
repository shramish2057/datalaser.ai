'use client'

import { useCallback } from 'react'
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
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface GraphNode {
  id: string
  label: string
  type: 'metric' | 'dimension' | 'kpi'
  value?: string | number
  trend?: 'up' | 'down' | 'flat'
  importance?: number
  insight?: string
  verified?: boolean
  values?: { label: string; count: number }[]
  formula?: string
  unit?: string
}

interface GraphData {
  nodes: GraphNode[]
  edges: { source: string; target: string; label?: string; weight?: number }[]
  industry?: { type: string; confidence: number }
  top_insights?: { text: string; type: 'warning' | 'positive' | 'info'; node_id?: string }[]
}

interface InsightPanelProps {
  node: GraphNode
  graphData: GraphData | null
  onClose: () => void
  projectId: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const TYPE_ICON: Record<string, typeof TrendingUp> = {
  metric: TrendingUp,
  dimension: Layers,
  kpi: SigmaIcon,
  date: Calendar,
  id: Hash,
}

const TYPE_COLOR: Record<string, string> = {
  metric: '#10b981',
  dimension: '#3b82f6',
  kpi: '#7c3aed',
  date: '#f59e0b',
  id: '#71717a',
}

const TYPE_BG: Record<string, string> = {
  metric: 'bg-emerald-500/10 border-emerald-500/20',
  dimension: 'bg-blue-500/10 border-blue-500/20',
  kpi: 'bg-purple-500/10 border-purple-500/20',
  date: 'bg-amber-500/10 border-amber-500/20',
  id: 'bg-zinc-500/10 border-zinc-500/20',
}

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function InsightPanel({ node, graphData, onClose, projectId }: InsightPanelProps) {
  const t = useTranslations()
  const router = useRouter()

  const Icon = TYPE_ICON[node.type] || CircleDot
  const TrendIcon = node.trend ? TREND_ICON[node.trend] : null

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
    <div className="h-full flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[#222222]">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${TYPE_BG[node.type]}`}>
            <Icon size={18} style={{ color: TYPE_COLOR[node.type] }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{node.label}</h2>
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
          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <X size={16} className="text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* ---- METRIC ---- */}
        {node.type === 'metric' && (
          <>
            {/* Value + trend */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tracking-tight">
                  {node.value !== undefined ? String(node.value) : '--'}
                </span>
                {node.unit && (
                  <span className="text-sm text-zinc-400">{node.unit}</span>
                )}
                {TrendIcon && (
                  <span className={`flex items-center gap-1 text-xs font-medium
                    ${node.trend === 'up' ? 'text-emerald-400' : node.trend === 'down' ? 'text-red-400' : 'text-zinc-400'}`}>
                    <TrendIcon size={14} />
                    {node.trend}
                  </span>
                )}
              </div>
            </div>

            {/* Insight */}
            {node.insight && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                {node.verified && (
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">{t('graph.verified')}</span>
                  </div>
                )}
                <p className="text-sm text-zinc-300 leading-relaxed">{node.insight}</p>
              </div>
            )}

            {/* Sparkline placeholder */}
            <div className="h-16 bg-zinc-900/40 border border-zinc-800/50 rounded-xl flex items-center justify-center">
              <span className="text-xs text-zinc-500">{t('graph.sparklinePlaceholder')}</span>
            </div>
          </>
        )}

        {/* ---- DIMENSION ---- */}
        {node.type === 'dimension' && (
          <>
            {/* Entity count */}
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-blue-400" />
              <span className="text-sm text-zinc-300">
                {node.values?.length || 0} {t('graph.entities')}
              </span>
            </div>

            {/* Value bars */}
            {node.values && node.values.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {t('graph.topValues')}
                </h3>
                <div className="space-y-1.5">
                  {node.values.slice(0, 8).map((v, i) => {
                    const max = Math.max(...node.values!.map(x => x.count))
                    const pct = max > 0 ? (v.count / max) * 100 : 0
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-300 truncate max-w-[200px]">{v.label}</span>
                          <span className="text-xs text-zinc-500 tabular-nums">{v.count.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500/60 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Distribution insight */}
            {node.insight && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5">
                <p className="text-sm text-zinc-300 leading-relaxed">{node.insight}</p>
              </div>
            )}
          </>
        )}

        {/* ---- KPI ---- */}
        {node.type === 'kpi' && (
          <>
            {/* Computed value */}
            <div className="space-y-1">
              <span className="text-3xl font-bold text-white tracking-tight">
                {node.value !== undefined ? String(node.value) : '--'}
              </span>
              {TrendIcon && (
                <div className={`flex items-center gap-1 text-sm
                  ${node.trend === 'up' ? 'text-emerald-400' : node.trend === 'down' ? 'text-red-400' : 'text-zinc-400'}`}>
                  <TrendIcon size={16} />
                  <span>{node.trend}</span>
                </div>
              )}
            </div>

            {/* Formula */}
            {node.formula && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {t('graph.formula')}
                </span>
                <p className="text-sm text-purple-300 font-mono">{node.formula}</p>
              </div>
            )}

            {/* Historical trend placeholder */}
            <div className="h-20 bg-zinc-900/40 border border-zinc-800/50 rounded-xl flex items-center justify-center">
              <span className="text-xs text-zinc-500">{t('graph.trendPlaceholder')}</span>
            </div>
          </>
        )}

        {/* Connected nodes */}
        {connectedNodes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {t('graph.connections')} ({connectedNodes.length})
            </h3>
            <div className="space-y-1">
              {connectedNodes.slice(0, 6).map(n => (
                <div key={n.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: TYPE_COLOR[n.type] }}
                  />
                  <span className="text-xs text-zinc-300 truncate">{n.label}</span>
                  <span className="text-xs text-zinc-600 ml-auto flex-shrink-0">{n.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 pt-3 border-t border-[#222222] space-y-2">
        <button
          onClick={() => navigate('ask')}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50
            hover:bg-zinc-700/80 hover:border-zinc-600 transition-all text-sm text-white"
        >
          <MessageSquare size={15} className="text-zinc-400 flex-shrink-0" />
          {t('graph.askAbout')}
        </button>
        <button
          onClick={() => navigate('insights')}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50
            hover:bg-zinc-700/80 hover:border-zinc-600 transition-all text-sm text-white"
        >
          <BarChart3 size={15} className="text-zinc-400 flex-shrink-0" />
          {t('graph.runAnalysis')}
        </button>
        <button
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50
            hover:bg-zinc-700/80 hover:border-zinc-600 transition-all text-sm text-white"
        >
          <PlusCircle size={15} className="text-zinc-400 flex-shrink-0" />
          {t('graph.addToStudio')}
        </button>
        <button
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50
            hover:bg-zinc-700/80 hover:border-zinc-600 transition-all text-sm text-white"
        >
          <Bell size={15} className="text-zinc-400 flex-shrink-0" />
          {t('graph.setAlert')}
        </button>
      </div>
    </div>
  )
}
