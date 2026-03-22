create table if not exists studio_notebooks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  created_by uuid references profiles(id),
  title text not null default 'Untitled Analysis',
  cells jsonb default '[]',
  published_insights jsonb default '[]',
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists query_library (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  project_id uuid references projects(id),
  created_by uuid references profiles(id),
  title text not null,
  description text,
  code text not null,
  operation text,
  tags text[] default '{}',
  use_count integer default 0,
  created_at timestamptz default now()
);

alter table studio_notebooks enable row level security;
alter table query_library enable row level security;

create policy "Users can manage their notebooks"
  on studio_notebooks for all
  using (
    project_id in (
      select id from projects where org_id in (
        select org_id from org_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can access org query library"
  on query_library for all
  using (
    org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  );
