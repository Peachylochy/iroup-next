begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('public', 'student_mobility_save',
  array['uuid', 'timestamptz', 'jsonb', 'jsonb', 'jsonb', 'boolean'],
  'complete student mobility save has a single transactional RPC');
select ok(has_function_privilege('authenticated',
  'public.student_mobility_save(uuid,timestamptz,jsonb,jsonb,jsonb,boolean)', 'EXECUTE'),
  'authenticated callers may use the guarded atomic RPC');
select ok(not has_function_privilege('anon',
  'public.student_mobility_save(uuid,timestamptz,jsonb,jsonb,jsonb,boolean)', 'EXECUTE'),
  'anonymous callers cannot execute atomic student saves');
select ok(not has_function_privilege('anon',
  'public.staff_movement_save(uuid,timestamptz,public.movement_category,jsonb,jsonb,jsonb,boolean)', 'EXECUTE'),
  'staff save remains unavailable to anonymous callers');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('f9100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stability-movement-editor@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Stability Movement Editor"}', now(), now()),
  ('f9100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stability-travel-editor@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Travel Editor"}', now(), now()),
  ('f9100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stability-create-only@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Create Only"}', now(), now());

insert into private.user_roles (user_id, role) values
  ('f9100000-0000-0000-0000-000000000001', 'editor'),
  ('f9100000-0000-0000-0000-000000000002', 'editor'),
  ('f9100000-0000-0000-0000-000000000003', 'editor');
insert into private.module_permissions (user_id, module, can_view, can_create, can_update) values
  ('f9100000-0000-0000-0000-000000000001', 'mobility', true, true, true),
  ('f9100000-0000-0000-0000-000000000001', 'travel', true, true, true),
  ('f9100000-0000-0000-0000-000000000002', 'travel', true, true, true),
  ('f9100000-0000-0000-0000-000000000003', 'mobility', true, true, false);

insert into public.countries (id, iso2, iso3, name_th, name_en)
values ('f9200000-0000-0000-0000-000000000001', 'QJ', 'QJJ', 'ประเทศทดสอบ', 'Stability Country');
insert into public.organization_units (id, code, name_th, name_en)
values ('f9300000-0000-0000-0000-000000000001', 'STABILITY-MOVEMENT', 'หน่วยงานทดสอบ', 'Stability Unit');
insert into public.people (id, person_type, full_name_th)
values ('f9400000-0000-0000-0000-000000000001', 'staff', 'บุคลากรจากข้อมูลหลัก');

create temporary table movement_test_values (key text primary key, value jsonb not null);
grant select, insert, update on movement_test_values to authenticated;
insert into movement_test_values (key, value) values
  ('payload', '{"project_name":"Atomic student draft", "purpose":"Exchange", "direction":"outbound", "country_id":"f9200000-0000-0000-0000-000000000001", "owner_unit_id":"f9300000-0000-0000-0000-000000000001", "start_date":"2026-10-21", "end_date":"2026-10-24", "fiscal_year":"2570"}'),
  ('participants', '[{"full_name_snapshot":"Student A", "student_id_snapshot":"67123456"}]'),
  ('funding', '[{"budget_type":"grant", "source_name":"University", "amount":100, "currency":"THB"}]');

-- Snapshot row ids, content, counts, timestamps and audit events. This catches
-- delete/reinsert side effects as well as partial updates after late failures.
create function pg_temp.movement_snapshot(target_id uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'project', (select to_jsonb(m) from public.movement_cases m where id = target_id),
    'participants', (select coalesce(jsonb_agg(to_jsonb(p) order by id), '[]'::jsonb) from public.movement_participants p where movement_id = target_id),
    'funding', (select coalesce(jsonb_agg(to_jsonb(f) order by id), '[]'::jsonb) from public.movement_funding f where movement_id = target_id),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by id), '[]'::jsonb) from public.movement_workflow_events e where movement_id = target_id)
  );
$$;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"f9100000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into movement_test_values (key, value)
select 'draft', public.student_mobility_save(null, null,
  (select value from movement_test_values where key = 'payload'),
  (select value from movement_test_values where key = 'participants'),
  (select value from movement_test_values where key = 'funding'), false);

select is((select value ->> 'workflow_status' from movement_test_values where key = 'draft'), 'draft',
  'successful atomic save returns draft status');
select is((select participant_count from public.movement_cases where id = (select (value ->> 'id')::uuid from movement_test_values where key = 'draft')), 1,
  'atomic save refreshes participant count');
select is((select amount from public.movement_funding where movement_id = (select (value ->> 'id')::uuid from movement_test_values where key = 'draft')), 100::numeric,
  'atomic save includes funding');
select is((select count(*)::integer from public.movement_workflow_events where movement_id = (select (value ->> 'id')::uuid from movement_test_values where key = 'draft')), 3,
  'atomic draft preserves create, participant and funding audit events');
