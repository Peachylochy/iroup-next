begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

select has_table('public', 'partner_organizations', 'partner organizations table exists');
select has_table('public', 'budget_types', 'budget types table exists');
select has_table('public', 'file_roles', 'file roles table exists');
select has_table('public', 'agreements', 'agreements table exists');
select has_table('public', 'agreement_partners', 'agreement partners table exists');
select has_table('public', 'movement_cases', 'shared movement cases table exists');
select has_table('public', 'movement_participants', 'shared movement participants table exists');
select has_table('public', 'movement_funding', 'shared movement funding table exists');
select has_table('public', 'scholarships', 'scholarships table exists');
select has_table('public', 'events', 'events table exists');
select has_table('public', 'news_articles', 'news articles table exists');
select has_table('public', 'knowledge_items', 'knowledge items table exists');
select has_table('public', 'assets', 'assets table exists');
select has_table('public', 'record_assets', 'record assets table exists');

select has_view('public', 'movements_public', 'public-safe movements view exists');
select has_view('public', 'agreements_public', 'public-safe agreements view exists');
select has_view('public', 'scholarships_public', 'public-safe scholarships view exists');
select has_view('public', 'events_public', 'public-safe events view exists');
select has_view('public', 'news_public', 'public-safe news view exists');
select has_view('public', 'knowledge_public', 'public-safe knowledge view exists');
select has_view('public', 'workspace_dashboard_counts', 'permission-aware dashboard view exists');

select results_eq(
  $$
    select count(*)::bigint
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and relrowsecurity
  $$,
  array[25::bigint],
  'RLS is enabled on every public base table'
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
    '11000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-full@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"System Admin"}',
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mobility-editor@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Mobility Editor"}',
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'travel-editor@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Travel Editor"}',
    now(),
    now()
  ),
  (
    '11000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mou-viewer@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"MOU Viewer"}',
    now(),
    now()
  );

insert into private.user_roles (user_id, role)
values
  ('11000000-0000-0000-0000-000000000001', 'system_admin'),
  ('11000000-0000-0000-0000-000000000002', 'editor'),
  ('11000000-0000-0000-0000-000000000003', 'editor'),
  ('11000000-0000-0000-0000-000000000004', 'viewer');

insert into private.module_permissions (
  user_id,
  module,
  can_view,
  can_create,
  can_update
)
values
  ('11000000-0000-0000-0000-000000000002', 'mobility', true, true, true),
  ('11000000-0000-0000-0000-000000000003', 'travel', true, true, true),
  ('11000000-0000-0000-0000-000000000004', 'mou', true, false, false);

insert into public.countries (id, iso2, iso3, name_th, name_en)
values (
  '21000000-0000-0000-0000-000000000001',
  'JP',
  'JPN',
  'ญี่ปุ่น',
  'Japan'
)
on conflict (iso2) do update set id = excluded.id;

insert into public.organization_units (id, code, name_th, name_en)
values (
  '22000000-0000-0000-0000-000000000001',
  'IROUP',
  'กองบริการการศึกษา',
  'International Relations Office'
);

insert into public.partner_organizations (
  id,
  name_th,
  name_en,
  country_id
)
values (
  '23000000-0000-0000-0000-000000000001',
  'มหาวิทยาลัยคู่ความร่วมมือ',
  'Partner University',
  '21000000-0000-0000-0000-000000000001'
);

insert into public.agreements (
  id,
  title_th,
  agreement_type,
  start_date,
  end_date,
  fiscal_year,
  status,
  publication_status,
  workflow_status,
  public_visible,
  created_by
)
values
  (
    '31000000-0000-0000-0000-000000000001',
    'MOU เผยแพร่',
    'MOU',
    '2026-01-01',
    '2030-12-31',
    2569,
    'active',
    'published',
    'active',
    true,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    'MOU ฉบับร่าง',
    'MOU',
    '2026-01-01',
    null,
    2569,
    'draft',
    'draft',
    'draft',
    false,
    '11000000-0000-0000-0000-000000000001'
  );

insert into public.agreement_partners (
  agreement_id,
  partner_organization_id,
  is_lead,
  created_by
)
values (
  '31000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000001',
  true,
  '11000000-0000-0000-0000-000000000001'
);

