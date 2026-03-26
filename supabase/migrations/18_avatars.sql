-- Migration: Add avatar/logo support for users, orgs, workspaces, projects

-- 1. Add avatar_url to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. logo_url already exists on organizations (from migration 09)

-- 3. Add logo_url to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo_url text;

-- 4. Add logo_url to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url text;

-- 5. Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage policies for avatars bucket
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete their avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
