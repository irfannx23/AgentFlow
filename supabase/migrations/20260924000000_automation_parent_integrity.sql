-- Keep an export's workflow, project, and owner in the same security scope.
-- This mirrors the existing document/chunk and conversation/message parent
-- integrity constraints.
alter table public.automation_workflows
add constraint automation_workflows_identity_key unique (id, project_id, owner_id);

alter table public.automation_exports
add constraint automation_exports_workflow_scope_fkey
foreign key (workflow_id, project_id, owner_id)
references public.automation_workflows(id, project_id, owner_id)
on delete cascade;
