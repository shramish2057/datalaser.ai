export interface StudioCell {
  id: string
  type: 'python' | 'markdown'
  code: string
  output: CellOutput | null
  status: 'idle' | 'running' | 'done' | 'error'
  created_at: string
}

export interface CellOutput {
  success: boolean
  result: unknown
  stdout: string
  error: string | null
  chart_data: ChartData | null
  interpretation: string | null
  key_findings: string[]
  recommended_actions: string[]
  stats_table: StatsRow[] | null
  execution_time_ms: number
}

export interface ChartData {
  chart_type: 'bar' | 'line' | 'scatter' | 'pie' | 'area'
  data: Record<string, unknown>[]
  x_key: string
  y_keys: string[]
  title?: string
  auto_generated?: boolean
}

export interface StatsRow {
  label: string
  value: string | number
  significant?: boolean
}

export interface ProactiveSuggestion {
  id: string
  title: string
  description: string
  operation: string
  code: string
  columns_used: string[]
  priority: number
}

export interface QueryLibraryItem {
  id: string
  title: string
  description: string
  code: string
  operation: string
  tags: string[]
  use_count: number
  created_at: string
}

export interface StudioNotebook {
  id: string
  project_id: string
  org_id: string
  title: string
  cells: StudioCell[]
  published_insights: string[]
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export interface StudioSource {
  id: string
  name: string
  source_type: string
  file_path: string | null
  table_name: string | null
  pipeline_status: string
  isActive: boolean
}

export interface SchemaColumn {
  name: string
  dtype: string
  null_rate: number
  sample_values: string[]
}
