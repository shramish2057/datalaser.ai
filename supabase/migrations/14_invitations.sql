-- MIGRATION 14: Invitations
create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  workspace_id uuid references workspaces(id),
  email text not null,
  role text default 'member',
  token text unique default gen_random_uuid()::text,
  invited_by uuid references auth.users(id),
  expires_at timestamptz default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz default now()
);
