-- MIGRATION 7: Sync logs
create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references data_sources(id) on delete cascade not null,
  status text not null,
  rows_synced bigint default 0,
  duration_ms integer,
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz
);