insert into public.movement_cases (
  id,
  project_name,
  category,
  direction,
  country_id,
  start_date,
  end_date,
  fiscal_year,
  publication_status,
  public_visible,
  created_by
)
values
  (
    '32000000-0000-0000-0000-000000000001',
    'Student Mobility Published',
    'student_mobility',
    'outbound',
    '21000000-0000-0000-0000-000000000001',
    '2026-08-01',
    '2026-08-31',
    2569,
    'published',
    true,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '32000000-0000-0000-0000-000000000002',
    'Official Travel Published',
    'staff_official_travel',
    'outbound',
    '21000000-0000-0000-0000-000000000001',
    '2026-09-01',
    '2026-09-05',
    2569,
    'published',
    true,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '32000000-0000-0000-0000-000000000003',
    'Student Mobility Draft',
    'student_mobility',
    'inbound',
    '21000000-0000-0000-0000-000000000001',
    '2026-10-01',
    '2026-10-31',
    2570,
    'draft',
    false,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '32000000-0000-0000-0000-000000000004',
    'Official Travel Draft',
    'staff_official_travel',
    'outbound',
    '21000000-0000-0000-0000-000000000001',
    '2026-11-01',
    '2026-11-05',
    2570,
    'draft',
    false,
    '11000000-0000-0000-0000-000000000001'
  );

insert into public.movement_participants (
  movement_id,
  person_source,
  full_name_snapshot,
  created_by
)
values (
  '32000000-0000-0000-0000-000000000003',
  'student',
  'Private Student Name',
  '11000000-0000-0000-0000-000000000001'
);

insert into public.movement_funding (
  movement_id,
  budget_type,
  amount,
  created_by
)
values (
  '32000000-0000-0000-0000-000000000004',
  'university',
  10000,
  '11000000-0000-0000-0000-000000000001'
);

insert into public.scholarships (
  id,
  title_th,
  country_id,
  open_date,
  close_date,
  publication_status,
  public_visible,
  created_by
)
values
  (
    '33000000-0000-0000-0000-000000000001',
    'ทุนเผยแพร่',
    '21000000-0000-0000-0000-000000000001',
    '2026-08-01',
    '2026-09-01',
    'published',
    true,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '33000000-0000-0000-0000-000000000002',
    'ทุนฉบับร่าง',
    '21000000-0000-0000-0000-000000000001',
    '2026-08-01',
    '2026-09-01',
    'draft',
    false,
    '11000000-0000-0000-0000-000000000001'
  );

insert into public.events (
  id,
  title_th,
  event_type,
  starts_at,
  ends_at,
  publication_status,
  public_visible,
  created_by
)
values
  (
    '34000000-0000-0000-0000-000000000001',
    'กิจกรรมเผยแพร่',
    'seminar',
    '2026-08-10 09:00+07',
    '2026-08-10 16:00+07',
    'published',
    true,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '34000000-0000-0000-0000-000000000002',
    'กิจกรรมฉบับร่าง',
    'seminar',
    '2026-09-10 09:00+07',
    '2026-09-10 16:00+07',
    'draft',
    false,
    '11000000-0000-0000-0000-000000000001'
  );

insert into public.news_articles (
  id,
  title_th,
  publication_status,
  public_visible,
  created_by
)
values
  (
    '35000000-0000-0000-0000-000000000001',
    'ข่าวเผยแพร่',
    'published',
    true,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '35000000-0000-0000-0000-000000000002',
    'ข่าวฉบับร่าง',
    'draft',
    false,
    '11000000-0000-0000-0000-000000000001'
  );

insert into public.knowledge_items (
  id,
  title_th,
  publication_status,
  public_visible,
  created_by
)
values
  (
    '36000000-0000-0000-0000-000000000001',
    'ความรู้เผยแพร่',
    'published',
    true,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '36000000-0000-0000-0000-000000000002',
    'ความรู้ฉบับร่าง',
    'draft',
    false,
    '11000000-0000-0000-0000-000000000001'
  );

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

