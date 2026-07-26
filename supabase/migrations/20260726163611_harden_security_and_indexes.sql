-- Dashboard automatic-RLS helper is an internal trigger helper, not a public RPC.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute
      'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

-- Keep one SELECT policy per role/action to avoid repeated policy evaluation.
drop policy countries_select_active on public.countries;
drop policy countries_admin_select_all on public.countries;

create policy countries_anon_select_active
on public.countries for select
to anon
using (active);

create policy countries_authenticated_select
on public.countries for select
to authenticated
using (active or private.is_admin());

drop policy organization_units_select_active on public.organization_units;
drop policy organization_units_admin_select_all on public.organization_units;

create policy organization_units_anon_select_active
on public.organization_units for select
to anon
using (active);

create policy organization_units_authenticated_select
on public.organization_units for select
to authenticated
using (active or private.is_admin());

drop policy travel_public_select on public.travel_records;
drop policy travel_internal_select on public.travel_records;

create policy travel_anon_select_published
on public.travel_records for select
to anon
using (
  publication_status = 'published'
  and public_visible
  and deleted_at is null
);

create policy travel_authenticated_select
on public.travel_records for select
to authenticated
using (
  (
    publication_status = 'published'
    and public_visible
    and deleted_at is null
  )
  or private.can_access_module('travel', 'view')
);

-- Cover foreign keys used by joins, deletes, and audit ownership lookups.
create index user_roles_granted_by_idx
  on private.user_roles (granted_by);
create index module_permissions_granted_by_idx
  on private.module_permissions (granted_by);

create index import_batches_created_by_idx
  on public.import_batches (created_by);

create index people_organization_unit_idx
  on public.people (organization_unit_id);
create index people_created_by_idx
  on public.people (created_by);
create index people_updated_by_idx
  on public.people (updated_by);

create index travel_records_created_by_idx
  on public.travel_records (created_by);
create index travel_records_updated_by_idx
  on public.travel_records (updated_by);
create index travel_records_deleted_by_idx
  on public.travel_records (deleted_by);

create index travel_participants_person_idx
  on public.travel_participants (person_id);
create index travel_participants_organization_unit_snapshot_idx
  on public.travel_participants (organization_unit_id_snapshot);
create index travel_participants_created_by_idx
  on public.travel_participants (created_by);
create index travel_participants_updated_by_idx
  on public.travel_participants (updated_by);

create index travel_budgets_source_unit_idx
  on public.travel_budgets (source_unit_id);
create index travel_budgets_created_by_idx
  on public.travel_budgets (created_by);
create index travel_budgets_updated_by_idx
  on public.travel_budgets (updated_by);
