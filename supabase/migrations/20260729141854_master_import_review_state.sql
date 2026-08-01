-- Review is separate from validation: a reviewer may approve an update,
-- deliberately skip it, or leave it needing correction without touching a
-- master table.
create type public.import_review_status as enum (
  'pending',
  'approved',
  'skipped',
  'needs_fix'
);

alter table public.import_rows
  add column review_status public.import_review_status not null default 'pending',
  add column review_note text,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id) on delete set null;

create index import_rows_master_review_idx
  on public.import_rows (batch_id, review_status, master_entity, row_number);
