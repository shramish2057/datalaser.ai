-- MIGRATION 13: Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  icon text default '📊',
  color text default '#509EE3',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(workspace_id, slug)
);
