/**
 * Transforms VIL graph_data into d3-sankey format.
 * General algorithm — works for ANY dataset, no hardcoded roles.
 */

export interface SankeyNodeDatum {
  id: string
  label: string
  rowCount: number
  color: string
  column: number
  metadata: Record<string, unknown>
  keyMetric?: { label: string; value: string | number }
}

export interface SankeyLinkDatum {
  source: string
  target: string
  value: number
  label?: string
  color?: string
}

export interface KPIOverlay {
  id: string
  label: string
  value: string | number
  unit?: string
  formula?: string
  health: 'good' | 'warning' | 'critical'
  parentTableId: string | null
  trend?: number | string | null
  metadata?: Record<string, unknown>
}

export interface SankeyTransformResult {
  sankeyNodes: SankeyNodeDatum[]
  sankeyLinks: SankeyLinkDatum[]
  kpiNodes: KPIOverlay[]
  hasRelationships: boolean
}

// Distinct palette for tables (not tied to any category)
const TABLE_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
]

/**
 * Infer column positions from edge directions.
 * Pure sources (no inbound) → 0 (left)
 * Pure sinks (no outbound) → max column (right)
 * Mixed → middle columns assigned by topological depth
 */
function inferColumns(
  tableIds: string[],
  edges: { source: string; target: string }[]
): Record<string, number> {
  const inDegree: Record<string, number> = {}
  const outDegree: Record<string, number> = {}
  for (const id of tableIds) { inDegree[id] = 0; outDegree[id] = 0 }

  for (const e of edges) {
    if (inDegree[e.target] !== undefined) inDegree[e.target]++
    if (outDegree[e.source] !== undefined) outDegree[e.source]++
  }

  // BFS from sources to assign depth
  const depth: Record<string, number> = {}
  const adj: Record<string, string[]> = {}
  for (const id of tableIds) adj[id] = []
  for (const e of edges) {
    if (adj[e.source]) adj[e.source].push(e.target)
  }

  // Start from pure sources (in-degree 0)
  const sources = tableIds.filter(id => inDegree[id] === 0)
  const queue = sources.length > 0 ? [...sources] : [tableIds[0]] // fallback: pick first
  for (const id of queue) depth[id] = 0

  let maxDepth = 0
  const visited = new Set(queue)
  let qi = 0
  while (qi < queue.length) {
    const curr = queue[qi++]
    for (const next of adj[curr] || []) {
      if (!visited.has(next)) {
        visited.add(next)
        depth[next] = (depth[curr] || 0) + 1
        maxDepth = Math.max(maxDepth, depth[next])
        queue.push(next)
      }
    }
  }

  // Assign unvisited nodes (disconnected) to middle
  for (const id of tableIds) {
    if (depth[id] === undefined) {
      depth[id] = Math.max(1, Math.floor(maxDepth / 2))
    }
  }

  // Normalize to 0..2 (left/middle/right) for cleaner layout
  if (maxDepth === 0) {
    // All on same level — spread evenly
    tableIds.forEach((id, i) => { depth[id] = i % 3 })
  } else if (maxDepth === 1) {
    // Two levels — keep as 0 and 1
  } else {
    // Normalize: 0 stays 0, maxDepth becomes 2, rest becomes 1
    for (const id of tableIds) {
      if (depth[id] === 0) depth[id] = 0
      else if (depth[id] === maxDepth) depth[id] = 2
      else depth[id] = 1
    }
  }

  return depth
}

/**
 * Determine KPI health from value + unit.
 * Rates/percentages: >50% good, >20% warning, else critical
 * Absolute values: always "good" (we can't judge without benchmarks)
 */
function determineHealth(value: number | string | null, unit?: string): 'good' | 'warning' | 'critical' {
  if (value == null) return 'warning'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return 'warning'
  if (unit === '%' || unit === 'percent') {
    if (num >= 50) return 'good'
    if (num >= 20) return 'warning'
    return 'critical'
  }
  return 'good' // can't judge absolute values without benchmarks
}

