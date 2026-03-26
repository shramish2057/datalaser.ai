-- MIGRATION 26: ML Training Infrastructure
-- Collects labeled training data from every VIL build.
-- Stores ML model versions and prediction logs.

-- Training samples: one row per column per VIL build
CREATE TABLE IF NOT EXISTS ml_training_samples (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid REFERENCES data_sources(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,

  -- Features (from StatisticalFingerprint)
  dtype text,
  distribution_shape text,
  value_scale text,
  null_rate float,
  unique_rate float,
  unique_count integer,
  min_value float,
  max_value float,
  mean_value float,
  std_dev float,
  skewness float,
  kurtosis float,
  is_integer boolean,

  -- Labels (ground truth)
  business_role text,
  business_category text,
  importance integer,
  label_source text NOT NULL DEFAULT 'regex'
    CHECK (label_source IN ('claude', 'user_correction', 'regex', 'ml_verified')),

  -- Dataset context
  industry_type text,

  created_at timestamptz DEFAULT now()
);

-- ML model versions
CREATE TABLE IF NOT EXISTS ml_models (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name text NOT NULL,
  version text NOT NULL,
  artifact_path text,
  accuracy float,
  f1_scores jsonb DEFAULT '{}',
  dataset_size integer DEFAULT 0,
  is_deployed boolean DEFAULT false,
  deployed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(model_name, version)
);

-- Admin dataset uploads for training
CREATE TABLE IF NOT EXISTS ml_admin_datasets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  file_path text,
  row_count integer DEFAULT 0,
  column_count integer DEFAULT 0,
  industry_type text,
  processed boolean DEFAULT false,
  samples_extracted integer DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ml_samples_role ON ml_training_samples(business_role);
CREATE INDEX IF NOT EXISTS idx_ml_samples_source ON ml_training_samples(label_source);
CREATE INDEX IF NOT EXISTS idx_ml_samples_industry ON ml_training_samples(industry_type);
CREATE INDEX IF NOT EXISTS idx_ml_models_deployed ON ml_models(model_name, is_deployed);

-- RLS
ALTER TABLE ml_training_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_admin_datasets ENABLE ROW LEVEL SECURITY;

-- Training samples: readable by org owners/admins
CREATE POLICY "ml_samples_select" ON ml_training_samples FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "ml_samples_insert" ON ml_training_samples FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Models: readable by all authenticated, writable by owners
CREATE POLICY "ml_models_select" ON ml_models FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "ml_models_insert" ON ml_models FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = auth.uid() AND role = 'owner'
  ));

CREATE POLICY "ml_models_update" ON ml_models FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- Admin datasets: owners only
CREATE POLICY "ml_admin_datasets_all" ON ml_admin_datasets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = auth.uid() AND role = 'owner'
  ));
