-- MIGRATION 5: Dashboards
create table dashboards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references profiles(id) on delete cascade not null,
  name text default 'My Dashboard',
  layout jsonb default '[]',
  widgets jsonb default '[]',
  refresh_interval integer default 300,
  is_public boolean default false,
  public_token text unique default gen_random_uuid()::text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
