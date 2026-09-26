-- Firebase third-party JWTs are verified by Supabase but execute as the anon
-- Postgres role because they do not include Supabase's authenticated role
-- claim. Match the established workspace/project RLS pattern while requiring
-- a verified, non-null JWT subject for every operation.

drop policy if exists "connections_select_own_or_workspace" on public.connections;
drop policy if exists "connections_insert_own_or_workspace" on public.connections;
drop policy if exists "connections_update_own_or_workspace" on public.connections;
drop policy if exists "connections_delete_own_or_workspace" on public.connections;

create policy "connections_select_own_or_workspace"
on public.connections for select
to anon, authenticated
using (
  (select private.current_user_id()) is not null
  and owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
);

create policy "connections_insert_own_or_workspace"
on public.connections for insert
to anon, authenticated
with check (
  (select private.current_user_id()) is not null
  and owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
);

create policy "connections_update_own_or_workspace"
on public.connections for update
to anon, authenticated
using (
  (select private.current_user_id()) is not null
  and owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
)
with check (
  (select private.current_user_id()) is not null
  and owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
);

create policy "connections_delete_own_or_workspace"
on public.connections for delete
to anon, authenticated
using (
  (select private.current_user_id()) is not null
  and owner_id = (select private.current_user_id())
  and (organization_id is null or (select private.is_organization_member(organization_id)))
);

grant select, insert, update, delete on public.connections to anon;
