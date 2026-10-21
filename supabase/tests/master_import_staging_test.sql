begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select has_type('public', 'import_kind', 'import kind enum exists');
select has_type('public', 'master_entity_type', 'master entity enum exists');
select has_column('public', 'import_batches', 'import_kind', 'master batches are labelled');
select has_column('public', 'import_rows', 'master_entity', 'master rows are labelled');
-- Actual staging reads/writes for active, inactive and revoked callers are
-- exercised in stability_access_guards_test.sql instead of matching SQL text.

select * from finish();
rollback;
