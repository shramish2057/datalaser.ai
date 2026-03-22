-- MIGRATION 17: Fix recursive RLS policies
-- The original policies on org_members and workspace_members
-- referenced themselves in subqueries, causing infinite recursion.

-- ─── Drop all broken policies ─────────────────────────────

drop policy if exists "users see their orgs" on organizations;
drop policy if exists "users manage their orgs" on organizations;
drop policy if exists "org members see workspaces" on workspaces;
drop policy if exists "org members manage workspaces" on workspaces;
drop policy if exists "workspace members see projects" on projects;
drop policy if exists "workspace editors manage projects" on projects;
drop policy if exists "org members see org_members" on org_members;
drop policy if exists "workspace members see workspace_members" on workspace_members;
drop policy if exists "users see their invitations" on invitations;

-- ─── org_members (no self-reference) ──────────────────────

-- SELECT: you can see memberships where you are the member
create policy "org_members_select"
  on org_members for select
  using (user_id = auth.uid());

-- INSERT: authenticated users can insert (bootstrap creates first membership)
create policy "org_members_insert"
  on org_members for insert
  with check (auth.uid() is not null);

-- DELETE: only the member themselves or org owners
create policy "org_members_delete"
  on org_members for delete
  using (user_id = auth.uid());

-- ─── workspace_members (no self-reference) ────────────────

create policy "workspace_members_select"
  on workspace_members for select
  using (user_id = auth.uid());

create policy "workspace_members_insert"
  on workspace_members for insert
  with check (auth.uid() is not null);

create policy "workspace_members_delete"
  on workspace_members for delete
  using (user_id = auth.uid());

-- ─── organizations ────────────────────────────────────────

-- SELECT: you can see orgs you belong to (safe: queries org_members which no longer self-refs)
create policy "organizations_select"
  on organizations for select
  using (
    id in (select org_id from org_members where user_id = auth.uid())
    or owner_id = auth.uid()
  );

-- INSERT: any authenticated user can create an org
create policy "organizations_insert"
  on organizations for insert
  with check (auth.uid() = owner_id);

-- UPDATE/DELETE: only the owner
create policy "organizations_update"
  on organizations for update
  using (owner_id = auth.uid());

create policy "organizations_delete"
  on organizations for delete
  using (owner_id = auth.uid());

-- ─── workspaces ───────────────────────────────────────────

create policy "workspaces_select"
  on workspaces for select
  using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "workspaces_insert"
  on workspaces for insert
  with check (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "workspaces_update"
  on workspaces for update
  using (
    org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin'))
  );

create policy "workspaces_delete"
  on workspaces for delete
  using (
    org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin'))
  );

-- ─── projects ─────────────────────────────────────────────

create policy "projects_select"
  on projects for select
  using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "projects_insert"
  on projects for insert
  with check (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "projects_update"
  on projects for update
  using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role in ('admin', 'editor'))
  );

create policy "projects_delete"
  on projects for delete
  using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role in ('admin'))
  );

-- ─── invitations ──────────────────────────────────────────

create policy "invitations_select"
  on invitations for select
  using (
    org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin'))
    or email = auth.email()
  );

create policy "invitations_insert"
  on invitations for insert
  with check (
    org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin'))
  );

create policy "invitations_delete"
  on invitations for delete
  using (
    org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin'))
  );