select results_eq(
  'select count(*)::bigint from public.movements_public',
  array[2::bigint],
  'anonymous users see published movements from both workflows'
);
select results_eq(
  'select count(*)::bigint from public.agreements_public',
  array[1::bigint],
  'anonymous users see only published agreements'
);
select results_eq(
  'select count(*)::bigint from public.scholarships_public',
  array[1::bigint],
  'anonymous users see only published scholarships'
);
select results_eq(
  'select count(*)::bigint from public.events_public',
  array[1::bigint],
  'anonymous users see only published events'
);
select results_eq(
  'select count(*)::bigint from public.news_public',
  array[1::bigint],
  'anonymous users see only published news'
);
select results_eq(
  'select count(*)::bigint from public.knowledge_public',
  array[1::bigint],
  'anonymous users see only published knowledge'
);
select throws_ok(
  'select id from public.movement_participants',
  '42501',
  null,
  'anonymous users cannot query movement participants'
);
select throws_ok(
  'select id from public.movement_funding',
  '42501',
  null,
  'anonymous users cannot query movement funding'
);
select is(
  has_column_privilege('anon', 'public.movement_cases', 'internal_note', 'SELECT'),
  false,
  'anonymous users cannot select movement internal notes'
);
select is(
  has_column_privilege('anon', 'public.scholarships', 'internal_note', 'SELECT'),
  false,
  'anonymous users cannot select scholarship internal notes'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  'select count(*)::bigint from public.movement_cases',
  array[3::bigint],
  'Mobility editor sees public movements and internal Mobility drafts'
);
select is_empty(
  $$ select id from public.movement_cases
     where id = '32000000-0000-0000-0000-000000000004' $$,
  'Mobility editor cannot see official Travel drafts'
);
select lives_ok(
  $$
    insert into public.movement_cases (
      project_name,
      category,
      direction,
      start_date,
      end_date,
      fiscal_year,
      created_by
    )
    values (
      'Mobility Editor Record',
      'student_mobility',
      'outbound',
      '2027-01-01',
      '2027-01-31',
      2570,
      '11000000-0000-0000-0000-000000000002'
    )
  $$,
  'Mobility editor can create student mobility'
);
select throws_ok(
  $$
    insert into public.movement_cases (
      project_name,
      category,
      direction,
      start_date,
      end_date,
      fiscal_year,
      created_by
    )
    values (
      'Forbidden Official Travel',
      'staff_official_travel',
      'outbound',
      '2027-02-01',
      '2027-02-05',
      2570,
      '11000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  null,
  'Mobility editor cannot create official Travel'
);
select results_eq(
  'select count(*)::bigint from public.workspace_dashboard_counts',
  array[1::bigint],
  'Mobility editor dashboard contains only permitted movement segments'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"11000000-0000-0000-0000-000000000003","role":"authenticated"}';

select results_eq(
  'select count(*)::bigint from public.movement_cases',
  array[3::bigint],
  'Travel editor sees public movements and internal official Travel drafts'
);
select is_empty(
  $$ select id from public.movement_cases
     where id = '32000000-0000-0000-0000-000000000003' $$,
  'Travel editor cannot see Mobility drafts'
);
select lives_ok(
  $$
    insert into public.movement_cases (
      project_name,
      category,
      direction,
      start_date,
      end_date,
      fiscal_year,
      created_by
    )
    values (
      'Travel Editor Record',
      'staff_official_travel',
      'outbound',
      '2027-03-01',
      '2027-03-05',
      2570,
      '11000000-0000-0000-0000-000000000003'
    )
  $$,
  'Travel editor can create official Travel'
);
select throws_ok(
  $$
    insert into public.movement_cases (
      project_name,
      category,
      direction,
      start_date,
      end_date,
      fiscal_year,
      created_by
    )
    values (
      'Forbidden Student Mobility',
      'student_mobility',
      'outbound',
      '2027-04-01',
      '2027-04-30',
      2570,
      '11000000-0000-0000-0000-000000000003'
    )
  $$,
  '42501',
  null,
  'Travel editor cannot create student mobility'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"11000000-0000-0000-0000-000000000004","role":"authenticated"}';

select results_eq(
  'select count(*)::bigint from public.agreements',
  array[2::bigint],
  'MOU viewer sees published and draft agreements'
);
select throws_ok(
  $$
    insert into public.agreements (
      title_th,
      agreement_type,
      start_date,
      fiscal_year,
      created_by
    )
    values (
      'Forbidden Agreement',
      'MOU',
      '2027-01-01',
      2570,
      '11000000-0000-0000-0000-000000000004'
    )
  $$,
  '42501',
  null,
  'MOU viewer cannot create agreements'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  'select count(*)::bigint from public.workspace_dashboard_counts',
  array[7::bigint],
  'system administrator dashboard covers every populated domain segment'
);

select * from finish();
rollback;
