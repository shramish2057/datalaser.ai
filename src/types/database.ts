// TypeScript types matching Supabase database schema

export interface Profile {
  id: string;
  workspace_name: string;
  role: string | null;
  industry: string | null;
  primary_metrics: string[];
  data_update_frequency: string;
  revenue_baseline: number | null;
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  id: string;
  workspace_id: string;
  name: string;
  source_type: string;
  category: string;
  encrypted_credentials: string | null;
  status: string;
  last_synced_at: string | null;
  row_count: number;
  sync_frequency: string;
  schema_snapshot: Record<string, unknown>;
  sample_data: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeverityChip {
  label: string;
  level: 'critical' | 'warning' | 'info' | 'success';
}

export interface KPI {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'flat';
}

export interface KeyFinding {
  title: string;
  description: string;
  severity: string;
  metric?: string;
}

export interface Recommendation {
  title: string;
  description: string;
  impact: string;
  effort: string;
}

export interface Anomaly {
  metric: string;
  value: number;
  expected: number;
  deviation: number;
  explanation: string;
}

export interface DeepDive {
  title: string;
  content: string;
  charts?: unknown[];
}

export interface InsightDocument {
  id: string;
  workspace_id: string;
  title: string | null;
  executive_summary: string | null;
  severity_chips: SeverityChip[];
  kpis: KPI[];
  key_findings: KeyFinding[];
  recommendations: Recommendation[];
  anomalies: Anomaly[];
  deep_dives: DeepDive[];
  sources_used: string[];
  generated_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sql?: string;
  data?: unknown;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  title: string;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface Dashboard {
  id: string;
  workspace_id: string;
  name: string;
  layout: unknown[];
  widgets: DashboardWidget[];
  refresh_interval: number;
  is_public: boolean;
  public_token: string;
  created_at: string;
  updated_at: string;
}

export interface AnomalyRecord {
  id: string;
  workspace_id: string;
  source_id: string | null;
  metric_name: string;
  current_value: number | null;
  baseline_value: number | null;
  deviation_pct: number | null;
  severity: string | null;
  explanation: string | null;
  is_read: boolean;
  detected_at: string;
}

export interface SyncLog {
  id: string;
  source_id: string;
  status: string;
  rows_synced: number;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

// Supabase Database type definition for typed client usage

export type ProfileInsert = Partial<Profile> & Pick<Profile, 'id'>;
export type ProfileUpdate = Partial<Profile>;

export type DataSourceInsert = Partial<DataSource> & Pick<DataSource, 'workspace_id' | 'name' | 'source_type' | 'category'>;
export type DataSourceUpdate = Partial<DataSource>;

export type InsightDocumentInsert = Partial<InsightDocument> & Pick<InsightDocument, 'workspace_id'>;
export type InsightDocumentUpdate = Partial<InsightDocument>;

export type ConversationInsert = Partial<Conversation> & Pick<Conversation, 'workspace_id'>;
export type ConversationUpdate = Partial<Conversation>;

export type DashboardInsert = Partial<Dashboard> & Pick<Dashboard, 'workspace_id'>;
export type DashboardUpdate = Partial<Dashboard>;

export type AnomalyRecordInsert = Partial<AnomalyRecord> & Pick<AnomalyRecord, 'workspace_id' | 'metric_name'>;
export type AnomalyRecordUpdate = Partial<AnomalyRecord>;

export type SyncLogInsert = Partial<SyncLog> & Pick<SyncLog, 'source_id' | 'status'>;
export type SyncLogUpdate = Partial<SyncLog>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      data_sources: {
        Row: DataSource;
        Insert: DataSourceInsert;
        Update: DataSourceUpdate;
        Relationships: [];
      };
      insight_documents: {
        Row: InsightDocument;
        Insert: InsightDocumentInsert;
        Update: InsightDocumentUpdate;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: ConversationInsert;
        Update: ConversationUpdate;
        Relationships: [];
      };
      dashboards: {
        Row: Dashboard;
        Insert: DashboardInsert;
        Update: DashboardUpdate;
        Relationships: [];
      };
      anomalies: {
        Row: AnomalyRecord;
        Insert: AnomalyRecordInsert;
        Update: AnomalyRecordUpdate;
        Relationships: [];
      };
      sync_logs: {
        Row: SyncLog;
        Insert: SyncLogInsert;
        Update: SyncLogUpdate;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
