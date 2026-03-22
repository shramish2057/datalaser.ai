export interface ColumnProfile {
  name: string
  dtype: 'numeric' | 'categorical' | 'text' | 'date' | 'id' | 'empty'
  null_rate: number
  unique_rate: number
  total_values: number
  null_count: number
  unique_count: number
  min_value?: number | null
  max_value?: number | null
  mean_value?: number | null
  median_value?: number | null
  std_dev?: number | null
  top_values: { value: string; count: number }[]
  sample_values: string[]
  format_issues: boolean
  mixed_types: boolean
  outlier_count: number
}

export interface QualityWarning {
  column: string
  issue: string
  severity: 'yellow' | 'amber' | 'red'
  detail: string
  affected_rows?: number | null
}

export interface DataProfile {
  run_id: string
  source_id: string
  file_name: string
  file_type: string
  total_rows: number
  total_columns: number
  file_size_bytes: number
  columns: ColumnProfile[]
  quality_score: number
  quality_level: 'good' | 'yellow' | 'amber' | 'red'
  warnings: QualityWarning[]
  detected_encoding: string
  has_header: boolean
}

export interface TransformSuggestion {
  id: string
  priority: number
  operation: string
  column: string | null
  params: Record<string, unknown>
  reason: string
  impact: string
  confidence: number
  before_sample?: string[]
  after_sample?: string[]
}

export interface TransformStep {
  id: string
  operation: string
  column?: string | null
  params: Record<string, unknown>
}

export interface TransformResult {
  run_id: string
  success: boolean
  rows_before: number
  rows_after: number
  preview: Record<string, unknown>[]
  columns: string[]
  staged_path?: string | null
  errors: { step_id: string; error: string; operation: string }[]
  lineage: Record<string, unknown>[]
}

export interface ValidationResult {
  test_name: string
  column: string | null
  status: 'passed' | 'warning' | 'failed'
  message: string
  failing_rows: number
  examples: unknown[]
}

export interface ValidationReport {
  run_id: string
  overall_status: 'passed' | 'warning' | 'failed'
  score: number
  tests: ValidationResult[]
  summary: string
}

export interface JoinCandidate {
  left_column: string
  right_column: string
  confidence: number
  overlap_pct: number
  name_similarity: number
}

export type PipelineStep = 'profile' | 'suggest' | 'transform' | 'validate' | 'ready'
