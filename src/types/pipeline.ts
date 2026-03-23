export interface ColumnProfile {
  name: string
  dtype: 'numeric' | 'categorical' | 'text' | 'date' | 'id' | 'empty'
  semantic_role?: 'measure' | 'dimension' | 'binary' | 'date' | 'id' | 'text' | 'unknown'
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
  category: 'issue' | 'characteristic' | 'info'
}

export interface ValidationReport {
  run_id: string
  overall_status: 'passed' | 'warning' | 'failed'
  score: number
  tests: ValidationResult[]
  summary: string
  issues_count: number
  characteristics_count: number
  fixable_resolved: boolean
}

export interface JoinCandidate {
  left_column: string
  right_column: string
  confidence: number
  overlap_pct: number
  name_similarity: number
}

export type PipelineStep = 'profile' | 'suggest' | 'transform' | 'validate' | 'ready'

// -- Auto-Analysis Types --

export interface AutoAnalysisInsight {
  type: string
  headline: string
  columns: string[]
  p_value: number
  effect_size: number
  chart_data: {
    chart_type: string
    data: Record<string, unknown>[]
    x_key: string
    y_keys: string[]
    title: string
  } | null
}

export interface AutoAnalysisResult {
  row_count: number
  column_count: number
  measures: string[]
  dimensions: string[]
  binaries: string[]
  dates: string[]
  correlations: {
    pairs: { col1: string; col2: string; r: number; p_value: number; strength: string; significant: boolean }[]
    matrix: Record<string, Record<string, number>>
    columns: string[]
  }
  distributions: {
    column: string; bins: number[]; counts: number[]; mean: number; median: number
    std: number; skewness: number; kurtosis: number; shape: string; min: number; max: number
  }[]
  anomalies: {
    column: string; outlier_count: number; outlier_pct: number; severity: string
    lower_bound: number; upper_bound: number; z_score_outliers: number
  }[]
  segments: {
    dimension: string; measure: string; f_statistic: number; p_value: number
    eta_squared: number; effect_size: string
    groups: { group: string; n: number; mean: number; std: number }[]
    chart_data: Record<string, unknown>
  }[]
  clusters: {
    n_clusters: number; columns_used: string[]
    clusters: Record<string, unknown>[]
  }
  contribution_analysis: {
    measure: string; dimension: string; total: number
    top_contributor: string; top_contribution_pct: number
    chart_data: Record<string, unknown>
  }[]
  majority: {
    dimension: string; measure: string; dominant_category: string
    dominant_share: number; total_categories: number
  }[]
  key_influencers: {
    target: string; influencer: string; type: string
    best_group?: string; best_rate?: number; worst_group?: string; worst_rate?: number; lift?: number
    cramers_v?: number; correlation?: number; p_value: number
  }[]
  top_insights: AutoAnalysisInsight[]
}
