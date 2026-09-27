alter table public.projects drop constraint if exists projects_stage_valid;

alter table public.projects add constraint projects_stage_valid check (
  stage in (
    'Business Problem',
    'Requirements',
    'Workflow Planning',
    'Workflow Design',
    'Workflow Generation',
    'Review',
    'Export'
  )
);
