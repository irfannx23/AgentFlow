alter table public.projects drop constraint projects_stage_valid;
update public.projects set stage = case stage
  when 'Idea' then 'Business Problem'
  when 'Architecture' then 'Requirements'
  when 'Resources' then 'Workflow Design'
  when 'Milestones' then 'Workflow Generation'
  else stage end;
alter table public.projects alter column stage set default 'Business Problem';
alter table public.projects add constraint projects_stage_valid check (stage in ('Business Problem', 'Requirements', 'Workflow Design', 'Workflow Generation', 'Review', 'Export'));

create table public.automation_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  owner_id text not null default private.current_user_id(),
  business_problem text not null default '',
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'gathering' check (status in ('gathering', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  owner_id text not null default private.current_user_id(),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'generated', 'reviewed')),
  graph jsonb not null default '{"nodes":[],"edges":[],"variables":[],"credentials":[]}'::jsonb,
  explanation text,
  deployment_guide text,
  environment_variables jsonb not null default '[]'::jsonb,
  testing_checklist jsonb not null default '[]'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_exports (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.automation_workflows(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id text not null default private.current_user_id(),
  platform text not null check (platform = 'n8n'),
  workflow_version integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index automation_exports_project_created_idx on public.automation_exports(project_id, created_at desc);
create trigger automation_requirements_updated_at before update on public.automation_requirements for each row execute function private.set_updated_at();
create trigger automation_workflows_updated_at before update on public.automation_workflows for each row execute function private.set_updated_at();

alter table public.automation_requirements enable row level security;
alter table public.automation_workflows enable row level security;
alter table public.automation_exports enable row level security;

create policy "automation_requirements_own" on public.automation_requirements for all to anon, authenticated
using (owner_id = (select private.current_user_id()) and (select private.can_access_project(project_id)))
with check ((select private.current_user_id()) is not null and owner_id = (select private.current_user_id()) and (select private.owns_project(project_id)));
create policy "automation_workflows_own" on public.automation_workflows for all to anon, authenticated
using (owner_id = (select private.current_user_id()) and (select private.can_access_project(project_id)))
with check ((select private.current_user_id()) is not null and owner_id = (select private.current_user_id()) and (select private.owns_project(project_id)));
create policy "automation_exports_own" on public.automation_exports for all to anon, authenticated
using (owner_id = (select private.current_user_id()) and (select private.can_access_project(project_id)))
with check ((select private.current_user_id()) is not null and owner_id = (select private.current_user_id()) and (select private.owns_project(project_id)));

grant select, insert, update, delete on public.automation_requirements to anon, authenticated;
grant select, insert, update, delete on public.automation_workflows to anon, authenticated;
grant select, insert, update, delete on public.automation_exports to anon, authenticated;
