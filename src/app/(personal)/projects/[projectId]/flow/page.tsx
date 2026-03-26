'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, RefreshCw, Zap, AlertTriangle } from 'lucide-react'
import { useActiveSource } from '@/lib/context/ActiveSourceContext'
import { useProjectContext } from '@/lib/hooks/useProjectContext'
import { DataSourceSelector } from '@/components/DataSourceSelector'
import { InsightPanel } from '@/components/graph/InsightPanel'
import { BottomStrip } from '@/components/graph/BottomStrip'
import { GraphControls } from '@/components/graph/GraphControls'
import { SankeyChart } from '@/components/flow/SankeyChart'
import { KPIOrb } from '@/components/flow/KPIOrb'
import { FlowLegend } from '@/components/flow/FlowLegend'
import { transformGraphToSankey } from '@/lib/flow/transformGraphToSankey'
import type { SankeyTransformResult } from '@/lib/flow/transformGraphToSankey'

/* ------------------------------------------------------------------ */
/*  Types (same as graph page)                                        */
/* ------------------------------------------------------------------ */

interface GraphNode {
  id: string
  type: 'metric' | 'dimension' | 'kpi' | 'table' | 'date'
  label: string
  label_de?: string
  label_en?: string
  value: number | string | null
  trend?: number | null
  parent?: string
  metadata?: Record<string, unknown>
}

interface GraphData {
  nodes: GraphNode[]
  edges: { source: string; target: string; label?: string; weight?: number; color?: string; type?: string }[]
  industry?: { type: string; confidence: number }
  top_insights?: { text: string; type: 'warning' | 'positive' | 'info'; node_id?: string }[]
  categories?: { id: string; color: string; label_en?: string; label_de?: string }[]
}

/* ------------------------------------------------------------------ */
/*  Build progress steps                                              */
/* ------------------------------------------------------------------ */

