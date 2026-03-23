-- User locale preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en';
