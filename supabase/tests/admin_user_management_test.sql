begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_function(
  'public',
  'admin_user_directory',
  array[]::text[],
  'admin user directory function exists'
);

select has_function(
  'public',
  'admin_set_user_access',
  array['uuid', 'app_role', 'boolean', 'jsonb'],
  'admin user access mutation exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_user_directory()',
    'EXECUTE'
  ),
  'anonymous users cannot execute the directory function'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_user_directory()',
    'EXECUTE'
  ),
  'authenticated users can execute the directory function'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'private.user_roles',
    'SELECT'
  ),
  'authenticated users cannot query private role assignments'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'private.module_permissions',
    'SELECT'
  ),
  'authenticated users cannot query private module permissions'
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
    '92000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'system-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"System Administrator"}',
    now(),
    now()
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'staff-member@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Staff Member"}',
    now(),
    now()
  ),
  (
    '92000000-0000-0000-0000-000000000003',
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
values ('92000000-0000-0000-0000-000000000001', 'system_admin');

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"92000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$ select public.admin_user_directory() $$,
  '42501',
  'Only a system administrator can view user access.',
  'an unassigned user cannot read the directory'
);

select throws_ok(
  $$
    select public.admin_set_user_access(
      '92000000-0000-0000-0000-000000000002',
      'editor',
      true,
      '{}'::jsonb
    )
  $$,
  '42501',
  'Only a system administrator can change user access.',
  'an unassigned user cannot change access'
);

set local "request.jwt.claims" =
  '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(public.admin_user_directory() -> 'users') user_record
    where user_record ->> 'id' in (
      '92000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000003'
    )
  ),
  3,
  'a system administrator sees every profile created by this test'
);

select lives_ok(
  $$
    select public.admin_set_user_access(
      '92000000-0000-0000-0000-000000000002',
      'editor',
      true,
      '{
        "mou": {
          "view": true,
          "create": true,
          "update": true,
          "publish": false,
          "delete": false,
          "import": true
        }
      }'::jsonb
    )
  $$,
  'a system administrator can assign an editor'
);

select is(
  (
    select user_record ->> 'role'
    from jsonb_array_elements(
      public.admin_user_directory() -> 'users'
    ) user_record
    where user_record ->> 'id' =
      '92000000-0000-0000-0000-000000000002'
  ),
  'editor',
  'the selected role is stored'
);

select is(
  (
    select (
      user_record #>> '{modules,mou,import}'
    )::boolean
    from jsonb_array_elements(
      public.admin_user_directory() -> 'users'
    ) user_record
    where user_record ->> 'id' =
      '92000000-0000-0000-0000-000000000002'
  ),
  true,
  'explicit editor permissions are stored'
);

select lives_ok(
  $$
    select public.admin_set_user_access(
      '92000000-0000-0000-0000-000000000002',
      'viewer',
      true,
      '{"travel":{"view":true,"delete":true}}'::jsonb
    )
  $$,
  'a system administrator can change an editor to viewer'
);

select is(
  (
    select concat(
      user_record #>> '{modules,travel,view}',
      ':',
      user_record #>> '{modules,travel,delete}'
    )
    from jsonb_array_elements(
      public.admin_user_directory() -> 'users'
    ) user_record
    where user_record ->> 'id' =
      '92000000-0000-0000-0000-000000000002'
  ),
  'true:false',
  'viewer assignments retain view and discard mutation permissions'
);

select throws_ok(
  $$
    select public.admin_set_user_access(
      '92000000-0000-0000-0000-000000000001',
      'office_admin',
      true,
      '{}'::jsonb
    )
  $$,
  '42501',
  'You cannot remove your own system administrator access.',
  'a system administrator cannot demote themselves'
);

select throws_ok(
  $$
    select public.admin_set_user_access(
      '92000000-0000-0000-0000-000000000002',
      'editor',
      true,
      '{"unknown_module":{"view":true}}'::jsonb
    )
  $$,
  '22023',
  'Unknown module: unknown_module',
  'unknown modules are rejected'
);

select throws_ok(
  $$
    select public.admin_set_user_access(
      '92000000-0000-0000-0000-000000000002',
      'editor',
      true,
      '{"mou":{"approve":true}}'::jsonb
    )
  $$,
  '22023',
  'Unknown permission action for mou: approve',
  'unknown permission actions are rejected'
);

reset role;

select * from finish();
rollback;
