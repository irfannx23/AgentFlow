create table public.automation_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id text not null default private.current_user_id(),
  sequence integer not null,
  label text not null,
  change_summary text not null,
  modified_artifacts jsonb not null default '[]'::jsonb,
  change_details jsonb not null default '{"added":[],"modified":[],"removed":[]}'::jsonb,
  ai_reasoning text,
  workflow_hash text,
  author text not null default 'ai' check (author in ('ai', 'user', 'system')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, sequence)
);

create table public.project_timeline (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id text not null default private.current_user_id(),
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.workflow_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id text not null default private.current_user_id(),
  platform text not null check (platform in ('n8n', 'make')),
  source_file_name text not null,
  source_payload jsonb not null,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index automation_versions_project_created_idx on public.automation_versions(project_id, created_at desc);
create index project_timeline_project_created_idx on public.project_timeline(project_id, created_at desc);
create index workflow_imports_project_created_idx on public.workflow_imports(project_id, created_at desc);

alter table public.automation_versions enable row level security;
alter table public.project_timeline enable row level security;
alter table public.workflow_imports enable row level security;

create policy "automation_versions_own" on public.automation_versions for all to anon, authenticated
using (owner_id = private.current_user_id() and private.can_access_project(project_id))
with check (owner_id = private.current_user_id() and private.owns_project(project_id));

create policy "project_timeline_own" on public.project_timeline for all to anon, authenticated
using (owner_id = private.current_user_id() and private.can_access_project(project_id))
with check (owner_id = private.current_user_id() and private.owns_project(project_id));

create policy "workflow_imports_own" on public.workflow_imports for all to anon, authenticated
using (owner_id = private.current_user_id() and private.can_access_project(project_id))
with check (owner_id = private.current_user_id() and private.owns_project(project_id));

grant select, insert, update, delete on public.automation_versions to anon, authenticated;
grant select, insert, update, delete on public.project_timeline to anon, authenticated;
grant select, insert, update, delete on public.workflow_imports to anon, authenticated;
