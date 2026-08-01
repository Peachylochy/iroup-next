begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

select has_function(
  'public',
  'commit_student_mobility_import_batch',
  array['uuid'],
  'student mobility import commit RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.commit_student_mobility_import_batch(uuid)', 'EXECUTE'),
  'anonymous users cannot commit mobility imports'
);
select ok(
  has_function_privilege('authenticated', 'public.commit_student_mobility_import_batch(uuid)', 'EXECUTE'),
  'authenticated callers reach the guarded import RPC'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mobility-importer@example.test', '',
  now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mobility Importer"}', now(), now()
);

insert into private.user_roles (user_id, role)
values ('d1000000-0000-0000-0000-000000000001', 'editor');
insert into private.module_permissions (
  user_id, module, can_view, can_create, can_update, can_import
) values (
  'd1000000-0000-0000-0000-000000000001',
  'mobility', true, true, true, true
);

insert into public.countries (id, iso2, iso3, name_th, name_en)
values ('d2000000-0000-0000-0000-000000000001', 'QX', 'QXX', 'ประเทศนำเข้าทดสอบ', 'Import Test Country');
insert into public.organization_units (id, code, name_th, name_en)
values ('d3000000-0000-0000-0000-000000000001', 'IMPORT-UNIT', 'หน่วยนำเข้าทดสอบ', 'Import Test Unit');
insert into public.people (
  id, person_type, source_identifier, full_name_th, organization_unit_id, source_system
) values (
  'd4000000-0000-0000-0000-000000000001',
  'student', '67111111', 'นิสิตทดสอบนำเข้า',
  'd3000000-0000-0000-0000-000000000001', 'test'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.import_batches (
  id, module, import_kind, source_file_name, status, total_rows,
  valid_rows, warning_rows, invalid_rows, created_by
) values (
  'd5000000-0000-0000-0000-000000000001',
  'mobility', 'module_data', 'mobility-import-test.xlsx', 'ready',
  1, 1, 0, 0, 'd1000000-0000-0000-0000-000000000001'
);
insert into public.import_rows (
  id, batch_id, row_number, status, source_key, change_action,
  review_status, source_data, normalized_data, validation_messages
) values (
  'd6000000-0000-0000-0000-000000000001',
  'd5000000-0000-0000-0000-000000000001',
  1, 'valid', 'LEGACY-MOB-001', 'insert', 'pending', '{}',
  jsonb_build_object(
    'legacyId', 'LEGACY-MOB-001',
    'projectName', 'โครงการ Mobility จาก staging',
    'purpose', 'ทดสอบระบบนำเข้า',
    'direction', 'outbound',
    'countryId', 'd2000000-0000-0000-0000-000000000001',
    'countryNameSnapshot', 'ประเทศนำเข้าทดสอบ',
    'ownerUnitId', 'd3000000-0000-0000-0000-000000000001',
    'startDate', '2026-08-10',
    'endDate', '2026-08-20',
    'fiscalYear', 2569,
    'sourceStatus', 'completed',
    'publicVisible', false,
    'participants', jsonb_build_array(jsonb_build_object(
      'legacyParticipantId', 'LEGACY-P-001',
      'sourceIdentifier', '67111111',
      'fullNameSnapshot', 'นิสิตทดสอบนำเข้า',
      'genderSnapshot', 'หญิง',
      'programOrPositionSnapshot', 'หลักสูตรทดสอบ',
      'participantRole', 'นิสิต',
      'sourceUnitId', 'IMPORT-UNIT',
      'organizationUnitIdSnapshot', 'd3000000-0000-0000-0000-000000000001'
    ))
  ),
  '[]'
);

select throws_ok(
  $$ select public.commit_student_mobility_import_batch('d5000000-0000-0000-0000-000000000001') $$,
  '23514',
  'STUDENT_MOBILITY_IMPORT_REVIEW_INCOMPLETE',
  'pending rows block the production commit boundary'
);

update public.import_rows
set review_status = 'approved',
    reviewed_at = now(),
    reviewed_by = 'd1000000-0000-0000-0000-000000000001'
where id = 'd6000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ select public.commit_student_mobility_import_batch('d5000000-0000-0000-0000-000000000001') $$,
  'approved mobility staging batch commits atomically'
);
select is(
  (select workflow_status::text from public.movement_cases where legacy_id = 'LEGACY-MOB-001'),
  'completed',
  'legacy project status maps to the movement workflow'
);
select is(
  (select count(*)::integer from public.movement_participants mp
   join public.movement_cases mc on mc.id = mp.movement_id
   where mc.legacy_id = 'LEGACY-MOB-001' and mp.person_id = 'd4000000-0000-0000-0000-000000000001'),
  1,
  'participant is linked to the shared people master'
);

select * from finish();
rollback;
