begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table(
  'public',
  'partner_contacts',
  'private partner contacts table exists'
);
select has_table(
  'public',
  'partner_contact_methods',
  'private contact methods table exists'
);
select has_table(
  'public',
  'partner_contact_interactions',
  'private contact interactions table exists'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'partner_contacts',
        'partner_contact_methods',
        'partner_contact_interactions'
      )
      and relrowsecurity
  $$,
  array[3::bigint],
  'RLS is enabled on every contact table'
);

select is(
  has_table_privilege('anon', 'public.partner_contacts', 'SELECT'),
  false,
  'anonymous users have no privilege on partner contacts'
);
select is(
  has_table_privilege('anon', 'public.partner_contact_methods', 'SELECT'),
  false,
  'anonymous users have no privilege on contact methods'
);
select is(
  has_table_privilege(
    'anon',
    'public.partner_contact_interactions',
    'SELECT'
  ),
  false,
  'anonymous users have no privilege on contact interactions'
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
    '41000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'contact-viewer@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Contact Viewer"}',
    now(),
    now()
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'contact-editor@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Contact Editor"}',
    now(),
    now()
  ),
  (
    '41000000-0000-0000-0000-000000000003',
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
  ('41000000-0000-0000-0000-000000000001', 'viewer'),
  ('41000000-0000-0000-0000-000000000002', 'editor');

insert into private.module_permissions (
  user_id,
  module,
  can_view,
  can_create,
  can_update
)
values
  (
    '41000000-0000-0000-0000-000000000001',
    'mou',
    true,
    false,
    false
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    'mou',
    true,
    true,
    true
  );

insert into public.countries (id, iso2, iso3, name_th, name_en)
values (
  '42000000-0000-0000-0000-000000000001',
  'VN',
  'VNM',
  'เวียดนาม',
  'Vietnam'
)
on conflict (iso2) do update set id = excluded.id;

insert into public.partner_organizations (
  id,
  name_en,
  country_id,
  created_by
)
values (
  '43000000-0000-0000-0000-000000000001',
  'Test Partner University',
  '42000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000002'
);

insert into public.partner_contacts (
  id,
  partner_organization_id,
  full_name,
  position_title,
  created_by
)
values (
  '44000000-0000-0000-0000-000000000001',
  '43000000-0000-0000-0000-000000000001',
  'Internal Contact',
  'International Relations Officer',
  '41000000-0000-0000-0000-000000000002'
);

insert into public.partner_contact_methods (
  id,
  partner_contact_id,
  method_type,
  value,
  is_primary,
  created_by
)
values (
  '45000000-0000-0000-0000-000000000001',
  '44000000-0000-0000-0000-000000000001',
  'email',
  'contact@example.test',
  true,
  '41000000-0000-0000-0000-000000000002'
);

insert into public.partner_contact_interactions (
  id,
  partner_contact_id,
  occurred_on,
  context,
  created_by
)
values (
  '46000000-0000-0000-0000-000000000001',
  '44000000-0000-0000-0000-000000000001',
  '2026-04-01',
  'Test partnership meeting',
  '41000000-0000-0000-0000-000000000002'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"41000000-0000-0000-0000-000000000003","role":"authenticated"}';

select results_eq(
  'select count(*)::bigint from public.partner_contacts',
  array[0::bigint],
  'signed-in users without MOU permission see no contacts'
);

set local "request.jwt.claims" =
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  'select count(*)::bigint from public.partner_contacts',
  array[1::bigint],
  'MOU viewer can read partner contacts'
);
select results_eq(
  'select count(*)::bigint from public.partner_contact_methods',
  array[1::bigint],
  'MOU viewer can read contact methods'
);
select results_eq(
  'select count(*)::bigint from public.partner_contact_interactions',
  array[1::bigint],
  'MOU viewer can read contact interactions'
);
select throws_ok(
  $$
    insert into public.partner_contacts (
      partner_organization_id,
      full_name,
      created_by
    )
    values (
      '43000000-0000-0000-0000-000000000001',
      'Forbidden Contact',
      '41000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  null,
  'MOU viewer cannot create contacts'
);

set local "request.jwt.claims" =
  '{"sub":"41000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.partner_contacts (
      id,
      partner_organization_id,
      full_name,
      created_by
    )
    values (
      '44000000-0000-0000-0000-000000000002',
      '43000000-0000-0000-0000-000000000001',
      'New Contact',
      '41000000-0000-0000-0000-000000000002'
    )
  $$,
  'MOU editor can create contacts'
);
select lives_ok(
  $$
    insert into public.partner_contact_methods (
      partner_contact_id,
      method_type,
      value,
      created_by
    )
    values (
      '44000000-0000-0000-0000-000000000002',
      'phone',
      '+66 00 000 0000',
      '41000000-0000-0000-0000-000000000002'
    )
  $$,
  'MOU editor can create contact methods'
);
select lives_ok(
  $$
    insert into public.partner_contact_interactions (
      partner_contact_id,
      context,
      created_by
    )
    values (
      '44000000-0000-0000-0000-000000000002',
      'New contact introduction',
      '41000000-0000-0000-0000-000000000002'
    )
  $$,
  'MOU editor can create contact interactions'
);
select lives_ok(
  $$
    update public.partner_contacts
    set relationship_level = 'medium'
    where id = '44000000-0000-0000-0000-000000000002'
  $$,
  'MOU editor can update contacts'
);
select results_eq(
  $$
    with deleted as (
      delete from public.partner_contacts
      where id = '44000000-0000-0000-0000-000000000002'
      returning id
    )
    select count(*)::bigint from deleted
  $$,
  array[0::bigint],
  'MOU editor without delete permission cannot hard-delete contacts'
);
select results_eq(
  $$
    select count(*)::bigint
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name like 'partner_contact%'
  $$,
  array[0::bigint],
  'contact tables have no anonymous grants'
);

select * from finish();

rollback;
