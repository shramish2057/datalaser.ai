-- MIGRATION 27: Extended ML Training Infrastructure
-- Table-level classification, template result tracking, vocabulary building.

-- Table-level training data
CREATE TABLE IF NOT EXISTS ml_training_tables (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid REFERENCES data_sources(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  row_count integer,
  column_count integer,
  numeric_pct float,
  text_pct float,
  date_pct float,
  has_timestamp boolean DEFAULT false,
  has_id_column boolean DEFAULT false,
  avg_cardinality float,
  role_distribution jsonb DEFAULT '{}',
  table_type text,
  label_source text DEFAULT 'regex',
  industry_type text,
  domain_id text,
  created_at timestamptz DEFAULT now()
);

-- Template execution results (for learning which templates work)
CREATE TABLE IF NOT EXISTS ml_template_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid REFERENCES data_sources(id) ON DELETE SET NULL,
  template_id text NOT NULL,
  domain_id text,
  success boolean DEFAULT false,
  findings_count integer DEFAULT 0,
  data_quality_score float,
  row_count integer,
  column_match_pct float,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Auto-growing vocabulary (German business terms)
CREATE TABLE IF NOT EXISTS ml_vocabulary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  term text NOT NULL,
  language text NOT NULL DEFAULT 'de',
  domain_id text,
  business_role text,
  translation text,
  frequency integer DEFAULT 1,
  first_seen_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(term, language)
);

-- Dataset-level training features (for domain classification)
CREATE TABLE IF NOT EXISTS ml_training_datasets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid REFERENCES data_sources(id) ON DELETE SET NULL,
  table_count integer,
  total_row_count integer,
  total_column_count integer,
  numeric_column_pct float,
  text_column_pct float,
  date_column_pct float,
  role_distribution jsonb DEFAULT '{}',
  domain_pattern_scores jsonb DEFAULT '{}',
  domain_id text,
  domain_confidence float,
  label_source text DEFAULT 'regex',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ml_tables_source ON ml_training_tables(source_id);
CREATE INDEX IF NOT EXISTS idx_ml_tables_type ON ml_training_tables(table_type);
CREATE INDEX IF NOT EXISTS idx_ml_template_results_template ON ml_template_results(template_id);
CREATE INDEX IF NOT EXISTS idx_ml_template_results_domain ON ml_template_results(domain_id);
CREATE INDEX IF NOT EXISTS idx_ml_vocabulary_term ON ml_vocabulary(term);
CREATE INDEX IF NOT EXISTS idx_ml_vocabulary_domain ON ml_vocabulary(domain_id);
CREATE INDEX IF NOT EXISTS idx_ml_datasets_domain ON ml_training_datasets(domain_id);

-- RLS
ALTER TABLE ml_training_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_template_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_training_datasets ENABLE ROW LEVEL SECURITY;

-- All ML tables: readable by owners/admins, writable by authenticated
CREATE POLICY "ml_training_tables_select" ON ml_training_tables FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ml_training_tables_insert" ON ml_training_tables FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ml_template_results_select" ON ml_template_results FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ml_template_results_insert" ON ml_template_results FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ml_vocabulary_select" ON ml_vocabulary FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ml_vocabulary_insert" ON ml_vocabulary FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ml_vocabulary_update" ON ml_vocabulary FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "ml_datasets_select" ON ml_training_datasets FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ml_datasets_insert" ON ml_training_datasets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
