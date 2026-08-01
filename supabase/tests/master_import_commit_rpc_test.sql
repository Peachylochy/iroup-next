begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

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

select ok(
  exists (
    select 1
    from pg_proc
    where oid = 'public.commit_master_import_batch(uuid)'::regprocedure
      and prosrc like '%private.is_admin()%'
  ),
  'commit RPC checks System Admin access'
);

select * from finish();
rollback;
