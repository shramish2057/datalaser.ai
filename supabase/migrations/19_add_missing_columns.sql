-- Add file_path column if it doesn't exist
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS file_path text;

-- Also add the other columns we've been using
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pipeline_status text DEFAULT 'unprepared';
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS pipeline_recipe_id uuid;

-- Add project_id and org_id if not already there
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS org_id uuid;
