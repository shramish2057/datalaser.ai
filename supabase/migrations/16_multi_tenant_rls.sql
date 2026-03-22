-- MIGRATION 16: RLS + Policies + Indexes for multi-tenant tables

-- Enable RLS
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table projects enable row level security;
alter table invitations enable row level security;

-- Organizations: users see orgs they belong to
create policy "users see their orgs"
  on organizations for select
  using (id in (
    select org_id from org_members where user_id = auth.uid()
  ));

-- Organizations: owners can do everything
create policy "users manage their orgs"
  on organizations for all
  using (owner_id = auth.uid());

-- Workspaces: org members can see
create policy "org members see workspaces"
  on workspaces for select
  using (org_id in (
    select org_id from org_members where user_id = auth.uid()
  ));

-- Workspaces: org admins/owners can manage
create policy "org members manage workspaces"
  on workspaces for all
  using (org_id in (
    select org_id from org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

-- Projects: workspace members can see
create policy "workspace members see projects"
  on projects for select
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));

-- Projects: workspace editors/admins can manage
create policy "workspace editors manage projects"
  on projects for all
  using (workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid() and role in ('admin', 'editor')
  ));

-- Org members: visible to fellow org members
create policy "org members see org_members"
  on org_members for select
  using (org_id in (
    select org_id from org_members where user_id = auth.uid()
  ));

-- Workspace members: visible to fellow workspace members
create policy "workspace members see workspace_members"
  on workspace_members for select
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));

-- Invitations: visible to org admins/owners
create policy "users see their invitations"
  on invitations for select
  using (org_id in (
    select org_id from org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

-- Indexes for performance
create index on org_members(user_id);
create index on org_members(org_id);
create index on workspace_members(user_id);
create index on workspace_members(workspace_id);
create index on projects(workspace_id);
create index on projects(org_id);
create index on invitations(org_id);
create index on invitations(token);
create index on data_sources(project_id);
create index on data_sources(org_id);
create index on insight_documents(project_id);
create index on conversations(project_id);
create index on dashboards(project_id);
create index on anomalies(project_id);
