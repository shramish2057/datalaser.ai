-- MIGRATION 6: Anomalies
create table anomalies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references profiles(id) on delete cascade not null,
  source_id uuid references data_sources(id) on delete cascade,
  metric_name text not null,
  current_value numeric,
  baseline_value numeric,
  deviation_pct numeric,
  severity text,
  explanation text,
  is_read boolean default false,
  detected_at timestamptz default now()
);
