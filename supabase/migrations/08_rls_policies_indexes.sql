-- MIGRATION 8: Row Level Security, policies, and indexes

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table data_sources enable row level security;
alter table insight_documents enable row level security;
alter table conversations enable row level security;
alter table dashboards enable row level security;
alter table anomalies enable row level security;
alter table sync_logs enable row level security;

-- Policies: users only see their own workspace data
create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own sources" on data_sources for all using (auth.uid() = workspace_id);
create policy "own insights" on insight_documents for all using (auth.uid() = workspace_id);
create policy "own conversations" on conversations for all using (auth.uid() = workspace_id);
create policy "own dashboards" on dashboards for all using (auth.uid() = workspace_id);
create policy "own anomalies" on anomalies for all using (auth.uid() = workspace_id);
create policy "own logs" on sync_logs for all using (
  auth.uid() = (select workspace_id from data_sources where id = source_id)
);

-- Indexes for performance
create index on data_sources(workspace_id);
create index on insight_documents(workspace_id);
create index on conversations(workspace_id);
create index on dashboards(workspace_id);
create index on anomalies(workspace_id, is_read);
create index on sync_logs(source_id);