select is((select student_id_snapshot from public.movement_participants where movement_id = (select (value ->> 'id')::uuid from movement_test_values where key = 'draft')), '67123456',
  'atomic save preserves student snapshot fields');

insert into movement_test_values (key, value)
select 'before_failure', pg_temp.movement_snapshot((value ->> 'id')::uuid)
from movement_test_values where key = 'draft';

select throws_ok($$
  select public.student_mobility_save((d.value ->> 'id')::uuid, (d.value ->> 'updated_at')::timestamptz,
    p.value || '{"project_name":"Must roll back participant failure"}',
    '[{"full_name_snapshot":" "}]', '[]', false)
  from movement_test_values d, movement_test_values p where d.key = 'draft' and p.key = 'payload'
$$, '23514', 'STUDENT_MOBILITY_VALIDATION_FAILED', 'invalid participant fails after the project update');
select is(pg_temp.movement_snapshot((select (value ->> 'id')::uuid from movement_test_values where key = 'draft')),
  (select value from movement_test_values where key = 'before_failure'),
  'participant failure restores original project and all children/events');

select throws_ok($$
  select public.student_mobility_save((d.value ->> 'id')::uuid, (d.value ->> 'updated_at')::timestamptz,
    p.value || '{"project_name":"Must roll back funding failure"}',
    '[{"full_name_snapshot":"Replacement student"}]',
    '[{"budget_type":"grant","amount":-1}]', false)
  from movement_test_values d, movement_test_values p where d.key = 'draft' and p.key = 'payload'
$$, '23514', null, 'invalid funding fails after project and participant writes');
select is(pg_temp.movement_snapshot((select (value ->> 'id')::uuid from movement_test_values where key = 'draft')),
  (select value from movement_test_values where key = 'before_failure'),
  'late funding failure restores original project, child ids and audit events');

select throws_ok($$
  select public.student_mobility_save((d.value ->> 'id')::uuid, (d.value ->> 'updated_at')::timestamptz,
    p.value || '{"project_name":"Must roll back review failure", "purpose":""}',
    '[{"full_name_snapshot":"Replacement student"}]',
    '[{"budget_type":"grant","amount":200}]', true)
  from movement_test_values d, movement_test_values p where d.key = 'draft' and p.key = 'payload'
$$, '23514', 'STUDENT_MOBILITY_VALIDATION_FAILED', 'review validation can fail after all save components run');
select is(pg_temp.movement_snapshot((select (value ->> 'id')::uuid from movement_test_values where key = 'draft')),
  (select value from movement_test_values where key = 'before_failure'),
  'failed review restores project, participants, funding, status and events');

select throws_ok($$
  select public.student_mobility_save(null, null,
    p.value || '{"project_name":"Atomic orphan must not exist"}',
    '[{"full_name_snapshot":"New student"}]', '[{"budget_type":"grant","amount":-1}]', false)
  from movement_test_values p where p.key = 'payload'
$$, '23514', null, 'new project fails on late funding constraint');
select is((select count(*)::integer from public.movement_cases where project_name = 'Atomic orphan must not exist'), 0,
  'failed new save leaves no partial project');

select throws_ok($$
  select public.student_mobility_save(null, null,
    p.value || '{"project_name":"Failed new review must not exist"}', '[]', '[]', true)
  from movement_test_values p where p.key = 'payload'
$$, '23514', 'STUDENT_MOBILITY_VALIDATION_FAILED', 'new review requires a participant');
select is((select count(*)::integer from public.movement_cases where project_name = 'Failed new review must not exist'), 0,
  'failed new review leaves no partial draft');
select is((select count(*)::integer from public.movement_workflow_events where created_by = 'f9100000-0000-0000-0000-000000000001'), 3,
  'failed new saves leave no extra workflow events');

select throws_ok($$
  select public.student_mobility_save((d.value ->> 'id')::uuid, (d.value ->> 'updated_at')::timestamptz - interval '1 second',
    p.value, '[]', '[]', false)
  from movement_test_values d, movement_test_values p where d.key = 'draft' and p.key = 'payload'
$$, '40001', 'STUDENT_MOBILITY_CONFLICT', 'stale atomic edits retain optimistic locking');
select throws_ok($$
  select public.student_mobility_save(null, null, '{"project_name":"Bad arrays"}', null, '[]', false)
$$, '23514', 'STUDENT_MOBILITY_VALIDATION_FAILED', 'SQL-null participant array is rejected');
select throws_ok($$
  select public.student_mobility_save(null, null, '{"project_name":"Bad arrays"}', '[]', '{}', false)
$$, '23514', 'STUDENT_MOBILITY_VALIDATION_FAILED', 'non-array funding is rejected');

insert into movement_test_values (key, value)
select 'submitted', public.student_mobility_save((d.value ->> 'id')::uuid, (d.value ->> 'updated_at')::timestamptz,
  p.value || '{"project_name":"Atomic submitted student"}',
  '[{"full_name_snapshot":"Student B"}]', '[{"budget_type":"grant","amount":250}]', true)
