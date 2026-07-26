begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'countries', 'countries table exists');
select has_table('public', 'organization_units', 'organization units table exists');
select has_table('public', 'people', 'people table exists');
select has_table('public', 'movement_cases', 'movement records table exists');
select has_table('public', 'movement_participants', 'travel participants table exists');
select has_table('public', 'movement_funding', 'travel budgets table exists');
select has_table('public', 'import_batches', 'import batches table exists');
select has_table('public', 'import_rows', 'import rows table exists');
select has_view('public', 'movements_public', 'public-safe Official Travel view exists');

select results_eq(
  $$
    select count(*)::bigint
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'profiles',
        'countries',
        'organization_units',
        'people',
        'movement_cases',
        'movement_participants',
        'movement_funding',
        'import_batches',
        'import_rows'
      )
      and relrowsecurity
  $$,
  array[9::bigint],
  'RLS is enabled on every exposed base table'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"System Admin"}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'editor@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Official Travel Editor"}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'viewer@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Official Travel Viewer"}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'unassigned@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Unassigned User"}',
    now(),
    now()
  );

insert into private.user_roles (user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', 'system_admin'),
  ('10000000-0000-0000-0000-000000000002', 'editor'),
  ('10000000-0000-0000-0000-000000000003', 'viewer');

insert into private.module_permissions (
  user_id,
  module,
  can_view,
  can_create,
  can_update,
  can_import
)
values
  (
    '10000000-0000-0000-0000-000000000002',
    'travel',
    true,
    true,
    true,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'travel',
    true,
    false,
    false,
    false
  );

insert into public.countries (id, iso2, iso3, name_th, name_en)
values (
  '20000000-0000-0000-0000-000000000001',
  'TH',
  'THA',
  'à¸›à¸£à¸°à¹€à¸—à¸¨à¹„à¸—à¸¢',
  'Thailand'
);

insert into public.organization_units (id, code, name_th, name_en)
values (
  '30000000-0000-0000-0000-000000000001',
  'IRO',
  'à¸‡à¸²à¸™à¸§à¸´à¹€à¸—à¸¨à¸ªà¸±à¸¡à¸žà¸±à¸™à¸˜à¹Œ',
  'International Relations Office'
);

insert into public.movement_cases (
  id,
  legacy_id,
  project_name,
  country_id,
  start_date,
  end_date,
  fiscal_year,
  publication_status,
  public_visible,
  internal_note,
  created_by
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    'PUBLIC-001',
    'Published mission',
    '20000000-0000-0000-0000-000000000001',
    '2026-07-01',
    '2026-07-05',
    2569,
    'published',
    true,
    'must never be public',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'DRAFT-001',
    'Internal draft mission',
    '20000000-0000-0000-0000-000000000001',
    '2026-08-01',
    '2026-08-03',
    2569,
    'draft',
    false,
    'internal draft',
    '10000000-0000-0000-0000-000000000001'
  );

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

select results_eq(
  'select count(*)::bigint from public.movements_public',
  array[1::bigint],
  'anonymous users see only published Official Travel records'
);

select ok(
  has_column_privilege('anon', 'public.movement_cases', 'project_name', 'SELECT'),
  'anonymous users can read a public-safe Official Travel column'
);

select ok(
  not has_column_privilege('anon', 'public.movement_cases', 'internal_note', 'SELECT'),
  'anonymous users cannot read internal Official Travel notes'
);

select ok(
  not has_table_privilege('anon', 'public.movement_participants', 'SELECT'),
  'anonymous users cannot read participant rows'
);

select ok(
  not has_table_privilege('anon', 'public.movement_funding', 'SELECT'),
  'anonymous users cannot read budget rows'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';

select results_eq(
  'select count(*)::bigint from public.movement_cases',
  array[1::bigint],
  'unassigned users see public Official Travel records only'
);

select results_eq(
  'select count(*)::bigint from public.profiles',
  array[1::bigint],
  'unassigned users see only their own profile'
);

set local "request.jwt.claims" =
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';

select results_eq(
  'select count(*)::bigint from public.movement_cases',
  array[2::bigint],
  'Official Travel viewers see published and internal Official Travel records'
);

select throws_ok(
  $$
    insert into public.movement_cases (
      project_name,
      start_date,
      end_date,
      fiscal_year,
      created_by
    )
    values (
      'Viewer must not create',
      '2026-09-01',
      '2026-09-02',
      2570,
      '10000000-0000-0000-0000-000000000003'
    )
    on conflict do nothing
  $$,
  '42501',
  null,
  'Official Travel viewers cannot create records'
);

set local "request.jwt.claims" =
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.movement_cases (
      id,
      project_name,
      start_date,
      end_date,
      fiscal_year,
      created_by
    )
    values (
      '40000000-0000-0000-0000-000000000003',
      'Editor draft',
      '2026-09-10',
      '2026-09-12',
      2570,
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  'Official Travel editors can create draft records'
);

select throws_ok(
  $$
    insert into public.movement_cases (
      project_name,
      start_date,
      end_date,
      fiscal_year,
      publication_status,
      public_visible,
      created_by
    )
    values (
      'Editor published record',
      '2026-09-20',
      '2026-09-21',
      2570,
      'published',
      true,
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  null,
  'Official Travel editors cannot publish without publish permission'
);

select is_empty(
  $$
    update public.movement_cases
    set project_name = 'Editor changed published record'
    where id = '40000000-0000-0000-0000-000000000001'
    returning id
  $$,
  'Official Travel editors cannot modify already published records'
);

select lives_ok(
  $$
    insert into public.movement_participants (
      id,
      movement_id,
      person_source,
      full_name_snapshot,
      organization_unit_id_snapshot,
      created_by
    )
    values (
      '50000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000003',
      'staff',
      'Test Staff',
      '30000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  'Official Travel editors can add participants'
);

select results_eq(
  $$
    select participant_count::bigint
    from public.movement_cases
    where id = '40000000-0000-0000-0000-000000000003'
  $$,
  array[1::bigint],
  'participant count is refreshed automatically'
);

select lives_ok(
  $$
    insert into public.import_batches (
      id,
      module,
      source_file_name,
      created_by
    )
    values (
      '60000000-0000-0000-0000-000000000001',
      'travel',
      'travel.csv',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  'Official Travel editors with import permission can create import batches'
);

select lives_ok(
  $$
    insert into public.import_rows (
      batch_id,
      row_number,
      source_data
    )
    values (
      '60000000-0000-0000-0000-000000000001',
      1,
      '{"project_name":"Imported mission"}'
    )
  $$,
  'authorized import rows can be staged'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    update public.movement_cases
    set project_name = 'Admin reviewed publication'
    where id = '40000000-0000-0000-0000-000000000001'
  $$,
  'system administrators can update published records'
);

select results_eq(
  'select count(*)::bigint from public.profiles',
  array[4::bigint],
  'system administrators can view all profiles'
);

reset role;

select results_eq(
  $$
    select count(*)::bigint
    from private.audit_logs
    where table_name = 'movement_cases'
  $$,
  array[5::bigint],
  'Official Travel inserts and updates are audited'
);

select * from finish();
rollback;

