-- MIGRATION 1: Core workspace
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  workspace_name text not null default 'My Workspace',
  role text,
  industry text,
  primary_metrics text[] default '{}',
  data_update_frequency text default 'daily',
  revenue_baseline numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
