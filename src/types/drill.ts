export interface DrillFilter {
  column: string
  value: string | number
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in'
  label: string
}

export interface DrillState {
  filters: DrillFilter[]
  sourceData: Record<string, unknown>[] | null
}
