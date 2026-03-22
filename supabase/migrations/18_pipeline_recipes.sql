-- Stores the completed pipeline recipe per source
create table if not exists pipeline_recipes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references data_sources(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  steps jsonb not null default '[]',
  last_run_at timestamptz,
  last_run_status text,
  last_quality_score integer,
  last_row_count integer,
  schedule_enabled boolean default false,
  schedule_interval text default '24h',
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists pipeline_run_history (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references pipeline_recipes(id) on delete cascade,
  source_id uuid references data_sources(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  status text not null,
  quality_score integer,
  rows_processed integer,
  rows_before integer,
  rows_after integer,
  transformations_applied integer,
  tests_passed integer,
  tests_failed integer,
  error_message text,
  drift_detected boolean default false,
  drift_details jsonb
);

alter table data_sources add column if not exists
  pipeline_status text default 'unprepared';

alter table data_sources add column if not exists
  pipeline_recipe_id uuid references pipeline_recipes(id);

-- RLS
alter table pipeline_recipes enable row level security;
alter table pipeline_run_history enable row level security;

create policy "Users can manage their own recipes"
  on pipeline_recipes for all
  using (
    org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can view their own run history"
  on pipeline_run_history for all
  using (
    recipe_id in (
      select id from pipeline_recipes where org_id in (
        select org_id from org_members where user_id = auth.uid()
      )
    )
  );
