begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'movement_workflow_events', 'movement workflow event table exists');
select has_column('public', 'movement_cases', 'departure_at', 'movement cases stores departure time');
select has_column('public', 'movement_participants', 'student_id_snapshot', 'participant stores student snapshot');
select has_function('public', 'student_mobility_save_draft', array['uuid', 'timestamptz', 'jsonb'], 'student draft RPC exists');
select has_function('public', 'student_mobility_replace_participants', array['uuid', 'timestamptz', 'jsonb'], 'participant RPC exists');
select has_function('public', 'student_mobility_replace_funding', array['uuid', 'timestamptz', 'jsonb'], 'funding RPC exists');
select ok(not has_function_privilege('anon', 'public.student_mobility_save_draft(uuid, timestamptz, jsonb)', 'EXECUTE'), 'anonymous user cannot save a student mobility draft');
select ok(has_function_privilege('authenticated', 'public.student_mobility_save_draft(uuid, timestamptz, jsonb)', 'EXECUTE'), 'authenticated user may call guarded draft RPC');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mobility-editor@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mobility Editor"}', now(), now()),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mobility-publisher@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mobility Publisher"}', now(), now()),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'travel-only@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Travel Only"}', now(), now());

insert into private.user_roles (user_id, role) values
  ('c1000000-0000-0000-0000-000000000001', 'editor'),
  ('c1000000-0000-0000-0000-000000000002', 'office_admin'),
  ('c1000000-0000-0000-0000-000000000003', 'editor');

insert into private.module_permissions (user_id, module, can_view, can_create, can_update, can_publish) values
  ('c1000000-0000-0000-0000-000000000001', 'mobility', true, true, true, false),
  ('c1000000-0000-0000-0000-000000000002', 'mobility', true, false, false, true),
  ('c1000000-0000-0000-0000-000000000003', 'travel', true, true, true, false);

insert into public.countries (id, iso2, iso3, name_th, name_en)
values ('c2000000-0000-0000-0000-000000000001', 'QM', 'QMT', 'ประเทศทดสอบ Mobility', 'Mobility Test Country');

insert into public.organization_units (id, code, name_th, name_en)
values ('c3000000-0000-0000-0000-000000000001', 'MOB-RLS', 'หน่วยทดสอบ Mobility', 'Mobility Test Unit');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
  do $workflow$
  declare
    draft jsonb;
    participants jsonb;
    submitted jsonb;
    movement_uuid uuid;
  begin
    begin
      insert into public.movement_cases (
        category, project_name, created_by, start_date, fiscal_year
      ) values (
        'student_mobility', 'direct write must fail', 'c1000000-0000-0000-0000-000000000001', current_date, 2569
      );
      raise exception 'editor unexpectedly wrote directly to student mobility';
    exception when insufficient_privilege then null;
    end;

    draft := public.student_mobility_save_draft(null, null, jsonb_build_object(
      'project_name', 'Mobility RLS workflow test', 'purpose', 'exchange', 'direction', 'outbound',
      'country_id', 'c2000000-0000-0000-0000-000000000001',
      'owner_unit_id', 'c3000000-0000-0000-0000-000000000001',
      'start_date', '2026-08-01', 'fiscal_year', '2569', 'departure_at', '2026-08-01T08:00:00+07:00'
    ));
    movement_uuid := (draft ->> 'id')::uuid;

    participants := public.student_mobility_replace_participants(
      movement_uuid, (draft ->> 'updated_at')::timestamptz,
      jsonb_build_array(jsonb_build_object(
        'full_name_snapshot', 'Student Mobility Test', 'student_id_snapshot', '67123456',
        'study_program_snapshot', 'International Relations', 'study_level_snapshot', 'Bachelor'
      ))
    );
    submitted := public.student_mobility_submit_for_review(
      movement_uuid, (participants ->> 'updated_at')::timestamptz
    );

    perform set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
    perform public.student_mobility_approve(movement_uuid, (submitted ->> 'updated_at')::timestamptz);

    if (select workflow_status from public.movement_cases where id = movement_uuid) <> 'approved'::public.workflow_status then
      raise exception 'student mobility did not reach approved state';
    end if;
  end;
  $workflow$;
  $$,
  'student mobility RPC workflow enforces direct-write, editor, and publisher boundaries'
);

select is(
  (
    select count(*)::integer
    from public.movement_workflow_events event
    join public.movement_cases movement on movement.id = event.movement_id
    where movement.project_name = 'Mobility RLS workflow test'
  ),
  4,
  'create, participant edit, submit, and approve events are recorded'
);
select is(
  (
    select count(*)::integer
    from public.movement_workflow_events event
    join public.movement_cases movement on movement.id = event.movement_id
    where event.action = 'participants_replaced'
      and movement.project_name = 'Mobility RLS workflow test'
  ),
  1,
  'participant replacement has a distinct audit action'
);

select lives_ok(
  $$
  do $travel_only$
  begin
    perform set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
    begin
      perform public.student_mobility_save_draft(null, null, jsonb_build_object('project_name', 'travel user must fail'));
      raise exception 'travel-only user unexpectedly created mobility';
    exception when insufficient_privilege then null;
    end;
  end;
  $travel_only$;
  $$,
  'travel permission does not grant student mobility access'
);

select * from finish();
rollback;
