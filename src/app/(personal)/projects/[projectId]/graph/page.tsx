'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, RefreshCw, Zap, AlertTriangle } from 'lucide-react'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import Sigma from 'sigma'
import { useActiveSource } from '@/lib/context/ActiveSourceContext'
import { DataSourceSelector } from '@/components/DataSourceSelector'
import { InsightPanel } from '@/components/graph/InsightPanel'
import { BottomStrip } from '@/components/graph/BottomStrip'
import { GraphControls } from '@/components/graph/GraphControls'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
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

interface GraphEdge {
  source: string
  target: string
  label?: string
  weight?: number
  color?: string
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  industry?: { type: string; confidence: number }
  top_insights?: { text: string; type: 'warning' | 'positive' | 'info'; node_id?: string }[]
}

/* ------------------------------------------------------------------ */
/*  Build progress steps                                              */
/* ------------------------------------------------------------------ */

const BUILD_STEPS = [
  { key: 'schema', en: 'Reading schema & sample data...', de: 'Schema & Beispieldaten werden gelesen...' },
  { key: 'detect', en: 'Detecting industry & KPIs...', de: 'Branche & KPIs werden erkannt...' },
  { key: 'metrics', en: 'Mapping metrics & dimensions...', de: 'Metriken & Dimensionen werden zugeordnet...' },
  { key: 'relations', en: 'Building relationships...', de: 'Beziehungen werden aufgebaut...' },
  { key: 'layout', en: 'Computing graph layout...', de: 'Graph-Layout wird berechnet...' },
]

/* ------------------------------------------------------------------ */
/*  Color palette                                                     */
/* ------------------------------------------------------------------ */

const NODE_COLORS: Record<string, string> = {
  table: '#71717a',     // zinc - neutral for tables
  metric: '#10b981',    // emerald - measures
  kpi: '#7c3aed',       // purple - computed KPIs
  dimension: '#3b82f6', // blue - categories
  date: '#f59e0b',      // amber - temporal
}

