/**
 * Generate a table-specific narrative from VIL graph data.
 * Different from the static CEO summary — changes when user switches center table.
 */

interface GraphNode {
  id: string
  type: string
  label: string
  label_en?: string
  value?: number | string | null
  trend?: number | null
  parent?: string
  metadata?: Record<string, unknown>
}

function formatValue(value: number | string | null | undefined, scale?: string, role?: string): string {
  if (value == null) return '—'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return String(value)

  const isCurrency = scale === 'currency' || role === 'revenue' || role === 'cost' || role === 'price'
  const isRate = scale === 'percentage' || role === 'rate'

  if (isCurrency) {
    return num >= 1_000_000 ? `€${(num / 1_000_000).toFixed(1)}M`
      : num >= 1_000 ? `€${Math.round(num / 1_000)}K`
      : `€${num.toLocaleString()}`
  }
  if (isRate) return `${num.toFixed(1)}%`
  return num >= 1_000_000 ? `${(num / 1_000_000).toFixed(1)}M`
    : num >= 1_000 ? `${Math.round(num / 1_000).toLocaleString()}`
    : num % 1 !== 0 ? num.toFixed(1)
    : num.toLocaleString()
}

export function generateTableNarrative(
  nodes: GraphNode[],
  edges: { source: string; target: string; type?: string }[],
  centerTableId: string,
  locale: string
): string {
  const table = nodes.find(n => n.id === centerTableId)
  if (!table) return ''

  const children = nodes.filter(n => n.parent === centerTableId)
  const metrics = children.filter(n => n.type === 'metric')
  const dimensions = children.filter(n => n.type === 'dimension')

  const segments: string[] = []
  const de = locale === 'de'

  // 1. Table summary
  const rowCount = typeof table.value === 'number' ? table.value.toLocaleString() : String(table.value || 0)
  segments.push(`${table.label}: ${rowCount} ${de ? 'Datensätze' : 'records'}`)

  // 2. Top metrics with values
  const topMetrics = metrics
    .filter(m => m.value != null)
    .sort((a, b) => ((b.metadata?.importance as number) ?? 0) - ((a.metadata?.importance as number) ?? 0))
    .slice(0, 3)

  if (topMetrics.length > 0) {
    const metricStrs = topMetrics.map(m => {
      const val = formatValue(m.value as number, m.metadata?.scale as string, m.metadata?.business_role as string)
      const trend = typeof m.trend === 'number' && Math.abs(m.trend) > 3
        ? ` ${m.trend > 0 ? '↑' : '↓'}${Math.abs(m.trend).toFixed(1)}%`
        : ''
      return `${m.label} ${val}${trend}`
    })
    segments.push(metricStrs.join(', '))
  }

  // 3. Top dimension breakdown
  const topDim = dimensions.find(d => d.metadata?.top_values && (d.metadata.top_values as any[]).length > 0)
  if (topDim) {
    const topVals = (topDim.metadata!.top_values as { value: string; count: number }[]).slice(0, 3)
    const total = topVals.reduce((s, v) => s + v.count, 0)
    const valStrs = topVals.map(v => {
      const pct = total > 0 ? Math.round(v.count / total * 100) : 0
      return `${v.value} ${pct}%`
    })
    segments.push(`${topDim.label}: ${valStrs.join(', ')}`)
  }

  // 4. Connected tables
  const connectedTables = nodes.filter(n => {
    if (n.type !== 'table' || n.id === centerTableId) return false
    return edges.some(e =>
      e.type === 'relationship' &&
      ((e.source === centerTableId && e.target === n.id) ||
       (e.target === centerTableId && e.source === n.id))
    )
  })
  if (connectedTables.length > 0) {
    const names = connectedTables.map(t => t.label).join(', ')
    segments.push(`${de ? 'Verknüpft mit' : 'Connected to'} ${names}`)
  }

  return segments.join('. ') + '.'
}
