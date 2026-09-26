create table public.connections (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default private.current_user_id(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null,
  encrypted_credential text not null,
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_successful_test_at timestamptz,
  constraint connections_owner_id_not_empty check (length(trim(owner_id)) > 0),
  constraint connections_provider_not_empty check (length(trim(provider)) > 0),
  constraint connections_credential_not_empty check (length(encrypted_credential) > 0),
  constraint connections_status_valid check (status in ('connected', 'invalid'))
);

create unique index connections_personal_provider_unique
on public.connections(owner_id, provider)
where organization_id is null;

create unique index connections_workspace_provider_unique
on public.connections(organization_id, provider)
where organization_id is not null;

create index connections_owner_id_idx on public.connections(owner_id);
create index connections_organization_id_idx on public.connections(organization_id);

create trigger connections_set_updated_at
before update on public.connections
for each row execute function private.set_updated_at();

alter table public.connections enable row level security;

create policy "connections_select_own_or_workspace"
on public.connections for select to authenticated
using (
  owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
);

create policy "connections_insert_own_or_workspace"
on public.connections for insert to authenticated
with check (
  owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
);

create policy "connections_update_own_or_workspace"
on public.connections for update to authenticated
using (
  owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
)
with check (
  owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
);

create policy "connections_delete_own_or_workspace"
on public.connections for delete to authenticated
using (
  owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
);

grant select, insert, update, delete on public.connections to authenticated;
