begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  ('a8100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'stability-assets-' || n::text || '@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Stability assets ' || n::text), now(), now()
from generate_series(1, 3) as fixtures(n);

insert into private.user_roles (user_id, role)
select ('a8100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'editor'
from generate_series(1, 3) as fixtures(n);

insert into private.module_permissions (
  user_id, module, can_view, can_create, can_update, can_delete
) values
  ('a8100000-0000-0000-0000-000000000001', 'mou', true, false, false, false),
  ('a8100000-0000-0000-0000-000000000001', 'travel', true, true, true, true),
  ('a8100000-0000-0000-0000-000000000002', 'mou', true, true, true, false),
  ('a8100000-0000-0000-0000-000000000003', 'travel', true, true, true, true);

insert into public.agreements (id, title_th, agreement_type, start_date, fiscal_year, created_by)
values ('a8200000-0000-0000-0000-000000000001', 'Private attachment boundary', 'MOU', '2026-10-21', 2570, 'a8100000-0000-0000-0000-000000000002');
insert into public.movement_cases (id, project_name, start_date, end_date, fiscal_year, created_by)
values ('a8300000-0000-0000-0000-000000000001', 'Travel link boundary', '2026-10-21', '2026-10-22', 2570, 'a8100000-0000-0000-0000-000000000001');

insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('mou-attachments', 'agreements/a8200000-0000-0000-0000-000000000001/existing.pdf', 'a8100000-0000-0000-0000-000000000002', '{"mimetype":"application/pdf","size":1000}'),
  ('mou-attachments', 'agreements/a8200000-0000-0000-0000-000000000001/new.pdf', 'a8100000-0000-0000-0000-000000000002', '{"mimetype":"application/pdf","size":2000}');

insert into public.assets (id, storage_bucket, storage_path, original_file_name, mime_type, size_bytes, is_public, created_by)
values ('a8400000-0000-0000-0000-000000000001', 'mou-attachments', 'agreements/a8200000-0000-0000-0000-000000000001/existing.pdf', 'existing.pdf', 'application/pdf', 1000, false, 'a8100000-0000-0000-0000-000000000002');
insert into public.record_assets (id, asset_id, agreement_id, created_by)
values ('a8500000-0000-0000-0000-000000000001', 'a8400000-0000-0000-0000-000000000001', 'a8200000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000002');

select ok(not has_table_privilege('authenticated', 'public.assets', 'INSERT,UPDATE,DELETE'), 'authenticated has no direct asset mutations');
select ok(not has_table_privilege('authenticated', 'public.record_assets', 'INSERT,UPDATE,DELETE'), 'authenticated has no direct asset-link mutations');
select ok(not has_any_column_privilege('authenticated', 'public.assets', 'INSERT,UPDATE'), 'asset column-level grants cannot bypass the write boundary');
select ok(not has_any_column_privilege('authenticated', 'public.record_assets', 'INSERT,UPDATE'), 'link column-level grants cannot bypass the write boundary');
select ok(has_table_privilege('authenticated', 'public.assets', 'SELECT'), 'authenticated asset SELECT grant is preserved');
select ok(has_table_privilege('authenticated', 'public.record_assets', 'SELECT'), 'authenticated asset-link SELECT grant is preserved');
select ok(has_table_privilege('service_role', 'public.assets', 'INSERT') and has_table_privilege('service_role', 'public.assets', 'UPDATE') and has_table_privilege('service_role', 'public.assets', 'DELETE'), 'service_role asset grants are preserved');
select ok(has_table_privilege('service_role', 'public.record_assets', 'INSERT') and has_table_privilege('service_role', 'public.record_assets', 'UPDATE') and has_table_privilege('service_role', 'public.record_assets', 'DELETE'), 'service_role link grants are preserved');
select ok(has_function_privilege('authenticated', 'public.mou_attach_file(uuid,text,text,text,bigint,uuid)', 'EXECUTE'), 'authenticated retains guarded attach RPC execution');
select ok(has_function_privilege('authenticated', 'public.mou_detach_file(uuid,uuid)', 'EXECUTE'), 'authenticated retains guarded detach RPC execution');
select ok(not has_function_privilege('anon', 'public.mou_attach_file(uuid,text,text,text,bigint,uuid)', 'EXECUTE'), 'anonymous attach grant remains absent');
select ok(not has_function_privilege('anon', 'public.mou_detach_file(uuid,uuid)', 'EXECUTE'), 'anonymous detach grant remains absent');

-- This caller could previously mutate MOU assets using their Travel rights.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a8100000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(private.can_access_module('mou', 'view') and private.can_access_module('travel', 'update'), 'cross-module test caller has MOU view and Travel edit rights');
select is((select count(*)::integer from public.assets where id = 'a8400000-0000-0000-0000-000000000001'), 1, 'MOU viewer can still read the authorized asset metadata');
select throws_ok(
  $$ insert into public.assets (storage_bucket, storage_path, original_file_name, created_by) values ('mou-attachments', 'injected.pdf', 'injected.pdf', 'a8100000-0000-0000-0000-000000000001') $$,
  '42501', 'permission denied for table assets', 'Travel editor cannot directly insert asset metadata'
);
select throws_ok(
  $$ update public.assets set is_public = true where id = 'a8400000-0000-0000-0000-000000000001' $$,
  '42501', 'permission denied for table assets', 'Travel editor cannot publish an MOU asset by direct update'
);
select throws_ok(
  $$ delete from public.assets where id = 'a8400000-0000-0000-0000-000000000001' $$,
  '42501', 'permission denied for table assets', 'Travel editor cannot delete an MOU asset and its links'
);
select throws_ok(
  $$ insert into public.record_assets (asset_id, movement_id, created_by) values ('a8400000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000001') $$,
  '42501', 'permission denied for table record_assets', 'Travel editor cannot reuse an MOU asset UUID in another module'
);
select throws_ok(
  $$ update public.record_assets set agreement_id = null, movement_id = 'a8300000-0000-0000-0000-000000000001' where id = 'a8500000-0000-0000-0000-000000000001' $$,
  '42501', 'permission denied for table record_assets', 'Travel editor cannot move an MOU asset link'
);
select throws_ok(
  $$ delete from public.record_assets where id = 'a8500000-0000-0000-0000-000000000001' $$,
  '42501', 'permission denied for table record_assets', 'Travel editor cannot delete an MOU asset link'
);
select throws_ok(
  $$ select public.mou_attach_file('a8200000-0000-0000-0000-000000000001', 'agreements/a8200000-0000-0000-0000-000000000001/new.pdf', 'new.pdf') $$,
  '42501', 'MOU_FORBIDDEN', 'MOU viewer cannot use the attach RPC with Travel permissions'
);
select throws_ok(
  $$ select public.mou_detach_file('a8200000-0000-0000-0000-000000000001', 'a8400000-0000-0000-0000-000000000001') $$,
  '42501', 'MOU_FORBIDDEN', 'MOU viewer cannot use the detach RPC with Travel permissions'
);
select is((select is_public from public.assets where id = 'a8400000-0000-0000-0000-000000000001'), false, 'denied writes leave existing metadata private');

-- A caller without MOU read permission cannot use a known UUID to gain it.
set local "request.jwt.claims" = '{"sub":"a8100000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.assets where id = 'a8400000-0000-0000-0000-000000000001'), 0, 'Travel-only editor cannot read MOU asset metadata');
select throws_ok(
  $$ insert into public.record_assets (asset_id, movement_id, created_by) values ('a8400000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000001', 'a8100000-0000-0000-0000-000000000003') $$,
  '42501', 'permission denied for table record_assets', 'a known asset UUID cannot create cross-module read access'
);
select is((select count(*)::integer from storage.objects where bucket_id = 'mou-attachments' and name = 'agreements/a8200000-0000-0000-0000-000000000001/existing.pdf'), 0, 'Travel-only editor cannot read private MOU storage object');

-- The existing authorized workflow uses its scoped SECURITY DEFINER boundary.
set local "request.jwt.claims" = '{"sub":"a8100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.mou_attach_file('a8200000-0000-0000-0000-000000000001', 'agreements/a8200000-0000-0000-0000-000000000001/new.pdf', 'new.pdf', 'application/pdf', 2000) $$,
  'MOU editor can attach an owned upload after direct grants are revoked'
);
select is((select count(*)::integer from public.record_assets where agreement_id = 'a8200000-0000-0000-0000-000000000001'), 2, 'attach RPC creates the authorized link');
select is((select is_public from public.assets where storage_path = 'agreements/a8200000-0000-0000-0000-000000000001/new.pdf'), false, 'new attachment metadata stays private');
select is((select count(*)::integer from storage.objects where bucket_id = 'mou-attachments' and name = 'agreements/a8200000-0000-0000-0000-000000000001/new.pdf'), 1, 'MOU editor retains access to the linked private object');
select lives_ok(
  $$ select public.mou_detach_file('a8200000-0000-0000-0000-000000000001', (select id from public.assets where storage_path = 'agreements/a8200000-0000-0000-0000-000000000001/new.pdf')) $$,
  'MOU editor can detach through the guarded RPC after direct grants are revoked'
);
select is((select count(*)::integer from public.record_assets where agreement_id = 'a8200000-0000-0000-0000-000000000001'), 1, 'detach removes only the requested link');
select is((select count(*)::integer from public.assets where storage_path = 'agreements/a8200000-0000-0000-0000-000000000001/new.pdf'), 0, 'detach removes unshared metadata');

reset role;
select is((select count(*)::integer from storage.objects where bucket_id = 'mou-attachments' and name = 'agreements/a8200000-0000-0000-0000-000000000001/new.pdf'), 1, 'detach preserves physical private object under the existing retention policy');
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select ok(has_column_privilege('anon', 'public.assets', 'original_file_name', 'SELECT'), 'public-safe asset column grant remains unchanged');
select is((select count(*)::integer from public.assets where id = 'a8400000-0000-0000-0000-000000000001'), 0, 'anonymous reader cannot see private MOU asset metadata');
select is((select count(*)::integer from public.record_assets where id = 'a8500000-0000-0000-0000-000000000001'), 0, 'anonymous reader cannot see private MOU attachment link');

reset role;
select * from finish();
rollback;
