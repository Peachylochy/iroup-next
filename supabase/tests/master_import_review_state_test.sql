begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select has_type('public', 'import_review_status', 'review status enum exists');
select has_column('public', 'import_rows', 'review_status', 'rows retain a review decision');
select has_column('public', 'import_rows', 'reviewed_by', 'reviewer is recorded');
select col_has_default('public', 'import_rows', 'review_status', 'review state starts pending');

select * from finish();
rollback;
