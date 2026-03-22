import type { SchemaColumn, StudioCell } from '@/types/studio'

export function buildSchemaContext(
  sourceName: string,
  columns: SchemaColumn[],
  qualityScore: number,
  previousCells: StudioCell[]
): string {
  const colLines = columns.map(c => {
    const nullInfo = c.null_rate > 0.05
      ? ` (${Math.round(c.null_rate * 100)}% null)`
      : ''
    const samples = c.sample_values.slice(0, 3).join(', ')
    return `  ${c.name}: ${c.dtype}${nullInfo} — samples: [${samples}]`
  }).join('\n')

  const prevAnalyses = previousCells
    .filter(c => c.status === 'done')
    .map(c => `  - ${c.code.split('\n')[0].slice(0, 60)}`)
    .slice(-5)
    .join('\n')

  return `Active dataset: ${sourceName}
Quality score: ${qualityScore}/100
Columns:
${colLines}
${prevAnalyses ? `\nPrevious analyses run:\n${prevAnalyses}` : ''}

IMPORTANT: Use exact column names above. Store result in variable 'result'. Dataframe is 'df'.`
}
