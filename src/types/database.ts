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
  project_id: string | null;
  org_id: string | null;
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
  file_path: string | null;
  pipeline_status: string | null;
  pipeline_recipe_id: string | null;
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
  project_id: string | null;
  org_id: string | null;
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
  project_id: string | null;
  org_id: string | null;
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
  project_id: string | null;
  org_id: string | null;
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
  project_id: string | null;
  org_id: string | null;
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

// ─── ORGANIZATION ─────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  type: 'personal' | 'team'
  logo_url: string | null
  plan: 'free' | 'pro' | 'enterprise'
  billing_email: string | null
  owner_id: string
  created_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  created_at: string
}

// ─── WORKSPACE ────────────────────────────────────────

export interface Workspace {
  id: string
  org_id: string
  name: string
  slug: string
  description: string | null
  icon: string
  color: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'admin' | 'editor' | 'viewer'
  created_at: string
}

// ─── PROJECT ──────────────────────────────────────────

export interface Project {
  id: string
  workspace_id: string
  org_id: string
  name: string
  slug: string
  description: string | null
  icon: string
  color: string
  created_by: string
  created_at: string
  updated_at: string
}

// ─── INVITATION ───────────────────────────────────────

export interface Invitation {
  id: string
  org_id: string
  workspace_id: string | null
  email: string
  role: string
  token: string
  invited_by: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

// ─── CONTEXT TYPES ────────────────────────────────────

export interface AppContext {
  org: Organization
  workspace: Workspace
  project: Project | null
  orgRole: OrgMember['role']
  workspaceRole: WorkspaceMember['role'] | null
  isPersonal: boolean
}

// ─── INSERT / UPDATE HELPERS (new tables) ─────────────

export type OrganizationInsert = Partial<Organization> & Pick<Organization, 'name' | 'slug' | 'owner_id'>
export type OrganizationUpdate = Partial<Organization>

export type OrgMemberInsert = Partial<OrgMember> & Pick<OrgMember, 'org_id' | 'user_id'>
export type OrgMemberUpdate = Partial<OrgMember>

export type WorkspaceInsert = Partial<Workspace> & Pick<Workspace, 'org_id' | 'name' | 'slug'>
export type WorkspaceUpdate = Partial<Workspace>

export type WorkspaceMemberInsert = Partial<WorkspaceMember> & Pick<WorkspaceMember, 'workspace_id' | 'user_id'>
export type WorkspaceMemberUpdate = Partial<WorkspaceMember>

export type ProjectInsert = Partial<Project> & Pick<Project, 'workspace_id' | 'org_id' | 'name' | 'slug'>
export type ProjectUpdate = Partial<Project>

export type InvitationInsert = Partial<Invitation> & Pick<Invitation, 'org_id' | 'email'>
export type InvitationUpdate = Partial<Invitation>

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
      organizations: {
        Row: Organization;
        Insert: OrganizationInsert;
        Update: OrganizationUpdate;
        Relationships: [];
      };
      org_members: {
        Row: OrgMember;
        Insert: OrgMemberInsert;
        Update: OrgMemberUpdate;
        Relationships: [];
      };
      workspaces: {
        Row: Workspace;
        Insert: WorkspaceInsert;
        Update: WorkspaceUpdate;
        Relationships: [];
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: WorkspaceMemberInsert;
        Update: WorkspaceMemberUpdate;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [];
      };
      invitations: {
        Row: Invitation;
        Insert: InvitationInsert;
        Update: InvitationUpdate;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