/**
 * Assign color to a table using multiple strategies:
 * 1. Dominant business_category of child metrics (if AI classified them)
 * 2. Table role heuristic (entity=grey, transaction=blue, quality=red, production=blue)
 * 3. Fallback palette by index
 */
const ROLE_COLORS: Record<string, string> = {
  entity_table: '#6366f1',    // indigo — master data
  master_data: '#6366f1',
  transaction_table: '#3b82f6', // blue — core transactions
  revenue_table: '#10b981',   // emerald — money
  production_table: '#06b6d4', // cyan — manufacturing
  quality_table: '#ef4444',   // red — defects/complaints
  data_table: '#8b5cf6',      // violet — generic
}

function getTableColor(
  tableId: string,
  nodes: any[],
  categoryColorMap: Record<string, string>,
  tableIndex: number,
  tableRole?: string
): string {
  // Strategy 1: table role (always populated by VIL, most reliable)
  if (tableRole && ROLE_COLORS[tableRole]) return ROLE_COLORS[tableRole]

  // Strategy 2: dominant business_category from child metrics (skip "entity" — it's grey/generic)
  const children = nodes.filter((n: any) =>
    (n.type === 'metric' || n.type === 'dimension') && n.parent === tableId
  )
  const catCounts: Record<string, number> = {}
  for (const child of children) {
    const cat = child.metadata?.business_category
    if (cat && cat !== '' && cat !== 'entity' && categoryColorMap[cat]) {
      catCounts[cat] = (catCounts[cat] || 0) + 1
    }
  }
  const dominant = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]
  if (dominant) return categoryColorMap[dominant[0]]

  // Strategy 3: distinct palette color per table
  return TABLE_PALETTE[tableIndex % TABLE_PALETTE.length]
}

/**
 * Find the most important metric for a table (for display on the node).
 * Returns label + formatted value with correct unit.
 */
function getKeyMetric(tableId: string, nodes: any[]): { label: string; value: string } | undefined {
  const metrics = nodes.filter((n: any) =>
    n.type === 'metric' && n.parent === tableId && n.value != null
  )
  if (metrics.length === 0) return undefined

  // Sort by importance (from metadata), take highest
  metrics.sort((a: any, b: any) => (b.metadata?.importance || 0) - (a.metadata?.importance || 0))
  const best = metrics[0]
  const scale = best.metadata?.scale || 'generic'
  const role = best.metadata?.business_role || ''
  const num = typeof best.value === 'number' ? best.value : parseFloat(String(best.value))
  const name = best.label || best.label_en || best.id.split('.').pop() || ''

  let formatted: string
  if (isNaN(num)) {
    formatted = String(best.value)
  } else if (scale === 'currency' || role === 'revenue' || role === 'cost' || role === 'price') {
    formatted = num >= 1000000 ? `€${(num / 1000000).toFixed(1)}M`
      : num >= 1000 ? `€${(num / 1000).toFixed(1)}K`
      : `€${num.toLocaleString()}`
  } else if (scale === 'percentage' || role === 'rate') {
    formatted = `${num.toFixed(1)}%`
  } else {
    formatted = num >= 1000000 ? `${(num / 1000000).toFixed(1)}M`
      : num >= 1000 ? `${(num / 1000).toFixed(1)}K`
      : num.toLocaleString()
  }

  return { label: name, value: formatted }
}

