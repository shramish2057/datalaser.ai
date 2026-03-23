-- Auto-analysis results storage
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS auto_analysis jsonb DEFAULT NULL;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'pending';
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;
