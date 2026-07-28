begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select ok(
  has_table_privilege('authenticated', 'public.countries', 'INSERT'),
  'authenticated role has INSERT privilege so the System Admin RLS policy can be evaluated'
);

select ok(
  not has_table_privilege('anon', 'public.countries', 'INSERT'),
  'anonymous role cannot insert countries'
);

select * from finish();

rollback;
