begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select ok(
  has_table_privilege('authenticated', 'public.organization_units', 'INSERT'),
  'authenticated role has INSERT privilege so the System Admin RLS policy can be evaluated'
);

select ok(
  not has_table_privilege('anon', 'public.organization_units', 'INSERT'),
  'anonymous role cannot insert organization units'
);

select * from finish();

rollback;
