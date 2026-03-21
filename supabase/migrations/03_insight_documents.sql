-- MIGRATION 3: Insight documents
create table insight_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references profiles(id) on delete cascade not null,
  title text,
  executive_summary text,
  severity_chips jsonb default '[]',
  kpis jsonb default '[]',
  key_findings jsonb default '[]',
  recommendations jsonb default '[]',
  anomalies jsonb default '[]',
  deep_dives jsonb default '[]',
  sources_used uuid[] default '{}',
  generated_at timestamptz default now()
);
