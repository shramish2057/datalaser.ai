-- Add missing columns for insights and analysis features
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS analysis_status text;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS auto_analysis jsonb;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS data_profile jsonb;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS cleaned_file_path text;