from movement_test_values d, movement_test_values p where d.key = 'draft' and p.key = 'payload';
select is((select value ->> 'workflow_status' from movement_test_values where key = 'submitted'), 'under_review',
  'valid atomic save and submit returns under_review');
select is((select full_name_snapshot from public.movement_participants where movement_id = (select (value ->> 'id')::uuid from movement_test_values where key = 'submitted')), 'Student B',
  'successful atomic edit replaces submitted participants');
select is((select amount from public.movement_funding where movement_id = (select (value ->> 'id')::uuid from movement_test_values where key = 'submitted')), 250::numeric,
  'successful atomic edit replaces submitted funding');
select is((select count(*)::integer from public.movement_workflow_events where movement_id = (select (value ->> 'id')::uuid from movement_test_values where key = 'submitted')), 7,
  'save and submit adds the established four audit events');
select throws_ok($$
  select public.student_mobility_save((d.value ->> 'id')::uuid, (d.value ->> 'updated_at')::timestamptz,
    p.value, '[]', '[]', false)
  from movement_test_values d, movement_test_values p where d.key = 'submitted' and p.key = 'payload'
$$, '23514', 'STUDENT_MOBILITY_INVALID_TRANSITION', 'atomic save cannot edit a submitted project');

-- Both staff categories support unlinked manual participants and keep master
-- person types for linked participants in the very same save.
insert into movement_test_values (key, value)
select category::text, public.staff_movement_save(null, null, category,
  p.value || jsonb_build_object('project_name', 'Manual staff ' || category::text),
  '[{"full_name_snapshot":" Manual traveler "}, {"person_id":"f9400000-0000-0000-0000-000000000001", "full_name_snapshot":"Master traveler"}]',
  '[]', true)
from movement_test_values p,
  unnest(array['staff_mobility'::public.movement_category, 'staff_official_travel'::public.movement_category]) category
where p.key = 'payload';
select is((select count(*)::integer from public.movement_participants p join movement_test_values t on p.movement_id = (t.value ->> 'id')::uuid
  where t.key in ('staff_mobility', 'staff_official_travel') and p.person_id is null and p.person_source = 'external' and p.full_name_snapshot = 'Manual traveler'), 2,
  'both staff categories persist trimmed manual participants as external');
select is((select count(*)::integer from public.movement_participants p join movement_test_values t on p.movement_id = (t.value ->> 'id')::uuid
  where t.key in ('staff_mobility', 'staff_official_travel') and p.person_id = 'f9400000-0000-0000-0000-000000000001' and p.person_source = 'staff'), 2,
  'manual fix preserves linked master participant types');
select is((select count(*)::integer from movement_test_values where key in ('staff_mobility', 'staff_official_travel') and value ->> 'workflow_status' = 'under_review'), 2,
  'both staff categories can submit a save containing manual people');
select throws_ok($$
  select public.staff_movement_save(null, null, 'staff_official_travel',
    value || '{"project_name":"Failed staff draft must not exist"}',
    '[{"full_name_snapshot":"Manual traveler"}]', '[{"budget_type":""}]', false)
  from movement_test_values where key = 'payload'
$$, '23514', 'STAFF_MOVEMENT_VALIDATION_FAILED', 'late staff funding failure still rolls back manual participant save');
select is((select count(*)::integer from public.movement_cases where project_name = 'Failed staff draft must not exist'), 0,
  'staff failure does not leave an orphan draft');

set local "request.jwt.claims" = '{"sub":"f9100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok($$
  select public.student_mobility_save(null, null, '{"project_name":"Forbidden student"}', '[]', '[]', false)
$$, '42501', 'STUDENT_MOBILITY_FORBIDDEN', 'travel-only editor cannot create student mobility through atomic RPC');
select throws_ok($$
  select public.staff_movement_save(null, null, 'staff_mobility', '{"project_name":"Forbidden staff mobility"}', '[]', '[]', false)
$$, '42501', 'STAFF_MOVEMENT_FORBIDDEN', 'travel-only editor cannot create staff mobility');

set local "request.jwt.claims" = '{"sub":"f9100000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$
  select public.student_mobility_save(null, null, '{"project_name":"Create-only must not partially save"}', '[]', '[]', false)
$$, '42501', 'STUDENT_MOBILITY_FORBIDDEN', 'complete save retains participant/funding update permission requirement');
select is((select count(*)::integer from public.movement_cases where project_name = 'Create-only must not partially save'), 0,
  'create-only denial leaves no partial project');

set local "request.jwt.claims" = '{"role":"authenticated"}';
select throws_ok($$
  select public.student_mobility_save(null, null, '{"project_name":"No actor"}', '[]', '[]', false)
$$, '42501', 'STUDENT_MOBILITY_FORBIDDEN', 'authenticated role without a user id cannot save');

reset role;
select * from finish();
rollback;
