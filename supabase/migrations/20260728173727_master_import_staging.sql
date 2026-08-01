-- Master imports contain internal person data. Reuse the existing generic
-- staging tables, but label and isolate these batches from module imports.
create type public.import_kind as enum ('module_data', 'master_data');

create type public.master_entity_type as enum (
  'country',
  'organization_unit',
  'student',
  'staff',
  'partner_organization'
);

create type public.import_change_action as enum ('insert', 'update', 'skip');

alter table public.import_batches
  add column import_kind public.import_kind not null default 'module_data';

alter table public.import_rows
  add column master_entity public.master_entity_type,
  add column source_key text,
  add column change_action public.import_change_action;

create index import_batches_kind_created_idx
  on public.import_batches (import_kind, created_at desc);

create index import_rows_master_entity_status_idx
  on public.import_rows (batch_id, master_entity, status, row_number);

-- Generic module imports preserve the existing module-permission rules.
-- Master batches additionally require System Admin at every access point.
drop policy import_batches_internal_select on public.import_batches;
create policy import_batches_internal_select
on public.import_batches for select
to authenticated
using (
  (created_by = (select auth.uid()) or private.can_access_module(module, 'import'))
  and (import_kind <> 'master_data' or private.is_admin())
);

drop policy import_batches_internal_insert on public.import_batches;
create policy import_batches_internal_insert
on public.import_batches for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_access_module(module, 'import')
  and (import_kind <> 'master_data' or private.is_admin())
);

drop policy import_batches_internal_update on public.import_batches;
create policy import_batches_internal_update
on public.import_batches for update
to authenticated
using (
  private.can_access_module(module, 'import')
  and (import_kind <> 'master_data' or private.is_admin())
)
with check (
  private.can_access_module(module, 'import')
  and (import_kind <> 'master_data' or private.is_admin())
);

drop policy import_batches_internal_delete on public.import_batches;
create policy import_batches_internal_delete
on public.import_batches for delete
to authenticated
using (
  private.can_access_module(module, 'delete')
  and (import_kind <> 'master_data' or private.is_admin())
);

drop policy import_rows_internal_select on public.import_rows;
create policy import_rows_internal_select
on public.import_rows for select
to authenticated
using (
  exists (
    select 1 from public.import_batches
    where import_batches.id = import_rows.batch_id
      and (import_batches.import_kind <> 'master_data' or private.is_admin())
  )
);

drop policy import_rows_internal_insert on public.import_rows;
create policy import_rows_internal_insert
on public.import_rows for insert
to authenticated
with check (
  exists (
    select 1 from public.import_batches
    where import_batches.id = import_rows.batch_id
      and (import_batches.import_kind <> 'master_data' or private.is_admin())
  )
);

drop policy import_rows_internal_update on public.import_rows;
create policy import_rows_internal_update
on public.import_rows for update
to authenticated
using (
  exists (
    select 1 from public.import_batches
    where import_batches.id = import_rows.batch_id
      and (import_batches.import_kind <> 'master_data' or private.is_admin())
  )
)
with check (
  exists (
    select 1 from public.import_batches
    where import_batches.id = import_rows.batch_id
      and (import_batches.import_kind <> 'master_data' or private.is_admin())
  )
);

drop policy import_rows_internal_delete on public.import_rows;
create policy import_rows_internal_delete
on public.import_rows for delete
to authenticated
using (
  exists (
    select 1 from public.import_batches
    where import_batches.id = import_rows.batch_id
      and private.can_access_module(import_batches.module, 'delete')
      and (import_batches.import_kind <> 'master_data' or private.is_admin())
  )
);