const BUILD_STEPS = [
  { key: 'schema', en: 'Reading schema & sample data...', de: 'Schema & Beispieldaten werden gelesen...' },
  { key: 'detect', en: 'Detecting industry & KPIs...', de: 'Branche & KPIs werden erkannt...' },
  { key: 'flows', en: 'Mapping data flows...', de: 'Datenflüsse werden abgebildet...' },
  { key: 'layout', en: 'Computing flow layout...', de: 'Flow-Layout wird berechnet...' },
]

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function VisualFlowPage() {
  const { projectId } = useProjectContext()
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()
  const { activeSourceId } = useActiveSource()

  // State
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const insightCacheRef = useRef<Record<string, unknown>>({})

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  /* ---- Fetch existing graph ---- */
  const fetchGraph = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`/api/vil/graph?project_id=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setGraphData(data)
        setLoading(false)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [projectId])

  /* ---- Build graph ---- */
  const buildGraph = useCallback(async () => {
    if (!activeSourceId) return
    setBuilding(true)
    setBuildProgress([])
    setError(null)

    for (let i = 0; i < BUILD_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600))
      setBuildProgress(prev => [...prev, BUILD_STEPS[i].key])
    }

    try {
      const res = await fetch('/api/vil/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: activeSourceId, project_id: projectId }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(typeof errBody.error === 'string' ? errBody.error : 'Build failed')
      }
      const data = await res.json()
      setGraphData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build flow')
    } finally {
      setBuilding(false)
      setBuildProgress([])
    }
  }, [activeSourceId, projectId])

  /* ---- Initial load ---- */
  const hasBuilt = useRef(false)
  useEffect(() => {
    if (!activeSourceId) return
    if (graphData) return
    async function init() {
      const found = await fetchGraph()
      if (!found && !hasBuilt.current && !building) {
        hasBuilt.current = true
        buildGraph()
      }
    }
    init()
  }, [activeSourceId])

  /* ---- Transform to Sankey (memoized — only recomputes when graphData changes) ---- */
  const sankeyData = useMemo<SankeyTransformResult | null>(() => {
    if (!graphData) return null
    return transformGraphToSankey(graphData)
  }, [graphData])

  /* ---- Handlers ---- */
  const handleNodeClick = useCallback((nodeId: string) => {
    console.log('[Flow] Node clicked:', nodeId, 'graphData exists:', !!graphData)
    if (!graphData) return
    const node = graphData.nodes.find(n => n.id === nodeId)
    console.log('[Flow] Found node:', node?.id, node?.type, node?.label)
    if (node) {
      console.log('[Flow] Setting selectedNode')
      setSelectedNode(prev => {
        if (prev?.id === node.id) return null
        return node
      })
    }
  }, [graphData])

  const handleLinkClick = useCallback((sourceId: string, targetId: string) => {
    if (!graphData) return
    const srcNode = graphData.nodes.find(n => n.id === sourceId)
    const tgtNode = graphData.nodes.find(n => n.id === targetId)
    if (srcNode && tgtNode) {
      // Create synthetic node for the relationship
      setSelectedNode({
        id: `${sourceId}→${targetId}`,
        type: 'table',
        label: `${srcNode.label} → ${tgtNode.label}`,
        value: null,
        metadata: { table: (srcNode.metadata as any)?.table || '', business_role: 'relationship' },
      })
    }
  }, [graphData])

  const handleKPIClick = useCallback((kpiId: string) => {
    if (!graphData) return
    const node = graphData.nodes.find(n => n.id === kpiId)
    if (node) setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [graphData])

  const rebuild = useCallback(() => {
    setGraphData(null)
    setSelectedNode(null)
    hasBuilt.current = false
    buildGraph()
  }, [buildGraph])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }, [])

  const highlightNode = useCallback((nodeId?: string) => {
    if (!nodeId || !graphData) return
    const node = graphData.nodes.find(n => n.id === nodeId)
    if (node) setSelectedNode(node)
  }, [graphData])

  const narrative = graphData
    ? (locale === 'de' ? (graphData as any).narrative_de : (graphData as any).narrative_en)
    : null

  /* ---- Loading / building ---- */
  if (loading || building) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white text-gray-900">
        <div className="flex flex-col items-center gap-8 max-w-sm">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center animate-pulse">
              <Zap size={28} className="text-white" />
            </div>
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 opacity-30 animate-ping" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold">
              {building ? t('flow.building') : t('flow.loading')}
            </h2>
            <p className="text-sm text-gray-500">
              {building ? t('flow.buildingDesc') : t('flow.loadingDesc')}
            </p>
          </div>
          {building && (
            <div className="w-full space-y-3">
              {BUILD_STEPS.map((step, i) => {
                const done = buildProgress.includes(step.key)
                const active = !done && buildProgress.length === i
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500
                      ${done ? 'bg-emerald-500/10 border border-emerald-500/20' : active ? 'bg-gray-100 border border-gray-200' : 'opacity-30'}`}
                  >
                    {done ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ) : active ? (
                      <Loader2 size={18} className="text-gray-500 animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${done ? 'text-emerald-500' : active ? 'text-gray-700' : 'text-gray-400'}`}>
                      {locale === 'de' ? step.de : step.en}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ---- No data ---- */
  if (!graphData && !loading && !building) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white text-gray-900">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          {error ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold">{t('flow.buildFailed')}</h2>
                <p className="text-sm text-gray-500">{error}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                <Zap size={24} className="text-gray-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold">{t('flow.noFlow')}</h2>
                <p className="text-sm text-gray-500">{t('flow.noFlowDesc')}</p>
              </div>
            </>
          )}
          <button
            onClick={buildGraph}
            disabled={!activeSourceId}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl
              hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('flow.buildNow')}
          </button>
          {!activeSourceId && (
            <p className="text-xs text-gray-400">{t('flow.selectSourceFirst')}</p>
          )}
        </div>
      </div>
    )
  }

  /* ---- No relationships (single table) ---- */
  if (sankeyData && !sankeyData.hasRelationships) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white text-gray-900">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
            <Zap size={24} className="text-gray-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">{t('flow.noFlow')}</h2>
            <p className="text-sm text-gray-500">{t('flow.noRelationships')}</p>
          </div>
        </div>
      </div>
    )
  }

  /* ---- Main flow view ---- */
  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 overflow-hidden">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-tight">{t('flow.title')}</h1>
          {graphData?.industry && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-200">
              {graphData.industry.type} &middot; {Math.round(graphData.industry.confidence * 100)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DataSourceSelector />
          <GraphControls
            onRefresh={rebuild}
            onEdit={() => {}}
            onFullscreen={toggleFullscreen}
            editMode={false}
          />
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Left: narrative + Sankey */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Narrative */}
          {narrative && (
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <p className="text-sm text-gray-600 leading-relaxed">{narrative}</p>
            </div>
          )}

          {/* Top 5 KPIs */}
          {sankeyData && sankeyData.kpiNodes.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center justify-center gap-5">
                {sankeyData.kpiNodes.slice(0, 5).map(kpi => (
                  <KPIOrb
                    key={kpi.id}
                    label={kpi.label}
                    value={kpi.value ?? 0}
                    unit={kpi.unit}
                    health={kpi.health}
                    trend={kpi.trend}
                    x={0}
                    y={0}
                    onClick={() => handleKPIClick(kpi.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sankey canvas */}
          <div
            className="flex-1 relative"
            ref={containerRef}
            style={{
              minHeight: 0,
              backgroundColor: '#fafafa',
              backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {sankeyData && (
              <SankeyChart
                nodes={sankeyData.sankeyNodes}
                links={sankeyData.sankeyLinks}
                onNodeClick={handleNodeClick}
                onLinkClick={handleLinkClick}
                selectedNodeId={selectedNode?.id || null}
              />
            )}


            {/* Legend */}
            <FlowLegend
              categories={(graphData as any)?.categories}
              locale={locale}
            />
          </div>
        </div>

        {/* Right: InsightPanel */}
        <div
          className={`transition-all duration-300 ease-out overflow-hidden flex-shrink-0
            ${selectedNode ? 'w-[380px] border-l border-gray-200' : 'w-0'}`}
        >
          {selectedNode && (
            <InsightPanel
              node={selectedNode}
              graphData={graphData}
              onClose={() => setSelectedNode(null)}
              projectId={projectId}
              locale={locale}
              sourceId={activeSourceId || ''}
              insightCache={insightCacheRef.current}
            />
          )}
        </div>
      </div>

      {/* Bottom strip */}
      <BottomStrip
        insights={graphData?.top_insights || []}
        onInsightClick={highlightNode}
      />
    </div>
  )
}
