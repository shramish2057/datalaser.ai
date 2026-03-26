/**
 * Multi-cluster layout for the Visual Graph.
 * Each table is its own cluster center with metrics/dimensions orbiting it.
 * Clusters are spaced apart and connected by FK edges.
 * KPIs attached to their source table's cluster.
 */

interface GraphNode {
  id: string
  type: string
  label: string
  value?: number | string | null
  trend?: number | null
  parent?: string
  metadata?: Record<string, unknown>
}

interface GraphEdge {
  source: string
  target: string
  type?: string
  weight?: number
}

export interface RadialPosition {
  x: number
  y: number
}

export interface RadialLayoutResult {
  positions: Record<string, RadialPosition>
  sizes: Record<string, number>
}

/**
 * Auto-select the best focus table: most edges (highest connectivity).
 */
export function autoSelectCenterTable(nodes: GraphNode[], edges: GraphEdge[]): string | null {
  const tables = nodes.filter(n => n.type === 'table')
  if (tables.length === 0) return null
  if (tables.length === 1) return tables[0].id

  const scores = tables.map(t => {
    const edgeCount = edges.filter(e => e.source === t.id || e.target === t.id).length
    const childCount = nodes.filter(n => n.parent === t.id).length
    return { id: t.id, score: edgeCount * 2 + childCount }
  })
  scores.sort((a, b) => b.score - a.score)
  return scores[0].id
}

/**
 * Compute multi-cluster layout.
 * Each table gets its own cluster with children orbiting around it.
 * Table clusters are spread in a grid/circle layout with generous spacing.
 */
export function computeRadialLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  centerTableId: string
): RadialLayoutResult {
  const positions: Record<string, RadialPosition> = {}
  const sizes: Record<string, number> = {}

  const tables = nodes.filter(n => n.type === 'table')
  if (tables.length === 0) return { positions, sizes }

  // --- Step 1: Determine cluster positions (where each table sits) ---
  // Place the focus table in the center, others around it
  // Use a force-free deterministic layout: focus center, rest in circle

  const clusterSpacing = 350 // distance between cluster centers
  const focusTable = tables.find(t => t.id === centerTableId) || tables[0]
  const otherTables = tables.filter(t => t.id !== focusTable.id)

  // Focus table at origin
  const clusterCenters: Record<string, { x: number; y: number }> = {}
  clusterCenters[focusTable.id] = { x: 0, y: 0 }

  // Other tables in a circle around focus
  const circleRadius = otherTables.length <= 2
    ? clusterSpacing
    : clusterSpacing * Math.max(1, otherTables.length / 3)

  otherTables.forEach((table, i) => {
    const angle = (2 * Math.PI * i) / otherTables.length - Math.PI / 2
    clusterCenters[table.id] = {
      x: Math.cos(angle) * circleRadius,
      y: Math.sin(angle) * circleRadius,
    }
  })

  // --- Step 2: For each table, position it and its children ---

  for (const table of tables) {
    const center = clusterCenters[table.id]
    const isFocus = table.id === focusTable.id

    // Table node position and size
    positions[table.id] = center
    sizes[table.id] = isFocus ? 26 : 18

    // Get children (metrics + dimensions + dates)
    const children = nodes.filter(n =>
      n.parent === table.id && ['metric', 'dimension', 'date'].includes(n.type)
    )

    // Sort children: metrics first (by importance desc), then dimensions, then dates
    children.sort((a, b) => {
      const typeOrder: Record<string, number> = { metric: 0, dimension: 1, date: 2 }
      const typeA = typeOrder[a.type] ?? 3
      const typeB = typeOrder[b.type] ?? 3
      if (typeA !== typeB) return typeA - typeB
      const impA = (a.metadata?.importance as number) ?? 0.5
      const impB = (b.metadata?.importance as number) ?? 0.5
      return impB - impA
    })

    // Place children in a circle around the table
    const childRadius = isFocus ? 120 : 80
    children.forEach((child, i) => {
      const angle = (2 * Math.PI * i) / Math.max(children.length, 1) - Math.PI / 2
      positions[child.id] = {
        x: center.x + Math.cos(angle) * childRadius,
        y: center.y + Math.sin(angle) * childRadius,
      }

      const importance = (child.metadata?.importance as number) ?? 0.5
      if (child.type === 'dimension') {
        sizes[child.id] = 8 + importance * 5
      } else {
        sizes[child.id] = isFocus ? 12 + importance * 8 : 8 + importance * 5
      }
    })

    // KPIs that depend on this table's metrics
    const childIds = new Set(children.map(c => c.id))
    const kpis = nodes.filter(n => {
      if (n.type !== 'kpi') return false
      return edges.some(e =>
        e.type === 'kpi_dependency' && e.source === n.id && childIds.has(e.target)
      )
    })

    // Place KPIs in an outer ring around this table's cluster
    const kpiRadius = childRadius + 70
    kpis.forEach((kpi, i) => {
      // Position near the metric this KPI depends on
      const depEdge = edges.find(e => e.type === 'kpi_dependency' && e.source === kpi.id)
      const depPos = depEdge ? positions[depEdge.target] : null

      let angle: number
      if (depPos) {
        angle = Math.atan2(depPos.y - center.y, depPos.x - center.x)
        // Slight offset if multiple KPIs share same parent metric
        const siblings = kpis.filter(k => {
          const d = edges.find(e => e.type === 'kpi_dependency' && e.source === k.id)
          return d?.target === depEdge?.target
        })
        const sibIdx = siblings.indexOf(kpi)
        angle += (sibIdx - (siblings.length - 1) / 2) * 0.25
      } else {
        angle = (2 * Math.PI * i) / Math.max(kpis.length, 1)
      }

      positions[kpi.id] = {
        x: center.x + Math.cos(angle) * kpiRadius,
        y: center.y + Math.sin(angle) * kpiRadius,
      }
      sizes[kpi.id] = isFocus ? 16 : 12
    })
  }

  // --- Step 3: Position orphan KPIs (not connected to any table's metrics) ---
  const positionedIds = new Set(Object.keys(positions))
  const orphanKpis = nodes.filter(n => n.type === 'kpi' && !positionedIds.has(n.id))

  if (orphanKpis.length > 0) {
    // Place them near the focus table cluster
    const focusCenter = clusterCenters[focusTable.id]
    const orphanRadius = 200
    orphanKpis.forEach((kpi, i) => {
      const angle = Math.PI + (2 * Math.PI * i) / Math.max(orphanKpis.length, 1) * 0.5
      positions[kpi.id] = {
        x: focusCenter.x + Math.cos(angle) * orphanRadius,
        y: focusCenter.y + Math.sin(angle) * orphanRadius,
      }
      sizes[kpi.id] = 14
    })
  }

  return { positions, sizes }
}