export function transformGraphToSankey(graphData: {
  nodes: any[]
  edges: any[]
  categories?: { id: string; color: string }[]
}): SankeyTransformResult {
  const { nodes, edges, categories } = graphData

  // Build category color map from AI-generated categories
  const catColors: Record<string, string> = {}
  for (const cat of categories || []) {
    catColors[cat.id] = cat.color
  }

  // 1. Table nodes
  const tableNodes = nodes.filter((n: any) => n.type === 'table')
  const tableIds = tableNodes.map((n: any) => n.id)
  const tableIdSet = new Set(tableIds)

  // 2. Relationship edges (table↔table only)
  const relEdges = edges.filter(
    (e: any) => e.type === 'relationship' && tableIdSet.has(e.source) && tableIdSet.has(e.target)
  )

  // Deduplicate bidirectional
  const seenPairs = new Set<string>()
  const dedupedEdges: any[] = []
  for (const e of relEdges) {
    const key = [e.source, e.target].sort().join('|')
    if (!seenPairs.has(key)) {
      seenPairs.add(key)
      dedupedEdges.push(e)
    }
  }

  // 3. Infer column positions (general algorithm)
  const columns = inferColumns(tableIds, dedupedEdges)

  // 4. Build row count map
  const rowCountMap: Record<string, number> = {}
  for (const n of tableNodes) {
    rowCountMap[n.id] = typeof n.value === 'number' ? n.value : 1
  }

  // 5. Build Sankey nodes
  const sankeyNodes: SankeyNodeDatum[] = tableNodes.map((n: any, i: number) => ({
    id: n.id,
    label: n.label || n.id.replace('table:', ''),
    rowCount: rowCountMap[n.id] || 1,
    color: getTableColor(n.id, nodes, catColors, i, n.metadata?.role as string),
    column: columns[n.id] || 0,
    metadata: n.metadata || {},
    keyMetric: getKeyMetric(n.id, nodes),
  }))

  // 6. Build Sankey links with clamped values
  // Use log scale so 800-row table doesn't dwarf 20-row table
  const sankeyLinks: SankeyLinkDatum[] = dedupedEdges.map((e: any) => {
    const srcRows = rowCountMap[e.source] || 1
    const tgtRows = rowCountMap[e.target] || 1
    const rawValue = Math.min(srcRows, tgtRows)
    const value = Math.max(5, Math.log10(rawValue + 1) * 20) // log scale, min 5

    const srcNode = sankeyNodes.find(n => n.id === e.source)
    return {
      source: e.source,
      target: e.target,
      value,
      label: e.label || e.label_en || '',
      color: srcNode?.color || '#9ca3af',
    }
  })

  // 7. KPI overlays
  const kpiNodes: KPIOverlay[] = nodes
    .filter((n: any) => n.type === 'kpi')
    .map((n: any) => {
      // Find parent table via dependency chain
      let parentTableId: string | null = null

      // Try kpi_dependency edges first
      const depEdge = edges.find((e: any) => e.type === 'kpi_dependency' && e.source === n.id)
      if (depEdge) {
        const metricNode = nodes.find((m: any) => m.id === depEdge.target)
        parentTableId = metricNode?.parent || null
      }

      // Fallback: any connected edge
      if (!parentTableId) {
        const anyEdge = edges.find((e: any) => e.source === n.id || e.target === n.id)
        if (anyEdge) {
          const otherId = anyEdge.source === n.id ? anyEdge.target : anyEdge.source
          const other = nodes.find((m: any) => m.id === otherId)
          parentTableId = other?.type === 'table' ? other.id : other?.parent || null
        }
      }

      // Last fallback: assign to largest transaction table
      if (!parentTableId && sankeyNodes.length > 0) {
        const middleTables = sankeyNodes.filter(sn => sn.column === 1)
        const target = middleTables.length > 0
          ? middleTables.sort((a, b) => b.rowCount - a.rowCount)[0]
          : sankeyNodes.sort((a, b) => b.rowCount - a.rowCount)[0]
        parentTableId = target.id
      }

      return {
        id: n.id,
        label: n.label || n.label_en || n.id,
        value: n.value,
        unit: n.metadata?.unit || '',
        formula: n.metadata?.formula || '',
        health: determineHealth(n.value, n.metadata?.unit as string),
        parentTableId,
        trend: n.trend,
        metadata: n.metadata || {},
      }
    })

  return {
    sankeyNodes,
    sankeyLinks,
    kpiNodes,
    hasRelationships: dedupedEdges.length > 0,
  }
}
