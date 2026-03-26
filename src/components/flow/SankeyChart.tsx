'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  sankeyJustify,
  type SankeyNode,
  type SankeyLink,
} from 'd3-sankey'
import type { SankeyNodeDatum, SankeyLinkDatum } from '@/lib/flow/transformGraphToSankey'

interface SankeyChartProps {
  nodes: SankeyNodeDatum[]
  links: SankeyLinkDatum[]
  onNodeClick: (nodeId: string) => void
  onLinkClick: (sourceId: string, targetId: string) => void
  selectedNodeId?: string | null
}

type LN = SankeyNode<SankeyNodeDatum, SankeyLinkDatum>

export function SankeyChart({ nodes, links, onNodeClick, onLinkClick, selectedNodeId }: SankeyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 800, height: 500 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Zoom
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      setScale(prev => Math.max(0.5, Math.min(2, prev * (e.deltaY > 0 ? 0.95 : 1.05))))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Layout
  const { layoutNodes, layoutLinks } = useMemo(() => {
    if (nodes.length === 0) return { layoutNodes: [] as LN[], layoutLinks: [] as SankeyLink<SankeyNodeDatum, SankeyLinkDatum>[] }

    const chartW = Math.min(dims.width * 0.5, 480)
    const chartH = Math.min(dims.height * 0.5, 320)
    const offsetX = (dims.width - chartW) / 2
    const offsetY = (dims.height - chartH) / 2 - 20

    const gen = d3Sankey<SankeyNodeDatum, SankeyLinkDatum>()
      .nodeId(d => d.id)
      .nodeWidth(16)
      .nodePadding(24)
      .nodeAlign(sankeyJustify)
      .extent([[offsetX, offsetY], [offsetX + chartW, offsetY + chartH]])

    try {
      const result = gen({
        nodes: nodes.map(n => ({ ...n })),
        links: links.map(l => ({ ...l })),
      })
      return { layoutNodes: result.nodes, layoutLinks: result.links }
    } catch {
      return { layoutNodes: [] as LN[], layoutLinks: [] as SankeyLink<SankeyNodeDatum, SankeyLinkDatum>[] }
    }
  }, [nodes, links, dims])

  const linkPathGen = sankeyLinkHorizontal()
  const activeId = selectedNodeId || hoveredNode

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {/* SVG layer — visuals only, no click handlers */}
      <svg
        width={dims.width}
        height={dims.height}
        className="select-none absolute inset-0"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        <defs>
          {layoutLinks.map((link, i) => {
            const src = link.source as LN
            const tgt = link.target as LN
            return (
              <linearGradient key={`lg-${i}`} id={`link-grad-${i}`} x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor={src.color || '#9ca3af'} stopOpacity={0.5} />
                <stop offset="100%" stopColor={tgt.color || '#9ca3af'} stopOpacity={0.25} />
              </linearGradient>
            )
          })}
        </defs>

        {/* Links */}
        <g>
          {layoutLinks.map((link, i) => {
            const srcId = typeof link.source === 'object' ? (link.source as LN).id : String(link.source)
            const tgtId = typeof link.target === 'object' ? (link.target as LN).id : String(link.target)
            const isActive = !activeId || srcId === activeId || tgtId === activeId
            return (
              <path
                key={i}
                d={linkPathGen(link as any) || ''}
                fill={`url(#link-grad-${i})`}
                fillOpacity={isActive ? 0.55 : 0.06}
                stroke="none"
                style={{ transition: 'fill-opacity 0.2s' }}
              />
            )
          })}
        </g>

        {/* Node bars */}
        <g>
          {layoutNodes.map(node => {
            const x0 = node.x0 || 0
            const y0 = node.y0 || 0
            const x1 = node.x1 || 0
            const y1 = node.y1 || 0
            const h = Math.max(y1 - y0, 8)
            const isActive = !activeId || node.id === activeId ||
              links.some(l => (l.source === activeId && l.target === node.id) || (l.target === activeId && l.source === node.id))
            const isSelected = node.id === selectedNodeId

            return (
              <g key={node.id} opacity={isActive ? 1 : 0.12} style={{ transition: 'opacity 0.2s' }}>
                {isSelected && (
                  <rect x={x0 - 4} y={y0 - 4} width={(x1 - x0) + 8} height={h + 8}
                    rx={10} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="4 2" />
                )}
                <rect x={x0} y={y0} width={x1 - x0} height={h} rx={5}
                  fill={node.color} opacity={0.85} />
              </g>
            )
          })}
        </g>
      </svg>

      {/* HTML overlay — click targets + labels (scale with SVG) */}
      <div
        className="absolute inset-0"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center', pointerEvents: 'none' }}
      >
        {/* Node click targets + labels */}
        {layoutNodes.map(node => {
          const x0 = node.x0 || 0
          const y0 = node.y0 || 0
          const x1 = node.x1 || 0
          const y1 = node.y1 || 0
          const h = Math.max(y1 - y0, 8)
          const midY = y0 + h / 2
          const countLabel = `${node.rowCount.toLocaleString()} ${node.label}`

          return (
            <button
              key={node.id}
              className="absolute pointer-events-auto cursor-pointer group"
              style={{ left: x0 - 4, top: y0 - 4, width: (x1 - x0) + 180, height: h + 8 }}
              onClick={() => onNodeClick(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Labels positioned relative to the button */}
              <div className="absolute" style={{ left: (x1 - x0) + 14, top: '50%', transform: 'translateY(-50%)' }}>
                <p className="text-[12px] font-extrabold text-gray-900 leading-tight whitespace-nowrap">{node.label}</p>
                <p className="text-[10px] font-medium text-gray-500 leading-tight whitespace-nowrap">{countLabel}</p>
                {node.keyMetric && (
                  <p className="text-[10px] font-bold leading-tight whitespace-nowrap" style={{ color: node.color }}>
                    {node.keyMetric.label}: {node.keyMetric.value}
                  </p>
                )}
              </div>
            </button>
          )
        })}

        {/* Link click targets — thin invisible strips along the midpoint of each link */}
        {layoutLinks.map((link, i) => {
          const src = link.source as LN
          const tgt = link.target as LN
          const srcId = src.id
          const tgtId = tgt.id
          const midX = ((src.x1 || 0) + (tgt.x0 || 0)) / 2
          const midY = ((src.y0 || 0) + (src.y1 || 0) + (tgt.y0 || 0) + (tgt.y1 || 0)) / 4
          const linkWidth = Math.max(link.width || 4, 20)

          return (
            <button
              key={`link-${i}`}
              className="absolute pointer-events-auto cursor-pointer"
              style={{ left: midX - 30, top: midY - linkWidth / 2, width: 60, height: linkWidth }}
              onClick={() => onLinkClick(srcId, tgtId)}
            />
          )
        })}
      </div>
    </div>
  )
}
