begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('b8100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review-boundary-admin@example.test', '', now(), '{}', '{"full_name":"Review Admin"}', now(), now()),
  ('b8100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'review-boundary-editor@example.test', '', now(), '{}', '{"full_name":"Review Editor"}', now(), now());
insert into private.user_roles (user_id, role) values
  ('b8100000-0000-0000-0000-000000000001', 'system_admin'),
  ('b8100000-0000-0000-0000-000000000002', 'editor');
insert into private.module_permissions (user_id, module, can_view, can_create, can_update, can_delete, can_import)
values ('b8100000-0000-0000-0000-000000000002', 'mobility', true, true, true, true, true);

create temporary table review_boundary_snapshots (name text primary key, value jsonb);
grant select, insert on review_boundary_snapshots to authenticated;
create function pg_temp.review_boundary_snapshot(batch_uuid uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'batch', (select to_jsonb(b) from public.import_batches b where id = batch_uuid),
    'rows', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.import_rows r where batch_id = batch_uuid),
    'units', (select coalesce(jsonb_agg(to_jsonb(u) order by id), '[]'::jsonb) from public.organization_units u where id in (select target_record_id from public.import_rows where batch_id = batch_uuid)),
    'movements', (select coalesce(jsonb_agg(to_jsonb(m) order by id), '[]'::jsonb) from public.movement_cases m where id in (select target_record_id from public.import_rows where batch_id = batch_uuid))
  );
$$;

select ok(not has_function_privilege('authenticated', 'private.guard_import_batch_direct_write()', 'EXECUTE'),
  'batch trigger helper is not an exposed callable capability');
select ok(not has_function_privilege('authenticated', 'private.guard_import_row_direct_write()', 'EXECUTE'),
  'row trigger helper is not an exposed callable capability');
select ok(not (select prosecdef from pg_proc where oid = 'private.guard_import_row_direct_write()'::regprocedure),
  'row trigger checks the actual invoking database role');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b8100000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.import_batches (id, module, import_kind, source_file_name, status, total_rows, created_by) values
  ('b8200000-0000-0000-0000-000000000001', 'settings', 'master_data', 'review-master.xlsx', 'validating', 1, auth.uid()),
  ('b8200000-0000-0000-0000-000000000002', 'mobility', 'module_data', 'review-student.xlsx', 'validating', 1, auth.uid()),
  ('b8200000-0000-0000-0000-000000000003', 'mobility', 'module_data', 'cleanup.xlsx', 'validating', 1, auth.uid()),
  ('b8200000-0000-0000-0000-000000000004', 'mobility', 'module_data', 'failed.xlsx', 'failed', 0, auth.uid()),
  ('b8200000-0000-0000-0000-000000000005', 'mobility', 'module_data', 'cancelled.xlsx', 'cancelled', 0, auth.uid());

insert into public.import_rows (
  id, batch_id, row_number, status, master_entity, review_status,
  change_action, source_data, normalized_data
) values
  ('b8300000-0000-0000-0000-000000000001', 'b8200000-0000-0000-0000-000000000001', 1, 'valid', 'organization_unit', 'pending', 'insert', '{"original":"master source"}', '{"code":"REVIEW-BOUNDARY-UNIT", "name_th":"Review boundary unit"}'),
  ('b8300000-0000-0000-0000-000000000002', 'b8200000-0000-0000-0000-000000000002', 1, 'valid', null, 'pending', 'insert', '{"original":"mobility source"}', '{"legacyId":"REVIEW-BOUNDARY-MOBILITY", "projectName":"Review boundary mobility", "direction":"outbound", "startDate":"2026-10-21", "endDate":"2026-10-22", "fiscalYear":2570, "participants":[]}'),
  ('b8300000-0000-0000-0000-000000000003', 'b8200000-0000-0000-0000-000000000003', 1, 'valid', null, 'pending', 'insert', '{}', '{}');

select lives_ok($$
  update public.import_batches set status = 'ready'
  where id in ('b8200000-0000-0000-0000-000000000001', 'b8200000-0000-0000-0000-000000000002')
$$, 'normal staging can finish validation and become ready');
select lives_ok($$
  update public.import_rows set review_status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = 'b8300000-0000-0000-0000-000000000001'
$$, 'System Admin can review a ready master row');

