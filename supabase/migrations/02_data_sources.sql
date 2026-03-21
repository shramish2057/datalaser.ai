-- MIGRATION 2: Data sources (credentials stored encrypted)
create table data_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  source_type text not null,
  category text not null,
  encrypted_credentials text,
  status text default 'pending',
  last_synced_at timestamptz,
  row_count bigint default 0,
  sync_frequency text default 'daily',
  schema_snapshot jsonb default '{}',
  sample_data jsonb default '{}',
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
