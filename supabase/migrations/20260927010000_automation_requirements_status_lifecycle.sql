alter table public.automation_requirements
drop constraint if exists automation_requirements_status_check;

alter table public.automation_requirements
add constraint automation_requirements_status_check
check (status in ('gathering', 'planning', 'ready'));
