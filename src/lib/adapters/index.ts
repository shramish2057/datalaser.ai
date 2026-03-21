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

// --- Factory ---

export function createAdapter(sourceType: SourceType, credentials: AnyCredentials): DataAdapter {
  switch (sourceType) {
    case 'postgres':
      return new PostgresAdapter(credentials as any);
    case 'mysql':
      return new MysqlAdapter(credentials as any);
    case 'mongodb':
      return new MongoDBAdapter(credentials as any);
    case 'snowflake':
      return new SnowflakeAdapter(credentials as any);
    case 'csv':
      return new CSVAdapter(credentials as any);
    default:
      throw new Error(`Unsupported source type: ${sourceType}. Supported: postgres, mysql, mongodb, snowflake, csv`);
  }
}
