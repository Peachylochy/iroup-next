begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- 1. Check functions exist
select has_function('public', 'mou_attach_file', 'mou_attach_file RPC exists');
select has_function('public', 'mou_detach_file', 'mou_detach_file RPC exists');

-- 2. Check storage bucket setup
select is(
  (select public from storage.buckets where id = 'mou-attachments'),
  false,
  'mou-attachments bucket exists and is private'
);

-- Setup test users
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
(
  'e1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mou-attach-viewer@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
),
(
  'e1000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mou-attach-editor@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

-- Viewer role & permission
insert into private.user_roles (user_id, role) values
('e1000000-0000-0000-0000-000000000001', 'viewer');

insert into private.module_permissions (user_id, module, can_view, can_create, can_update, can_publish, can_delete) values
('e1000000-0000-0000-0000-000000000001', 'mou', true, false, false, false, false);

-- Editor role & permission
insert into private.user_roles (user_id, role) values
('e1000000-0000-0000-0000-000000000002', 'editor');

insert into private.module_permissions (user_id, module, can_view, can_create, can_update, can_publish, can_delete) values
('e1000000-0000-0000-0000-000000000002', 'mou', true, true, true, false, false);

-- Setup test agreement
insert into public.agreements (
  id, title_th, agreement_type, start_date, fiscal_year, created_by
) values (
  'e2000000-0000-0000-0000-000000000001',
  'MOU สำหรับทดสอบไฟล์แนบ', 'MOU', '2026-01-01', 2569, 'e1000000-0000-0000-0000-000000000002'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
(
  'mou-attachments',
  'agreements/e2000000-0000-0000-0000-000000000001/signed.pdf',
  'e1000000-0000-0000-0000-000000000002',
  '{"mimetype":"application/pdf","size":102400}'::jsonb
),
(
  'mou-attachments',
  'agreements/e2000000-0000-0000-0000-000000000001/viewer-owned.pdf',
  'e1000000-0000-0000-0000-000000000001',
  '{"mimetype":"application/pdf","size":2048}'::jsonb
);

-- 3. Test anonymous cannot attach file
set local role anon;
select throws_ok(
  $$ select public.mou_attach_file('e2000000-0000-0000-0000-000000000001'::uuid, 'path/test.pdf', 'test.pdf') $$,
  '42501',
  null,
  'Anon cannot execute mou_attach_file'
);

-- 4. Test Viewer cannot attach file
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.mou_attach_file('e2000000-0000-0000-0000-000000000001'::uuid, 'path/test.pdf', 'test.pdf') $$,
  '42501',
  null,
  'Viewer cannot execute mou_attach_file'
);

-- 5. Test Editor can attach file
set local "request.jwt.claims" =
  '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ select public.mou_attach_file('e2000000-0000-0000-0000-000000000001'::uuid, 'agreements/e2000000-0000-0000-0000-000000000001/signed.pdf', 'signed.pdf', 'application/pdf', 102400) $$,
  'Editor can execute mou_attach_file'
);

-- 6. Check attached asset is private and linked
select is(
  (
    select a.is_public
    from public.record_assets ra
    join public.assets a on a.id = ra.asset_id
    where ra.agreement_id = 'e2000000-0000-0000-0000-000000000001'
  ),
  false,
  'Attached file asset is marked as private (is_public = false)'
);

-- 7. A viewer can read only a file that has been linked to an MOU.
set local "request.jwt.claims" =
  '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'mou-attachments'
  ),
  1,
  'Viewer can read only the linked MOU attachment'
);

-- 8. An editor cannot claim a storage object uploaded by another user.
set local "request.jwt.claims" =
  '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ select public.mou_attach_file('e2000000-0000-0000-0000-000000000001'::uuid, 'agreements/e2000000-0000-0000-0000-000000000001/viewer-owned.pdf', 'viewer-owned.pdf') $$,
  'P0002',
  null,
  'Editor cannot attach an object owned by another user'
);

-- 9. The RPC rejects a path that is not scoped to the target agreement.
select throws_ok(
  $$ select public.mou_attach_file('e2000000-0000-0000-0000-000000000001'::uuid, 'agreements/not-the-target/file.pdf', 'file.pdf') $$,
  '22023',
  null,
  'Attachment path must be scoped to the target MOU'
);

-- 10. Test Editor can detach file.
select lives_ok(
  $$
    select public.mou_detach_file(
      'e2000000-0000-0000-0000-000000000001'::uuid,
      (select asset_id from public.record_assets where agreement_id = 'e2000000-0000-0000-0000-000000000001' limit 1)
    )
  $$,
  'Editor can execute mou_detach_file'
);

rollback;
