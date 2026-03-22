-- MIGRATION 12: Workspace members
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'editor',
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);
