begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_function(
  'public',
  'current_user_access',
  array[]::text[],
  'current user access function exists'
);

select ok(
  not has_function_privilege('anon', 'public.current_user_access()', 'EXECUTE'),
  'anonymous users cannot execute the access function'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_user_access()',
    'EXECUTE'
  ),
  'authenticated users can execute the access function'
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
    '91000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'access-editor@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Access Editor"}',
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'access-unassigned@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Access Unassigned"}',
    now(),
    now()
  );

insert into private.user_roles (user_id, role)
values ('91000000-0000-0000-0000-000000000001', 'editor');

insert into private.module_permissions (
  user_id,
  module,
  can_view,
  can_create,
  can_update,
  can_import
)
values (
  '91000000-0000-0000-0000-000000000001',
  'mou',
  true,
  true,
  true,
  true
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  public.current_user_access() #>> '{profile,display_name}',
  'Access Editor',
  'the current user sees their own profile'
);

select is(
  public.current_user_access() #>> '{roles,0}',
  'editor',
  'the current user sees their assigned role'
);

select is(
  (public.current_user_access() #>> '{modules,mou,view}')::boolean,
  true,
  'the current user sees effective MOU view permission'
);

select is(
  (public.current_user_access() #>> '{modules,travel,view}')::boolean,
  false,
  'unassigned modules remain denied'
);

set local "request.jwt.claims" =
  '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  jsonb_array_length(public.current_user_access() -> 'roles'),
  0,
  'an unassigned user has no roles'
);

select is(
  (
    select bool_or(value::boolean)
    from jsonb_each_text(
      public.current_user_access() -> 'modules' -> 'mou'
    )
  ),
  false,
  'an unassigned user has no MOU actions'
);

reset role;

select * from finish();
rollback;
