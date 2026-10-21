begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- All fixtures and permission changes roll back at the end of the test.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  ('a7100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'stability-access-' || n::text || '@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Stability access ' || n::text), now(), now()
from generate_series(1, 6) as users(n);

insert into private.user_roles (user_id, role) values
  ('a7100000-0000-0000-0000-000000000001', 'system_admin'),
  ('a7100000-0000-0000-0000-000000000002', 'office_admin'),
  ('a7100000-0000-0000-0000-000000000003', 'editor'),
  ('a7100000-0000-0000-0000-000000000004', 'viewer'),
  ('a7100000-0000-0000-0000-000000000005', 'system_admin'),
  ('a7100000-0000-0000-0000-000000000006', 'editor');

insert into private.module_permissions (
  user_id, module, can_view, can_create, can_update, can_publish, can_delete, can_import
) values
  ('a7100000-0000-0000-0000-000000000003', 'mobility', true, true, true, false, false, true),
  ('a7100000-0000-0000-0000-000000000003', 'travel', true, true, true, false, false, true),
  ('a7100000-0000-0000-0000-000000000004', 'travel', true, false, false, false, false, false),
  ('a7100000-0000-0000-0000-000000000006', 'mobility', true, true, true, true, true, true);

update public.profiles set active = false
where id in ('a7100000-0000-0000-0000-000000000005', 'a7100000-0000-0000-0000-000000000006');

insert into public.import_batches (
  id, module, import_kind, source_file_name, status, total_rows, valid_rows, created_by
) values
  ('a7200000-0000-0000-0000-000000000001', 'settings', 'master_data', 'master.xlsx', 'ready', 1, 1, 'a7100000-0000-0000-0000-000000000001'),
  ('a7200000-0000-0000-0000-000000000002', 'mobility', 'module_data', 'student.xlsx', 'ready', 1, 1, 'a7100000-0000-0000-0000-000000000003'),
  ('a7200000-0000-0000-0000-000000000003', 'travel', 'module_data', 'travel.xlsx', 'ready', 1, 1, 'a7100000-0000-0000-0000-000000000002'),
  ('a7200000-0000-0000-0000-000000000004', 'mobility', 'module_data', 'revoked.xlsx', 'ready', 1, 1, 'a7100000-0000-0000-0000-000000000003'),
  ('a7200000-0000-0000-0000-000000000005', 'mobility', 'module_data', 'inactive.xlsx', 'ready', 1, 1, 'a7100000-0000-0000-0000-000000000006');

insert into public.import_rows (
  id, batch_id, row_number, status, change_action, review_status, source_data, normalized_data
)
select
  ('a7300000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('a7200000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  1, 'valid', 'skip', 'pending', '{}'::jsonb, '{}'::jsonb
from generate_series(1, 5) as rows(n);

insert into public.import_batches (
  id, module, import_kind, source_file_name, source_file_path, status, total_rows, valid_rows, created_by
) values
  ('a7200000-0000-0000-0000-000000000006', 'mou', 'module_data', 'legacy-mou.json', 'v2.public.mou.list', 'ready', 1, 1, 'a7100000-0000-0000-0000-000000000001'),
  ('a7200000-0000-0000-0000-000000000007', 'mou', 'module_data', 'legacy-contacts.json', 'legacy_partner_contacts', 'ready', 1, 1, 'a7100000-0000-0000-0000-000000000001'),
  ('a7200000-0000-0000-0000-000000000008', 'travel', 'module_data', 'legacy-travel.json', 'legacy_staff_travel', 'ready', 1, 1, 'a7100000-0000-0000-0000-000000000001');
insert into public.import_rows (
  id, batch_id, row_number, status, change_action, review_status, source_data, normalized_data
)
select
  ('a7300000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('a7200000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  1, 'valid', 'skip', 'approved', '{}'::jsonb, '{}'::jsonb
from generate_series(6, 8) as rows(n);

insert into public.movement_cases (
  id, project_name, start_date, end_date, fiscal_year,
  publication_status, public_visible, internal_note, created_by
) values
  ('a7400000-0000-0000-0000-000000000001', 'Stability published movement', '2026-10-21', '2026-10-22', 2570,
   'published', true, 'Private note', 'a7100000-0000-0000-0000-000000000001'),
  ('a7400000-0000-0000-0000-000000000002', 'Stability private movement', '2026-10-21', '2026-10-22', 2570,
   'draft', false, 'Private note', 'a7100000-0000-0000-0000-000000000001');

-- Privileges remain narrow, including private role/permission tables and the
-- existing effective-permissions endpoint (not executable by service_role).
select ok(not has_function_privilege('anon', 'private.is_admin()', 'EXECUTE'), 'anon cannot call admin helper');
select ok(not has_function_privilege('anon', 'private.has_role(public.app_role)', 'EXECUTE'), 'anon cannot call role helper');
select ok(not has_function_privilege('anon', 'private.can_access_module(public.module_key,text)', 'EXECUTE'), 'anon cannot call module helper');
select ok(not has_function_privilege('anon', 'private.can_access_any_module(text)', 'EXECUTE'), 'anon cannot call asset permission helper');
select ok(has_function_privilege('authenticated', 'private.can_access_module(public.module_key,text)', 'EXECUTE'), 'authenticated retains module helper execution');
select ok(not has_function_privilege('service_role', 'public.current_user_access()', 'EXECUTE'), 'effective-user endpoint service-role grant remains revoked');
select ok(not has_table_privilege('authenticated', 'private.user_roles', 'SELECT'), 'role assignments remain private');
select ok(not has_table_privilege('authenticated', 'private.module_permissions', 'SELECT'), 'module assignments remain private');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'active', 'UPDATE'), 'a user cannot reactivate their own account');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000001","role":"authenticated"}';

select ok(private.is_admin(), 'active System Admin retains admin access');
select ok(private.has_role('system_admin'), 'active System Admin has effective role');
select ok(private.can_access_module('settings', 'import'), 'active System Admin can import master data');
select is((select count(*)::integer from public.import_batches where id = 'a7200000-0000-0000-0000-000000000001'), 1, 'System Admin sees master batch');
select results_eq(
  $$ with changed as (update public.import_rows set review_status = 'approved' where id = 'a7300000-0000-0000-0000-000000000001' returning id) select count(*)::bigint from changed $$,
  array[1::bigint], 'System Admin can review a master row'
);
select lives_ok(
  $$ insert into public.import_batches (module, import_kind, source_file_name, created_by) values ('settings', 'master_data', 'allowed-master.xlsx', 'a7100000-0000-0000-0000-000000000001') $$,
  'System Admin can stage a master batch'
);
select ok(not private.can_access_module('settings', 'unknown'), 'unknown permission actions fail closed for admins');
select is((select count(*)::integer from public.import_batches where id in ('a7200000-0000-0000-0000-000000000006', 'a7200000-0000-0000-0000-000000000007', 'a7200000-0000-0000-0000-000000000008')), 3, 'System Admin sees all supported legacy batch kinds');
select lives_ok(
  $$ select public.commit_legacy_mou_import_batch('a7200000-0000-0000-0000-000000000006') $$,
  'System Admin retains authorized legacy MOU import workflow'
);
select lives_ok(
  $$ select public.commit_legacy_contact_import_batch('a7200000-0000-0000-0000-000000000007') $$,
  'System Admin retains authorized legacy contact import workflow'
);
select lives_ok(
  $$ select public.commit_legacy_travel_import_batch('a7200000-0000-0000-0000-000000000008') $$,
  'System Admin retains authorized legacy travel import workflow'
);

set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(private.is_admin(), 'active Office Admin retains general admin rights');
select ok(not private.has_role('system_admin'), 'Office Admin is not a System Admin');
select ok(private.can_access_module('travel', 'import'), 'Office Admin retains module import rights');
select is((select count(*)::integer from public.import_batches where id = 'a7200000-0000-0000-0000-000000000003'), 1, 'Office Admin can see a module batch');
select is((select count(*)::integer from public.import_batches where id = 'a7200000-0000-0000-0000-000000000001'), 0, 'Office Admin cannot see a master batch');
select is((select count(*)::integer from public.import_rows where id = 'a7300000-0000-0000-0000-000000000001'), 0, 'Office Admin cannot see master source data');
select throws_ok(
  $$ insert into public.import_batches (module, import_kind, source_file_name, created_by) values ('settings', 'master_data', 'denied-master.xlsx', 'a7100000-0000-0000-0000-000000000002') $$,
  '42501', 'new row violates row-level security policy for table "import_batches"', 'Office Admin cannot stage a master batch'
);
select results_eq(
  $$ with changed as (update public.import_rows set review_note = 'unauthorized' where id = 'a7300000-0000-0000-0000-000000000001' returning id) select count(*)::bigint from changed $$,
  array[0::bigint], 'Office Admin cannot modify master review state'
);
select throws_ok(
  $$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000001') $$,
  '42501', 'MASTER_IMPORT_FORBIDDEN', 'Office Admin cannot bypass Master Import RLS via the commit RPC'
);
select results_eq(
  $$ with changed as (update public.import_rows set review_status = 'approved' where id = 'a7300000-0000-0000-0000-000000000003' returning id) select count(*)::bigint from changed $$,
  array[1::bigint], 'Office Admin can still review ordinary module imports'
);
select is((select count(*)::integer from public.import_batches where id in ('a7200000-0000-0000-0000-000000000006', 'a7200000-0000-0000-0000-000000000007', 'a7200000-0000-0000-0000-000000000008')), 0, 'Office Admin cannot see System Admin-only legacy staging');
select is((select count(*)::integer from public.import_rows where id in ('a7300000-0000-0000-0000-000000000006', 'a7300000-0000-0000-0000-000000000007', 'a7300000-0000-0000-0000-000000000008')), 0, 'Office Admin cannot read any legacy source rows');
select throws_ok(
  $$ insert into public.import_batches (module, import_kind, source_file_name, source_file_path, created_by) values ('mou', 'module_data', 'legacy-mou.json', 'v2.public.mou.list', 'a7100000-0000-0000-0000-000000000002') $$,
  '42501', 'new row violates row-level security policy for table "import_batches"', 'Office Admin cannot stage legacy MOU data'
);
select throws_ok(
  $$ insert into public.import_batches (module, import_kind, source_file_name, source_file_path, created_by) values ('mou', 'module_data', 'legacy-contacts.json', 'legacy_partner_contacts', 'a7100000-0000-0000-0000-000000000002') $$,
  '42501', 'new row violates row-level security policy for table "import_batches"', 'Office Admin cannot stage legacy contact data'
);
select throws_ok(
  $$ insert into public.import_batches (module, import_kind, source_file_name, source_file_path, created_by) values ('travel', 'module_data', 'legacy-travel.json', 'legacy_staff_travel', 'a7100000-0000-0000-0000-000000000002') $$,
  '42501', 'new row violates row-level security policy for table "import_batches"', 'Office Admin cannot stage legacy travel data'
);
select throws_ok(
  $$ select public.commit_legacy_mou_import_batch('a7200000-0000-0000-0000-000000000006') $$,
  '42501', 'LEGACY_MOU_IMPORT_FORBIDDEN', 'Office Admin cannot bypass legacy MOU route authorization'
);
select throws_ok(
  $$ select public.commit_legacy_contact_import_batch('a7200000-0000-0000-0000-000000000007') $$,
  '42501', 'LEGACY_CONTACT_IMPORT_FORBIDDEN', 'Office Admin cannot bypass legacy contact route authorization'
);
select throws_ok(
  $$ select public.commit_legacy_travel_import_batch('a7200000-0000-0000-0000-000000000008') $$,
  '42501', 'LEGACY_TRAVEL_IMPORT_FORBIDDEN', 'Office Admin cannot bypass legacy travel route authorization'
);

set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000003","role":"authenticated"}';
select ok(not private.is_admin(), 'Editor is not an admin');
select ok(private.has_role('editor'), 'active Editor has effective role');
select ok(private.can_access_module('mobility', 'import'), 'Editor retains explicitly assigned import permission');
select ok(not private.can_access_module('mou', 'update'), 'Editor cannot mutate an unassigned module');
select ok(not private.can_access_module('mobility', 'publish'), 'Editor cannot publish without explicit permission');
select results_eq(
  $$ with changed as (update public.import_rows set review_status = 'approved' where id = 'a7300000-0000-0000-0000-000000000002' returning id) select count(*)::bigint from changed $$,
  array[1::bigint], 'authorized Editor can review a student import'
);
select lives_ok(
  $$ select public.commit_student_mobility_import_batch('a7200000-0000-0000-0000-000000000002') $$,
  'authorized student importer can commit a reviewed skip-only batch'
);

set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000004","role":"authenticated"}';
select ok(private.can_access_module('travel', 'view'), 'Viewer retains explicitly assigned read access');
select ok(not private.can_access_module('travel', 'update'), 'Viewer cannot update');
select ok(not private.can_access_any_module('create'), 'Viewer cannot create assets');
select is((select count(*)::integer from public.import_batches where id = 'a7200000-0000-0000-0000-000000000003'), 0, 'Viewer cannot see import staging');
select throws_ok(
  $$ select public.commit_student_mobility_import_batch('a7200000-0000-0000-0000-000000000004') $$,
  '42501', 'STUDENT_MOBILITY_IMPORT_FORBIDDEN', 'Viewer cannot execute an import commit'
);

-- A still-valid JWT must not retain access after the profile is deactivated.
set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000005","role":"authenticated"}';
select ok(not private.is_admin(), 'inactive System Admin loses admin rights');
select ok(not private.has_role('system_admin'), 'inactive System Admin loses effective role');
select ok(not private.can_access_module('settings', 'import'), 'inactive System Admin loses master import permission');
select ok(not private.can_access_any_module('update'), 'inactive System Admin loses generic asset mutation rights');
select is(public.current_user_access() -> 'roles', '[]'::jsonb, 'inactive access context exposes no effective roles');
select is((public.current_user_access() #>> '{profile,active}')::boolean, false, 'own inactive profile remains readable for the application gate');
select is((public.current_user_access() #>> '{modules,travel,view}')::boolean, false, 'inactive access context exposes no internal module permission');
select throws_ok(
  $$ select public.admin_user_directory() $$, '42501', 'Only a system administrator can view user access.',
  'inactive System Admin cannot use the user directory RPC'
);
select throws_ok(
  $$ select public.admin_set_user_access('a7100000-0000-0000-0000-000000000004', 'system_admin', true, '{}'::jsonb) $$,
  '42501', 'Only a system administrator can change user access.', 'inactive System Admin cannot grant access'
);
select throws_ok(
  $$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000001') $$,
  '42501', 'MASTER_IMPORT_FORBIDDEN', 'inactive System Admin cannot commit master data'
);
select throws_ok(
  $$ select public.commit_legacy_mou_import_batch('a7200000-0000-0000-0000-000000000003') $$,
  '42501', 'LEGACY_MOU_IMPORT_FORBIDDEN', 'inactive admin cannot use legacy MOU import shortcut'
);
select throws_ok(
  $$ select public.commit_legacy_contact_import_batch('a7200000-0000-0000-0000-000000000003') $$,
  '42501', 'LEGACY_CONTACT_IMPORT_FORBIDDEN', 'inactive admin cannot use legacy contact import shortcut'
);
select throws_ok(
  $$ select public.commit_legacy_travel_import_batch('a7200000-0000-0000-0000-000000000003') $$,
  '42501', 'LEGACY_TRAVEL_IMPORT_FORBIDDEN', 'inactive admin cannot use legacy travel import shortcut'
);

set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000006","role":"authenticated"}';
select ok(not private.has_role('editor'), 'inactive Editor loses effective role');
select ok(not private.can_access_module('mobility', 'import'), 'inactive Editor loses explicit import permission');
select ok(not private.can_access_any_module('create'), 'inactive Editor loses explicit asset create permission');
select is((select count(*)::integer from public.import_batches where id = 'a7200000-0000-0000-0000-000000000005'), 0, 'inactive creator cannot read their old batch');
select is((select count(*)::integer from public.import_rows where id = 'a7300000-0000-0000-0000-000000000005'), 0, 'inactive creator cannot read their old staging row');
select throws_ok(
  $$ insert into public.import_rows (batch_id, row_number, source_data) values ('a7200000-0000-0000-0000-000000000005', 2, '{}') $$,
  '42501', 'new row violates row-level security policy for table "import_rows"', 'inactive creator cannot add staging rows'
);
select results_eq(
  $$ with changed as (update public.import_rows set review_status = 'approved' where id = 'a7300000-0000-0000-0000-000000000005' returning id) select count(*)::bigint from changed $$,
  array[0::bigint], 'inactive creator cannot review staging rows'
);
select throws_ok(
  $$ select public.commit_student_mobility_import_batch('a7200000-0000-0000-0000-000000000005') $$,
  '42501', 'STUDENT_MOBILITY_IMPORT_FORBIDDEN', 'inactive creator cannot commit their batch'
);

-- Revoke permission without deactivating the user or replacing the JWT.
reset role;
update private.module_permissions set can_import = false
where user_id = 'a7100000-0000-0000-0000-000000000003' and module = 'mobility';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000003","role":"authenticated"}';
select ok(private.can_access_module('mobility', 'view'), 'revoking import does not remove unrelated module read access');
select ok(not private.can_access_module('mobility', 'import'), 'revoked import permission takes effect immediately');
select is((select count(*)::integer from public.import_batches where id = 'a7200000-0000-0000-0000-000000000004'), 0, 'revoked creator cannot read the old batch');
select is((select count(*)::integer from public.import_rows where id = 'a7300000-0000-0000-0000-000000000004'), 0, 'revoked creator cannot read source rows');
select throws_ok(
  $$ insert into public.import_rows (batch_id, row_number, source_data) values ('a7200000-0000-0000-0000-000000000004', 2, '{}') $$,
  '42501', 'new row violates row-level security policy for table "import_rows"', 'revoked creator cannot add staging rows'
);
select results_eq(
  $$ with changed as (update public.import_rows set review_status = 'approved' where id = 'a7300000-0000-0000-0000-000000000004' returning id) select count(*)::bigint from changed $$,
  array[0::bigint], 'revoked creator cannot review staging rows'
);
select results_eq(
  $$ with changed as (update public.import_batches set status = 'cancelled' where id = 'a7200000-0000-0000-0000-000000000004' returning id) select count(*)::bigint from changed $$,
  array[0::bigint], 'revoked creator cannot modify batch status'
);
select throws_ok(
  $$ select public.commit_student_mobility_import_batch('a7200000-0000-0000-0000-000000000004') $$,
  '42501', 'STUDENT_MOBILITY_IMPORT_FORBIDDEN', 'revoked creator cannot commit their old batch'
);

-- No identity and inactive identities retain only existing public reads.
set local "request.jwt.claims" = '{"role":"authenticated"}';
select ok(not private.is_admin(), 'a claim without a user ID has no admin access');
select ok(not private.can_access_module('travel', 'view'), 'a claim without a user ID has no internal module access');
select ok(not private.can_access_any_module('update'), 'a claim without a user ID has no asset mutation access');
set local "request.jwt.claims" = '{"sub":"a7100000-0000-0000-0000-000000000005","role":"authenticated"}';
select is((select count(*)::integer from public.movement_cases where id in ('a7400000-0000-0000-0000-000000000001', 'a7400000-0000-0000-0000-000000000002')), 1, 'inactive user sees published movement but not internal draft');

reset role;
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select is((select count(*)::integer from public.movements_public where id in ('a7400000-0000-0000-0000-000000000001', 'a7400000-0000-0000-0000-000000000002')), 1, 'anonymous public movement read semantics remain unchanged');
select ok(not has_column_privilege('anon', 'public.movement_cases', 'internal_note', 'SELECT'), 'anonymous internal-note privilege remains absent');
select ok(not has_table_privilege('anon', 'public.import_rows', 'SELECT'), 'anonymous staging read privilege remains absent');
select ok(not has_function_privilege('anon', 'public.commit_master_import_batch(uuid)', 'EXECUTE'), 'anonymous master commit grant remains absent');
select throws_ok(
  $$ select public.commit_master_import_batch('a7200000-0000-0000-0000-000000000001') $$,
  '42501', 'permission denied for function commit_master_import_batch', 'anonymous master commit fails before its body'
);

reset role;
select * from finish();
rollback;
