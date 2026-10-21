begin;

create extension if not exists pgtap with schema extensions;
select plan(3);

select has_function(
  'public',
  'commit_master_import_batch',
  array['uuid'],
  'master import commit RPC exists'
);

select ok(
  not has_function_privilege('anon', 'public.commit_master_import_batch(uuid)', 'EXECUTE'),
  'anonymous users cannot commit a master batch'
);

select ok(
  has_function_privilege('authenticated', 'public.commit_master_import_batch(uuid)', 'EXECUTE'),
  'authenticated calls are allowed for the RPC guard to evaluate the caller'
);

-- System Admin vs Office Admin authorization is exercised behaviorally in
-- stability_access_guards_test.sql and stability_import_integrity_test.sql.

select * from finish();
rollback;
