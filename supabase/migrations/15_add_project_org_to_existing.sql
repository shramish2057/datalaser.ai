-- MIGRATION 15: Add project_id and org_id to existing tables
alter table data_sources
  add column if not exists project_id uuid references projects(id) on delete cascade,
  add column if not exists org_id uuid references organizations(id) on delete cascade;

alter table insight_documents
  add column if not exists project_id uuid references projects(id) on delete cascade,
  add column if not exists org_id uuid references organizations(id) on delete cascade;

alter table conversations
  add column if not exists project_id uuid references projects(id) on delete cascade,
  add column if not exists org_id uuid references organizations(id) on delete cascade;

alter table dashboards
  add column if not exists project_id uuid references projects(id) on delete cascade,
  add column if not exists org_id uuid references organizations(id) on delete cascade;

alter table anomalies
  add column if not exists project_id uuid references projects(id) on delete cascade,
  add column if not exists org_id uuid references organizations(id) on delete cascade;
