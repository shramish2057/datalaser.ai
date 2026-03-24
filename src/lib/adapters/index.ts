// Adapter registry, interfaces, and factory for selecting the correct database adapter
import type { SourceType, AnyCredentials } from '@/types/connectors';
import { PostgresAdapter } from './postgres';
import { MysqlAdapter } from './mysql';
import { MongoDBAdapter } from './mongodb';
import { SnowflakeAdapter } from './snowflake';
import { CSVAdapter } from './csv';

// --- Core interfaces ---

export interface DataAdapter {
  testConnection(): Promise<{ success: boolean; error?: string }>;
  getSchema(): Promise<SchemaSnapshot>;
  getSampleData(options?: SampleOptions): Promise<SampleData>;
  runQuery(sql: string): Promise<QueryResult>;
  disconnect(): Promise<void>;
}

export interface SchemaSnapshot {
  tables: {
    name: string;
    row_count: number;
    columns: { name: string; type: string; nullable: boolean }[];
  }[];
  database_name: string;
  captured_at: string;
}

export interface SampleOptions {
  max_rows?: number;       // default 100
  date_column?: string;    // if provided, filters last 30 days
  tables?: string[];       // if provided, only sample these tables
}

export interface SampleData {
  tables: {
    name: string;
    columns: string[];
    rows: any[][];
    total_rows: number;
    sampled_rows: number;
  }[];
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  row_count: number;
  duration_ms: number;
}

// --- Normalize credential keys to lowercase ---
// The onboarding form sends keys like "Host", "Port", "Database"
// but adapters expect "host", "port", "database"
function normalizeCredentials(creds: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {}
  for (const [key, value] of Object.entries(creds)) {
    normalized[key.toLowerCase()] = value
  }
  // Ensure port is a number
  if (normalized.port && typeof normalized.port === 'string') {
    normalized.port = parseInt(normalized.port, 10)
  }
  return normalized
}

// --- Factory ---

export function createAdapter(sourceType: SourceType, credentials: AnyCredentials): DataAdapter {
  const creds = normalizeCredentials(credentials as Record<string, any>)
  switch (sourceType) {
    case 'postgres':
      return new PostgresAdapter(creds as any);
    case 'mysql':
      return new MysqlAdapter(creds as any);
    case 'mongodb':
      return new MongoDBAdapter(creds as any);
    case 'snowflake':
      return new SnowflakeAdapter(creds as any);
    case 'csv':
      return new CSVAdapter(creds as any);
    default:
      throw new Error(`Unsupported source type: ${sourceType}. Supported: postgres, mysql, mongodb, snowflake, csv`);
  }
}
