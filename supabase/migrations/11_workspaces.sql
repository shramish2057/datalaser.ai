-- MIGRATION 11: Workspaces
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  icon text default '💼',
  color text default '#509EE3',
  created_at timestamptz default now(),
  unique(org_id, slug)
);