select throws_ok($$ update public.import_rows set status = 'imported' where id = 'b8300000-0000-0000-0000-000000000001' $$,
  '42501', 'IMPORT_COMMIT_FIELDS_FORBIDDEN', 'review cannot forge imported row status');
select throws_ok($$ update public.import_rows set target_record_id = 'b8900000-0000-0000-0000-000000000001' where id = 'b8300000-0000-0000-0000-000000000001' $$,
  '42501', 'IMPORT_COMMIT_FIELDS_FORBIDDEN', 'review cannot forge a canonical target id');
select throws_ok($$ update public.import_batches set committed_at = now() where id = 'b8200000-0000-0000-0000-000000000001' $$,
  '42501', 'IMPORT_COMMIT_FIELDS_FORBIDDEN', 'review cannot forge commit time');
select throws_ok($$ update public.import_batches set status = 'completed' where id = 'b8200000-0000-0000-0000-000000000001' $$,
  '42501', 'IMPORT_COMMIT_FIELDS_FORBIDDEN', 'review cannot forge completed status');
select throws_ok($$ update public.import_batches set status = 'importing' where id = 'b8200000-0000-0000-0000-000000000001' $$,
  '42501', 'IMPORT_COMMIT_FIELDS_FORBIDDEN', 'only commit RPC can begin importing');
select throws_ok($$ insert into public.import_rows (batch_id, row_number, status, source_data) values ('b8200000-0000-0000-0000-000000000001', 2, 'imported', '{}') $$,
  '42501', 'IMPORT_COMMIT_FIELDS_FORBIDDEN', 'new staging rows cannot start already imported');
select throws_ok($$ insert into public.import_batches (module, import_kind, source_file_name, status, created_by) values ('settings', 'master_data', 'forged.xlsx', 'completed', auth.uid()) $$,
  '42501', 'IMPORT_COMMIT_FIELDS_FORBIDDEN', 'new batches cannot forge completion');
select throws_ok($$ update public.import_rows set batch_id = 'b8200000-0000-0000-0000-000000000002' where id = 'b8300000-0000-0000-0000-000000000001' $$,
  '42501', 'IMPORT_ROW_IDENTITY_IMMUTABLE', 'staging row provenance cannot be moved to another batch');
select throws_ok($$ update public.import_batches set import_kind = 'module_data' where id = 'b8200000-0000-0000-0000-000000000001' $$,
  '42501', 'IMPORT_BATCH_IDENTITY_IMMUTABLE', 'batch kind cannot be changed to bypass its workflow');

select lives_ok($$ delete from public.import_rows where id = 'b8300000-0000-0000-0000-000000000003' $$,
  'authorized cleanup of an uncommitted row is allowed');
insert into public.import_rows (batch_id, row_number, source_data)
values ('b8200000-0000-0000-0000-000000000003', 1, '{}');
select lives_ok($$ delete from public.import_batches where id = 'b8200000-0000-0000-0000-000000000003' $$,
  'failed staging cleanup can delete an editable batch with cascading rows');
select is((select count(*)::integer from public.import_rows where batch_id = 'b8200000-0000-0000-0000-000000000003'), 0,
  'editable batch cleanup leaves no staging children');

select lives_ok($$ select public.commit_master_import_batch('b8200000-0000-0000-0000-000000000001') $$,
  'guarded master commit can write imported rows and completion markers');
select ok((select status = 'completed' and committed_at is not null from public.import_batches where id = 'b8200000-0000-0000-0000-000000000001'),
  'master batch has real commit markers');
select ok((select status = 'imported' and target_record_id is not null from public.import_rows where id = 'b8300000-0000-0000-0000-000000000001'),
  'master row has the actual canonical target');
insert into review_boundary_snapshots values ('master', pg_temp.review_boundary_snapshot('b8200000-0000-0000-0000-000000000001'));

