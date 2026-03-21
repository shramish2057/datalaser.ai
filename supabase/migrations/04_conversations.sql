-- MIGRATION 4: Ask Data conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references profiles(id) on delete cascade not null,
  title text default 'New conversation',
  messages jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
