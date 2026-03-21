// TypeScript types for AI-generated insights, anomalies, and query results
// Re-exports from database.ts for convenience, plus AI-specific types

export type {
  SeverityChip,
  KPI,
  KeyFinding,
  Recommendation,
  Anomaly,
  DeepDive,
  InsightDocument,
} from './database';

// Chart and table embed types parsed from Ask Data responses
export interface ChartEmbed {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  title: string;
  xKey: string;
  yKey: string;
  data: { name: string; value: number }[];
}

export interface TableEmbed {
  title: string;
  columns: string[];
  rows: string[][];
}
