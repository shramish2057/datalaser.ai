-- VIL (Verified Intelligence Layer) tables

CREATE TABLE IF NOT EXISTS vil_graphs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  graph_data jsonb NOT NULL DEFAULT '{}',
  industry_type text,
  industry_confidence float DEFAULT 0,
  kpis_mapped jsonb DEFAULT '[]',
  node_count integer DEFAULT 0,
  edge_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vil_corrections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES data_sources(id) ON DELETE CASCADE,
  correction_type text NOT NULL,
  original_mapping jsonb,
  corrected_mapping jsonb NOT NULL,
  applied_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- RLS policies
ALTER TABLE vil_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vil_corrections ENABLE ROW LEVEL SECURITY;

-- vil_graphs: users can see graphs for projects they own
CREATE POLICY "Users can view own project graphs"
  ON vil_graphs FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE workspace_id = auth.uid()
  ));

CREATE POLICY "Users can insert own project graphs"
  ON vil_graphs FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE workspace_id = auth.uid()
  ));

CREATE POLICY "Users can update own project graphs"
  ON vil_graphs FOR UPDATE
  USING (project_id IN (
    SELECT id FROM projects WHERE workspace_id = auth.uid()
  ));

-- vil_corrections: same pattern
CREATE POLICY "Users can view own corrections"
  ON vil_corrections FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE workspace_id = auth.uid()
  ));

CREATE POLICY "Users can insert own corrections"
  ON vil_corrections FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE workspace_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vil_graphs_project ON vil_graphs(project_id);
CREATE INDEX IF NOT EXISTS idx_vil_graphs_source ON vil_graphs(source_id);
CREATE INDEX IF NOT EXISTS idx_vil_corrections_project ON vil_corrections(project_id);
