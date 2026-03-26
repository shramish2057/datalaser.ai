-- MIGRATION 25: Access Control + Org VIL Overview
-- Adds project-level access control and org-level VIL graph support.

-- ─── 1. New columns on existing tables ───────────────────

-- workspace_members: control whether user sees all team projects or only assigned
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS project_access_type text NOT NULL DEFAULT 'all'
  CHECK (project_access_type IN ('all', 'assigned'));

-- projects: control whether all team members see this project or only assigned
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'team'
  CHECK (visibility IN ('team', 'assigned'));

-- ─── 2. New table: project_assignments ───────────────────
-- When project.visibility = 'assigned' OR
-- workspace_member.project_access_type = 'assigned',
-- user needs an explicit assignment to see the project.

CREATE TABLE IF NOT EXISTS project_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: project_assignments policies must NOT reference the projects table
-- to avoid infinite recursion (projects_select → project_assignments → projects).
-- Use simple user_id check + org_members for admin access.

CREATE POLICY "project_assignments_select"
  ON project_assignments FOR SELECT
  USING (
    -- Users see their own assignments
    user_id = auth.uid()
    OR
    -- Org owners/admins see all assignments in their org
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "project_assignments_insert"
  ON project_assignments FOR INSERT
  WITH CHECK (
    -- Org owners/admins can assign
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "project_assignments_delete"
  ON project_assignments FOR DELETE
  USING (
    -- Org owners/admins can remove assignments
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id);

-- ─── 3. New table: org_vil_graphs ────────────────────────
-- Org-level VIL overview graph for DL Overview (owners only).

CREATE TABLE IF NOT EXISTS org_vil_graphs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  graph_data jsonb NOT NULL DEFAULT '{}',
  narrative_de text,
  narrative_en text,
  cross_team_insights jsonb DEFAULT '[]',
  team_health_scores jsonb DEFAULT '{}',
  health_score float DEFAULT 0,
  built_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE org_vil_graphs ENABLE ROW LEVEL SECURITY;

-- Only org owners can read/write org overview
CREATE POLICY "org_vil_graphs_select"
  ON org_vil_graphs FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_vil_graphs_insert"
  ON org_vil_graphs FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "org_vil_graphs_update"
  ON org_vil_graphs FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE INDEX IF NOT EXISTS idx_org_vil_graphs_org ON org_vil_graphs(org_id);

-- ─── 4. Fix broken vil_graphs RLS ───────────────────────
-- Current policies use `projects.workspace_id = auth.uid()` which is wrong.
-- workspace_id references the workspaces table, not the user.

DROP POLICY IF EXISTS "Users can view own project graphs" ON vil_graphs;
DROP POLICY IF EXISTS "Users can insert own project graphs" ON vil_graphs;
DROP POLICY IF EXISTS "Users can update own project graphs" ON vil_graphs;

CREATE POLICY "vil_graphs_select"
  ON vil_graphs FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
    OR project_id IN (
      SELECT p.id FROM projects p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE om.user_id = auth.uid() AND om.role = 'owner'
    )
  );

CREATE POLICY "vil_graphs_insert"
  ON vil_graphs FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "vil_graphs_update"
  ON vil_graphs FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- ─── 5. Fix broken vil_corrections RLS ──────────────────

DROP POLICY IF EXISTS "Users can view own corrections" ON vil_corrections;
DROP POLICY IF EXISTS "Users can insert own corrections" ON vil_corrections;

CREATE POLICY "vil_corrections_select"
  ON vil_corrections FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "vil_corrections_insert"
  ON vil_corrections FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- ─── 6. Update projects SELECT policy ───────────────────
-- Now respects visibility + assignment access control.

DROP POLICY IF EXISTS "projects_select" ON projects;

CREATE POLICY "projects_select"
  ON projects FOR SELECT
  USING (
    -- Org owners always see all projects in their org
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
    OR
    -- Workspace members see projects based on visibility + access type
    (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
      AND (
        -- Team-visible projects: all workspace members see them
        visibility = 'team'
        OR
        -- Assigned-only projects: need explicit assignment
        id IN (
          SELECT project_id FROM project_assignments
          WHERE user_id = auth.uid()
        )
        OR
        -- Creator always sees their project
        created_by = auth.uid()
      )
    )
  );
