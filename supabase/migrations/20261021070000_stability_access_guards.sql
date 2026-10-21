-- Effective database permissions must agree with the active-profile gate in
-- the application. CREATE OR REPLACE retains each existing function's ACL.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles as roles
    join public.profiles as profiles on profiles.id = roles.user_id
    where roles.user_id = (select auth.uid())
      and profiles.active
      and roles.role in ('system_admin', 'office_admin')
  );
$$;

create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles as roles
    join public.profiles as profiles on profiles.id = roles.user_id
    where roles.user_id = (select auth.uid())
      and profiles.active
      and roles.role = required_role
  );
$$;

create or replace function private.can_access_module(
  requested_module public.module_key,
  requested_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profiles
    where profiles.id = (select auth.uid())
      and profiles.active
      and requested_action in ('view', 'create', 'update', 'publish', 'delete', 'import')
      and (
        private.is_admin()
        or exists (
          select 1
          from private.module_permissions as permissions
          where permissions.user_id = profiles.id
            and permissions.module = requested_module
            and case requested_action
              when 'view' then permissions.can_view
              when 'create' then permissions.can_create
              when 'update' then permissions.can_update
              when 'publish' then permissions.can_publish
              when 'delete' then permissions.can_delete
              when 'import' then permissions.can_import
              else false
            end
        )
      )
  );
$$;

-- Asset policies call this helper directly, so they must share the same gate.
create or replace function private.can_access_any_module(requested_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(enum_range(null::public.module_key)) as modules(module)
    where private.can_access_module(modules.module, requested_action)
  );
$$;

-- A batch creator has no permanent access after their import permission is
-- revoked. Master data and legacy source batches are System Admin-only; other
-- module imports retain their permission contract (including Office Admin access).
drop policy import_batches_internal_select on public.import_batches;
create policy import_batches_internal_select
on public.import_batches for select to authenticated
using (
  private.can_access_module(module, 'import')
  and (
    (
      import_kind <> 'master_data'
      and coalesce(source_file_path, '') not in (
        'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
      )
    )
    or private.has_role('system_admin')
  )
);

drop policy import_batches_internal_insert on public.import_batches;
create policy import_batches_internal_insert
on public.import_batches for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_access_module(module, 'import')
  and (
    (
      import_kind <> 'master_data'
      and coalesce(source_file_path, '') not in (
        'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
      )
    )
    or private.has_role('system_admin')
  )
);

drop policy import_batches_internal_update on public.import_batches;
create policy import_batches_internal_update
on public.import_batches for update to authenticated
using (
  private.can_access_module(module, 'import')
  and (
    (
      import_kind <> 'master_data'
      and coalesce(source_file_path, '') not in (
        'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
      )
    )
    or private.has_role('system_admin')
  )
)
with check (
  private.can_access_module(module, 'import')
  and (
    (
      import_kind <> 'master_data'
      and coalesce(source_file_path, '') not in (
        'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
      )
    )
    or private.has_role('system_admin')
  )
);

drop policy import_batches_internal_delete on public.import_batches;
create policy import_batches_internal_delete
on public.import_batches for delete to authenticated
using (
  private.can_access_module(module, 'delete')
  and (
    (
      import_kind <> 'master_data'
      and coalesce(source_file_path, '') not in (
        'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
      )
    )
    or private.has_role('system_admin')
  )
);

-- Do not use visibility/ownership alone as authorization to mutate staging
-- rows. Check current import permission for both old and new batch identities.
drop policy import_rows_internal_select on public.import_rows;
create policy import_rows_internal_select
on public.import_rows for select to authenticated
using (
  exists (
    select 1 from public.import_batches as batches
    where batches.id = import_rows.batch_id
      and private.can_access_module(batches.module, 'import')
      and (
        (
          batches.import_kind <> 'master_data'
          and coalesce(batches.source_file_path, '') not in (
            'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
          )
        )
        or private.has_role('system_admin')
      )
  )
);

drop policy import_rows_internal_insert on public.import_rows;
create policy import_rows_internal_insert
on public.import_rows for insert to authenticated
with check (
  exists (
    select 1 from public.import_batches as batches
    where batches.id = import_rows.batch_id
      and private.can_access_module(batches.module, 'import')
      and (
        (
          batches.import_kind <> 'master_data'
          and coalesce(batches.source_file_path, '') not in (
            'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
          )
        )
        or private.has_role('system_admin')
      )
  )
);

drop policy import_rows_internal_update on public.import_rows;
create policy import_rows_internal_update
on public.import_rows for update to authenticated
using (
  exists (
    select 1 from public.import_batches as batches
    where batches.id = import_rows.batch_id
      and private.can_access_module(batches.module, 'import')
      and (
        (
          batches.import_kind <> 'master_data'
          and coalesce(batches.source_file_path, '') not in (
            'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
          )
        )
        or private.has_role('system_admin')
      )
  )
)
with check (
  exists (
    select 1 from public.import_batches as batches
    where batches.id = import_rows.batch_id
      and private.can_access_module(batches.module, 'import')
      and (
        (
          batches.import_kind <> 'master_data'
          and coalesce(batches.source_file_path, '') not in (
            'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
          )
        )
        or private.has_role('system_admin')
      )
  )
);

drop policy import_rows_internal_delete on public.import_rows;
create policy import_rows_internal_delete
on public.import_rows for delete to authenticated
using (
  exists (
    select 1 from public.import_batches as batches
    where batches.id = import_rows.batch_id
      and private.can_access_module(batches.module, 'delete')
      and (
        (
          batches.import_kind <> 'master_data'
          and coalesce(batches.source_file_path, '') not in (
            'v2.public.mou.list', 'legacy_partner_contacts', 'legacy_staff_travel'
          )
        )
        or private.has_role('system_admin')
      )
  )
);

-- No table/function grants or public SELECT policies are changed here.
-- The master commit RPC's System Admin guard is updated in the following
-- stability import migration alongside its atomic commit semantics.
