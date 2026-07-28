begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_column(
  'public', 'agreements', 'workflow_status',
  'agreements has a workflow state'
);

select has_table(
  'public', 'agreement_workflow_events',
  'MOU workflow event table exists'
);

select has_function(
  'public', 'mou_save_draft',
  array['uuid', 'timestamptz', 'jsonb'],
  'draft save RPC exists'
);

select has_function(
  'public', 'mou_submit_for_review',
  array['uuid', 'timestamptz'],
  'submit-for-review RPC exists'
);

select has_function(
  'public', 'mou_publish',
  array['uuid', 'timestamptz'],
  'publish RPC exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.mou_save_draft(uuid, timestamptz, jsonb)',
    'EXECUTE'
  ),
  'anonymous users cannot save MOU drafts'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.mou_save_draft(uuid, timestamptz, jsonb)',
    'EXECUTE'
  ),
  'authenticated users may call the guarded draft RPC'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    'b1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mou-editor-rls@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"MOU Editor"}', now(), now()
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mou-publisher-rls@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"MOU Publisher"}', now(), now()
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mou-viewer-rls@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"MOU Viewer"}', now(), now()
  );

insert into private.user_roles (user_id, role) values
  ('b1000000-0000-0000-0000-000000000001', 'editor'),
  ('b1000000-0000-0000-0000-000000000002', 'office_admin'),
  ('b1000000-0000-0000-0000-000000000003', 'viewer');

insert into private.module_permissions (
  user_id, module, can_view, can_create, can_update, can_publish
) values
  ('b1000000-0000-0000-0000-000000000001', 'mou', true, true, true, false),
  ('b1000000-0000-0000-0000-000000000002', 'mou', true, false, false, true),
  ('b1000000-0000-0000-0000-000000000003', 'mou', true, false, false, false);

insert into public.countries (id, iso2, iso3, name_th, name_en)
values ('b2000000-0000-0000-0000-000000000001', 'KR', 'KOR', 'เกาหลีใต้', 'South Korea')
on conflict (iso2) do update set id = excluded.id;

insert into public.organization_units (id, code, name_th, name_en)
values ('b3000000-0000-0000-0000-000000000001', 'MOU-RLS', 'หน่วยงานทดสอบ MOU', 'MOU Test Unit');

insert into public.partner_organizations (id, name_en, country_id, verification_status)
values ('b4000000-0000-0000-0000-000000000001', 'MOU RLS Partner', 'b2000000-0000-0000-0000-000000000001', 'verified');

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    do $workflow$
    declare
      created_record jsonb;
      submitted_record jsonb;
      agreement_uuid uuid;
      expected_update timestamptz;
    begin
      begin
        insert into public.agreements (
          title_th, agreement_type, start_date, fiscal_year, created_by
        ) values (
          'direct write must fail', 'MOU', current_date, 2569,
          'b1000000-0000-0000-0000-000000000001'
        );
        raise exception 'editor unexpectedly wrote directly to agreements';
      exception when insufficient_privilege then
        null;
      end;

      created_record := public.mou_save_draft(
        null,
        null,
        jsonb_build_object(
          'title_th', 'MOU RLS workflow test',
          'agreement_number', 'MOU-RLS-TEST-001',
          'agreement_type', 'MOU',
          'signed_date', '2026-07-01',
          'start_date', '2026-08-01',
          'fiscal_year', '2569',
          'partners', jsonb_build_array(
            jsonb_build_object('id', 'b4000000-0000-0000-0000-000000000001', 'is_lead', true)
          ),
          'units', jsonb_build_array(
            jsonb_build_object('id', 'b3000000-0000-0000-0000-000000000001', 'is_owner', true)
          )
        )
      );

      agreement_uuid := (created_record ->> 'id')::uuid;
      expected_update := (created_record ->> 'updated_at')::timestamptz;

      begin
        perform public.mou_publish(agreement_uuid, expected_update);
        raise exception 'editor unexpectedly published MOU';
      exception when insufficient_privilege then
        null;
      end;

      submitted_record := public.mou_submit_for_review(agreement_uuid, expected_update);

      perform set_config(
        'request.jwt.claims',
        '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}',
        true
      );

      perform public.mou_publish(
        agreement_uuid,
        (submitted_record ->> 'updated_at')::timestamptz
      );

      if (
        select concat_ws(':', status::text, workflow_status::text, publication_status::text)
        from public.agreements
        where id = agreement_uuid
      ) <> 'active:active:published' then
        raise exception 'published MOU state is invalid';
      end if;

      perform set_config(
        'request.jwt.claims',
        '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}',
        true
      );

      begin
        perform public.mou_save_draft(
          null, null, jsonb_build_object('title_th', 'viewer must fail')
        );
        raise exception 'viewer unexpectedly saved MOU';
      exception when insufficient_privilege then
        null;
      end;
    end;
    $workflow$;
  $$,
  'MOU workflow enforces editor, publisher, and viewer boundaries'
);

select is(
  (
    select count(*)::integer
    from public.agreement_workflow_events
  ),
  7,
  'create, submit, and publish events are recorded'
);

select * from finish();
rollback;