const NODE_HIGHLIGHT: Record<string, string> = {
  metric: '#34d399',
  dimension: '#60a5fa',
  kpi: '#a78bfa',
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function VisualGraphPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()
  const projectId = params.projectId as string
  const { activeSourceId } = useActiveSource()

  // State
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const selectedNodeRef = useRef<GraphNode | null>(null)
  const insightCacheRef = useRef<Record<string, unknown>>({})

  // Keep ref in sync with state (so Sigma reducers can read current value)
  selectedNodeRef.current = selectedNode

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  /* ---- Fetch existing graph (quick, no heavy loading screen) ---- */
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

  /* ---- Build graph from source ---- */
  const buildGraph = useCallback(async () => {
    if (!activeSourceId) return
    setBuilding(true)
    setBuildProgress([])
    setError(null)

    // Animate progress steps
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
        const errMsg = typeof errBody.error === 'string' ? errBody.error
          : typeof errBody.detail === 'string' ? errBody.detail
          : JSON.stringify(errBody).slice(0, 200)
        throw new Error(errMsg || 'Build failed')
      }

      const data = await res.json()
      setGraphData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build graph')
    } finally {
      setBuilding(false)
      setBuildProgress([])
    }
  }, [activeSourceId, projectId])

  /* ---- Initial load: fetch from DB (fast), only build if nothing saved ---- */
  const hasBuilt = useRef(false)
  useEffect(() => {
    if (!activeSourceId) return
    // Skip if we already have graph data loaded
    if (graphData) return
    async function init() {
      const found = await fetchGraph()
      if (!found && !hasBuilt.current && !building) {
        // No graph in DB and never built in this session: auto-build once
        hasBuilt.current = true
        buildGraph()
      }
    }
    init()
  }, [activeSourceId])

  /* ---- Render Sigma graph ---- */
  useEffect(() => {
    if (!graphData || !containerRef.current) return

    // Cleanup previous instance
    if (sigmaRef.current) {
      sigmaRef.current.kill()
      sigmaRef.current = null
    }

    const graph = new Graph()
    graphRef.current = graph

    // Build category color map from graph data
    const categoryColors: Record<string, string> = {}
    for (const cat of ((graphData as any).categories || [])) {
      categoryColors[cat.id] = cat.color
    }

    // Check if positions were saved from a previous render
    const savedPositions = (graphData as any)._positions as Record<string, {x: number, y: number}> | undefined
    const hasPositions = savedPositions && Object.keys(savedPositions).length > 0

    // Pre-compute table positions (tables spread in a circle, children cluster near parent)
    const tableNodes = graphData.nodes.filter(n => n.type === 'table')
    const tablePositions: Record<string, {x: number, y: number}> = {}
    tableNodes.forEach((t, i) => {
      const angle = (2 * Math.PI * i) / Math.max(tableNodes.length, 1)
      const radius = 5
      tablePositions[t.id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    })

    // Add nodes
    graphData.nodes.forEach((node, i) => {
      let pos: {x: number, y: number}

      if (hasPositions && savedPositions![node.id]) {
        // Use saved positions from DB
        pos = savedPositions![node.id]
      } else if (node.type === 'table') {
        // Table nodes: evenly spaced circle
        pos = tablePositions[node.id] || { x: 0, y: 0 }
      } else if (node.parent && tablePositions[node.parent]) {
        // Child nodes: clustered near their parent table with small offset
        const parentPos = tablePositions[node.parent]
        const childIndex = graphData.nodes.filter(n => n.parent === node.parent).indexOf(node)
        const childAngle = (2 * Math.PI * childIndex) / Math.max(graphData.nodes.filter(n => n.parent === node.parent).length, 1)
        const childRadius = 1.5
        pos = {
          x: parentPos.x + Math.cos(childAngle) * childRadius,
          y: parentPos.y + Math.sin(childAngle) * childRadius,
        }
      } else {
        // Orphan nodes: center area
        const angle = (2 * Math.PI * i) / graphData.nodes.length
        pos = { x: Math.cos(angle) * 2, y: Math.sin(angle) * 2 }
      }

      // Dynamic color: category color > type color > default
      const bizCategory = (node.metadata as any)?.business_category as string
      const nodeColor = (bizCategory && categoryColors[bizCategory])
        ? categoryColors[bizCategory]
        : NODE_COLORS[node.type] || '#71717a'

      graph.addNode(node.id, {
        x: pos.x,
        y: pos.y,
        size: node.type === 'table' ? 22 :
              node.type === 'kpi' ? 16 :
              node.type === 'metric' ? 14 :
              node.type === 'dimension' ? 12 : 10,
        color: nodeColor,
        label: node.type === 'table'
          ? `${node.label}\n${node.value ? node.value.toLocaleString() + ' rows' : ''}`
          : node.type === 'metric' && node.value != null
            ? `${node.label}\n${typeof node.value === 'number' ? node.value.toLocaleString() : node.value}`
            : node.label,
        type: 'circle',
        // Store original data
        nodeType: node.type,
        nodeData: JSON.stringify(node),
      })
    })

    // Add edges
    graphData.edges.forEach((edge, i) => {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdge(edge.source, edge.target, {
          size: edge.weight ? Math.max(1, edge.weight * 3) : 1.5,
          color: edge.color || '#333333',
          label: edge.label || '',
          type: 'line',
        })
      }
    })

    // Run force layout only on first build (no saved positions)
    if (!hasPositions) {
      forceAtlas2.assign(graph, {
        iterations: 500,
        settings: {
          gravity: 1.5,
          scalingRatio: 4,
          barnesHutOptimize: true,
          strongGravityMode: true,
        },
      })

      // Save computed positions to graphData + persist to DB
      const positions: Record<string, {x: number, y: number}> = {}
      graph.forEachNode((nodeId, attrs) => {
        positions[nodeId] = { x: attrs.x, y: attrs.y }
      })
      ;(graphData as any)._positions = positions

      // Persist positions to Supabase so they survive page refreshes
      supabase.from('vil_graphs')
        .update({ graph_data: { ...(graphData as any), _positions: positions } })
        .eq('project_id', projectId)
        .then(() => {})
    }

    // Create Sigma
    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultEdgeType: 'line',
      labelColor: { color: '#ffffff' },
      labelSize: 12,
      labelFont: 'Inter, system-ui, sans-serif',
      labelWeight: '500',
      stagePadding: 60,
      defaultNodeColor: '#71717a',
      defaultEdgeColor: '#333333',
      edgeReducer(edge, data) {
        const res = { ...data }
        if (selectedNodeRef.current) {
          const src = graph.source(edge)
          const tgt = graph.target(edge)
          if (src !== selectedNodeRef.current!.id && tgt !== selectedNodeRef.current!.id) {
            res.color = '#1a1a1a'
            res.size = 0.5
          } else {
            res.color = '#555555'
            res.size = 2
          }
        }
        return res
      },
      nodeReducer(node, data) {
        const res = { ...data }
        if (selectedNodeRef.current) {
          if (node === selectedNodeRef.current.id) {
            const nType = graph.getNodeAttribute(node, 'nodeType')
            res.color = NODE_HIGHLIGHT[nType] || '#ffffff'
            res.size = (data.size || 14) * 1.3
            res.zIndex = 10
          } else {
            // Check if neighbor
            const neighbors = graph.neighbors(selectedNodeRef.current.id)
            if (!neighbors.includes(node)) {
              res.color = '#2a2a2a'
              res.label = ''
            }
          }
        }
        return res
      },
    })

    // Click handler
    sigma.on('clickNode', ({ node: nodeKey }) => {
      const raw = graph.getNodeAttribute(nodeKey, 'nodeData')
      try {
        const nodeObj = JSON.parse(raw) as GraphNode
        setSelectedNode(prev => prev?.id === nodeObj.id ? null : nodeObj)
      } catch {
        setSelectedNode(null)
      }
    })

    // Click on stage to deselect
    sigma.on('clickStage', () => {
      setSelectedNode(null)
    })

    // Hover effects
    sigma.on('enterNode', ({ node: nodeKey }) => {
      const container = containerRef.current
      if (container) container.style.cursor = 'pointer'
    })
    sigma.on('leaveNode', () => {
      const container = containerRef.current
      if (container) container.style.cursor = 'default'
    })

    sigmaRef.current = sigma

    // Animate camera zoom-in
    sigma.getCamera().animatedReset({ duration: 600 })

    return () => {
      sigma.kill()
      sigmaRef.current = null
    }
  }, [graphData]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Re-render sigma when selectedNode changes ---- */
  useEffect(() => {
    if (sigmaRef.current) {
      sigmaRef.current.refresh()
    }
  }, [selectedNode])

  /* ---- Handlers ---- */
  const rebuild = useCallback(() => {
    setGraphData(null)
    setSelectedNode(null)
    buildGraph()
  }, [buildGraph])

  const toggleEdit = useCallback(() => setEditMode(prev => !prev), [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  const highlightNode = useCallback((nodeId?: string) => {
    if (!nodeId || !graphData) return
    const node = graphData.nodes.find(n => n.id === nodeId)
    if (node) {
      setSelectedNode(node)
      // Animate camera to node
      if (sigmaRef.current && graphRef.current?.hasNode(nodeId)) {
        const attrs = graphRef.current.getNodeAttributes(nodeId)
        sigmaRef.current.getCamera().animate(
          { x: attrs.x, y: attrs.y, ratio: 0.4 },
          { duration: 400 }
        )
      }
    }
  }, [graphData])

  /* ---- Loading / building state ---- */
  if (loading || building) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center gap-8 max-w-sm">
          {/* Logo pulse */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center animate-pulse">
              <Zap size={28} className="text-white" />
            </div>
            <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 opacity-30 animate-ping" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold">
              {building ? t('graph.building') : t('graph.loading')}
            </h2>
            <p className="text-sm text-zinc-400">
              {building ? t('graph.buildingDesc') : t('graph.loadingDesc')}
            </p>
          </div>

          {/* Build progress steps */}
          {building && (
            <div className="w-full space-y-3">
              {BUILD_STEPS.map((step, i) => {
                const done = buildProgress.includes(step.key)
                const active = !done && buildProgress.length === i
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500
                      ${done ? 'bg-emerald-500/10 border border-emerald-500/20' : active ? 'bg-zinc-800/60 border border-zinc-700' : 'opacity-30'}`}
                  >
                    {done ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ) : active ? (
                      <Loader2 size={18} className="text-zinc-400 animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-zinc-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${done ? 'text-emerald-400' : active ? 'text-zinc-200' : 'text-zinc-500'}`}>
                      {step.en}
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

  /* ---- No graph state ---- */
  if (!graphData && !loading && !building) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          {error ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold">{t('graph.buildFailed')}</h2>
                <p className="text-sm text-zinc-400">{error}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <Zap size={24} className="text-zinc-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold">{t('graph.noGraph')}</h2>
                <p className="text-sm text-zinc-400">{t('graph.noGraphDesc')}</p>
              </div>
            </>
          )}
          <button
            onClick={buildGraph}
            disabled={!activeSourceId}
            className="px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-xl
              hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('graph.buildNow')}
          </button>
          {!activeSourceId && (
            <p className="text-xs text-zinc-500">{t('graph.selectSourceFirst')}</p>
          )}
        </div>
      </div>
    )
  }

  /* ---- Main graph view ---- */
  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-[#222222] flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-tight">{t('graph.title')}</h1>
          {graphData?.industry && (
            <span className="text-xs text-zinc-400 bg-zinc-800/80 px-2.5 py-0.5 rounded-md border border-zinc-700/50">
              {graphData.industry.type} &middot; {Math.round(graphData.industry.confidence * 100)}% {t('graph.confidence')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DataSourceSelector />
          <GraphControls
            onRefresh={rebuild}
            onEdit={toggleEdit}
            onFullscreen={toggleFullscreen}
            editMode={editMode}
          />
        </div>
      </div>

      {/* Narrative banner */}
      {(graphData as any)?.narrative_de || (graphData as any)?.narrative_en ? (
        <div className="px-6 py-3 bg-[#111] border-b border-[#222] flex-shrink-0">
          <p className="text-sm text-zinc-300 leading-relaxed max-w-4xl">
            {locale === 'de' ? (graphData as any).narrative_de : (graphData as any).narrative_en}
          </p>
        </div>
      ) : null}

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Graph canvas */}
        <div
          className="flex-1 relative bg-[#0a0a0a]"
          ref={containerRef}
          style={{ minHeight: 0 }}
        >
          {/* Legend overlay */}
          <div className="absolute bottom-4 left-4 z-10 bg-[#111]/90 backdrop-blur-sm border border-[#222] rounded-xl px-4 py-3 space-y-2.5 text-xs">
            <p className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px] mb-1">Legend</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#71717a]" />
                <span className="text-zinc-400">{locale === 'de' ? 'Tabellen (Datenbereiche)' : 'Tables (data areas)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                <span className="text-zinc-400">{locale === 'de' ? 'Kennzahlen (Messwerte)' : 'Metrics (measures)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                <span className="text-zinc-400">{locale === 'de' ? 'Dimensionen (Kategorien)' : 'Dimensions (categories)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#7c3aed]" />
                <span className="text-zinc-400">{locale === 'de' ? 'KPIs (berechnete Werte)' : 'KPIs (computed values)'}</span>
              </div>
            </div>
            <div className="border-t border-[#222] pt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5 bg-[#52525b]" />
                <span className="text-zinc-500">{locale === 'de' ? 'Tabellenbeziehung' : 'Table relationship'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5 bg-[#333]" />
                <span className="text-zinc-500">{locale === 'de' ? 'Gehört zu (Hierarchie)' : 'Belongs to (hierarchy)'}</span>
              </div>
            </div>
            <p className="text-zinc-600 text-[10px] pt-1">{locale === 'de' ? 'Klicken Sie auf einen Knoten für Details' : 'Click any node for details'}</p>
          </div>
        </div>

        {/* Right panel (slides in) */}
        <div
          className={`transition-all duration-300 ease-out overflow-hidden flex-shrink-0
            ${selectedNode ? 'w-[380px] border-l border-[#222222]' : 'w-0'}`}
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