-- Reproduce the final DML of a PATCH whose earlier ready check became stale.
select throws_ok($$ update public.import_rows set review_status = 'skipped', change_action = 'skip' where id = 'b8300000-0000-0000-0000-000000000001' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'stale master PATCH cannot skip a row after actual commit');
select throws_ok($$ update public.import_rows set source_data = '{}' where id = 'b8300000-0000-0000-0000-000000000001' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'committed source evidence is immutable');
select throws_ok($$ insert into public.import_rows (batch_id, row_number, source_data) values ('b8200000-0000-0000-0000-000000000001', 2, '{}') $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'cannot append a row after master commit');
select throws_ok($$ delete from public.import_rows where id = 'b8300000-0000-0000-0000-000000000001' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'cannot erase committed master provenance');
select throws_ok($$ update public.import_batches set status = 'ready', committed_at = null where id = 'b8200000-0000-0000-0000-000000000001' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'cannot reopen a completed batch');
select throws_ok($$ delete from public.import_batches where id = 'b8200000-0000-0000-0000-000000000001' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'cannot erase a completed batch and its provenance');
select is(pg_temp.review_boundary_snapshot('b8200000-0000-0000-0000-000000000001'),
  (select value from review_boundary_snapshots where name = 'master'),
  'failed post-commit mutations preserve exact master batch, rows and target snapshot');

select throws_ok($$ update public.import_batches set status = 'ready' where id = 'b8200000-0000-0000-0000-000000000004' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'failed batches cannot be reopened by direct DML');
select throws_ok($$ insert into public.import_rows (batch_id, row_number, source_data) values ('b8200000-0000-0000-0000-000000000004', 1, '{}') $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'cannot append rows to failed batches');
select throws_ok($$ update public.import_batches set status = 'ready' where id = 'b8200000-0000-0000-0000-000000000005' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'cancelled batches cannot be reopened by direct DML');

set local "request.jwt.claims" = '{"sub":"b8100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$ update public.import_rows set review_status = 'approved', reviewed_at = now(), reviewed_by = auth.uid() where id = 'b8300000-0000-0000-0000-000000000002' $$,
  'module importer can review their accessible ready mobility row');
select lives_ok($$ select public.commit_student_mobility_import_batch('b8200000-0000-0000-0000-000000000002') $$,
  'guarded mobility commit still succeeds for a module importer');
select ok((select status = 'imported' and target_record_id is not null from public.import_rows where id = 'b8300000-0000-0000-0000-000000000002'),
  'mobility commit writes the canonical target');
insert into review_boundary_snapshots values ('mobility', pg_temp.review_boundary_snapshot('b8200000-0000-0000-0000-000000000002'));
select throws_ok($$ update public.import_rows set review_status = 'skipped', change_action = 'skip' where id = 'b8300000-0000-0000-0000-000000000002' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'stale mobility PATCH cannot skip a row after actual commit');
select throws_ok($$ insert into public.import_rows (batch_id, row_number, source_data) values ('b8200000-0000-0000-0000-000000000002', 2, '{}') $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'cannot append rows after mobility commit');
select throws_ok($$ delete from public.import_rows where id = 'b8300000-0000-0000-0000-000000000002' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'cannot delete committed mobility provenance');
select throws_ok($$ update public.import_batches set status = 'ready', committed_at = null where id = 'b8200000-0000-0000-0000-000000000002' $$,
  '55000', 'IMPORT_BATCH_NOT_EDITABLE', 'module importers cannot reopen completed mobility batches');
select is(pg_temp.review_boundary_snapshot('b8200000-0000-0000-0000-000000000002'),
  (select value from review_boundary_snapshots where name = 'mobility'),
  'failed post-commit mutations preserve exact mobility batch, rows and target snapshot');

select throws_ok($$ insert into public.import_rows (batch_id, row_number, source_data) values ('b8200000-0000-0000-0000-000000000001', 2, '{}') $$,
  '42501', 'new row violates row-level security policy for table "import_rows"',
  'inaccessible master batches retain the existing RLS denial');
select is((select count(*)::integer from public.import_batches where id = 'b8200000-0000-0000-0000-000000000001'), 0,
  'new boundary does not expose master batches to module-only importers');

reset role;
select * from finish();
rollback;
