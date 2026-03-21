type ColumnMeta = {
  name: string
  dtype: string
  nullRate: number
  uniqueRate: number
  mixedTypes: boolean
  formatIssues: boolean
  totalValues: number
}

export type ColumnWarning = {
  column: string
  issue: 'missing_values' | 'mixed_types' | 'format_inconsistency' | 'high_cardinality' | 'mostly_empty'
  severity: 'yellow' | 'amber' | 'red'
  detail: string
  affectedRows?: number
}

export type DataQualityReport = {
  level: 'good' | 'yellow' | 'amber' | 'red'
  score: number
  warnings: ColumnWarning[]
  summary: string
  canProceed: boolean
  upgradePrompt?: string
}

export function assessDataQuality(
  columns: ColumnMeta[],
  totalRows: number
): DataQualityReport {
  const warnings: ColumnWarning[] = []

  for (const col of columns) {
    // Missing values
    if (col.nullRate > 0.6) {
      warnings.push({
        column: col.name,
        issue: 'missing_values',
        severity: 'red',
        detail: `${Math.round(col.nullRate * 100)}% of values are missing`,
        affectedRows: Math.round(col.nullRate * totalRows),
      })
    } else if (col.nullRate > 0.2) {
      warnings.push({
        column: col.name,
        issue: 'missing_values',
        severity: 'amber',
        detail: `${Math.round(col.nullRate * 100)}% of values are missing`,
        affectedRows: Math.round(col.nullRate * totalRows),
      })
    } else if (col.nullRate > 0.05) {
      warnings.push({
        column: col.name,
        issue: 'missing_values',
        severity: 'yellow',
        detail: `${Math.round(col.nullRate * 100)}% of values are missing`,
        affectedRows: Math.round(col.nullRate * totalRows),
      })
    }

    // Mixed types
    if (col.mixedTypes) {
      warnings.push({
        column: col.name,
        issue: 'mixed_types',
        severity: 'amber',
        detail: 'Column contains both numeric and text values — type is ambiguous',
      })
    }

    // Format inconsistency
    if (col.formatIssues) {
      warnings.push({
        column: col.name,
        issue: 'format_inconsistency',
        severity: 'amber',
        detail: 'Multiple date formats detected in this column',
      })
    }

    // Mostly empty
    if (col.nullRate > 0.8) {
      warnings.push({
        column: col.name,
        issue: 'mostly_empty',
        severity: 'red',
        detail: `Column is ${Math.round(col.nullRate * 100)}% empty — may not be useful for analysis`,
      })
    }
  }

  // Deduplicate warnings per column+issue (keep highest severity)
  const seen = new Map<string, ColumnWarning>()
  for (const w of warnings) {
    const key = `${w.column}-${w.issue}`
    const existing = seen.get(key)
    if (!existing || severityRank(w.severity) > severityRank(existing.severity)) {
      seen.set(key, w)
    }
  }
  const deduped = Array.from(seen.values())

  const redCount = deduped.filter(w => w.severity === 'red').length
  const amberCount = deduped.filter(w => w.severity === 'amber').length

  let level: DataQualityReport['level'] = 'good'
  if (redCount >= 2 || (redCount >= 1 && amberCount >= 2)) level = 'red'
  else if (redCount >= 1 || amberCount >= 3) level = 'amber'
  else if (amberCount >= 1 || deduped.length >= 3) level = 'yellow'

  const penalty = deduped.reduce((sum, w) => {
    return sum + (w.severity === 'red' ? 20 : w.severity === 'amber' ? 10 : 5)
  }, 0)
  const score = Math.max(0, 100 - penalty)

  const summaries: Record<DataQualityReport['level'], string> = {
    good: 'Your data looks clean. Analysis should be accurate.',
    yellow: 'Minor data quality issues found. Analysis will be reliable with small caveats.',
    amber: 'Some data quality issues detected. Results may have inaccuracies in affected columns.',
    red: 'Significant data quality issues found. Analysis accuracy may be limited. Consider cleaning your data first.',
  }

  const upgradePrompts: Partial<Record<DataQualityReport['level'], string>> = {
    amber: 'Enterprise plan includes automated data cleaning to fix these issues before analysis.',
    red: 'Upgrade to Enterprise to automatically clean, standardise and validate your data for 95%+ accuracy.',
  }

  return {
    level,
    score,
    warnings: deduped,
    summary: summaries[level],
    canProceed: level !== 'red' || deduped.filter(w => w.severity === 'red').length < 4,
    upgradePrompt: upgradePrompts[level],
  }
}

function severityRank(s: 'yellow' | 'amber' | 'red'): number {
  return s === 'red' ? 3 : s === 'amber' ? 2 : 1
}
