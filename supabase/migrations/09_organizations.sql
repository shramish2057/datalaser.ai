-- MIGRATION 9: Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  type text default 'personal',
  logo_url text,
  plan text default 'free',
  billing_email text,
  owner_id uuid references auth.users(id),
  created_at timestamptz default now()
);
