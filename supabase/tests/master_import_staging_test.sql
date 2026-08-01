begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

select has_type('public', 'import_kind', 'import kind enum exists');
select has_type('public', 'master_entity_type', 'master entity enum exists');
select has_column('public', 'import_batches', 'import_kind', 'master batches are labelled');
select has_column('public', 'import_rows', 'master_entity', 'master rows are labelled');
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'import_batches'
      and policyname = 'import_batches_internal_insert'
      and with_check like '%private.is_admin()%'
  ),
  'master batch insert policy requires System Admin'
);

select * from finish();
rollback;
