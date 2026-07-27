-- Automatic file purge is deliberately out of scope. Soft-deleted MOU records
-- and any future internal attachments remain recoverable until a later, approved
-- records-retention policy replaces this behavior.

create or replace function public.mou_soft_delete(
  target_agreement_id uuid,
  expected_updated_at timestamptz,
  delete_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
  actor_id uuid := auth.uid();
begin
  perform private.mou_require_permission('delete');

  select * into agreement_record
  from public.agreements
  where id = target_agreement_id and deleted_at is null
  for update;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;
  if expected_updated_at is null or agreement_record.updated_at <> expected_updated_at then
    raise exception 'MOU_CONFLICT' using errcode = '40001';
  end if;

  update public.agreements
  set deleted_at = now(), deleted_by = actor_id, public_visible = false,
      publication_status = 'archived', workflow_status = 'archived', updated_by = actor_id
  where id = target_agreement_id;

  insert into public.agreement_workflow_events (
    agreement_id, action, from_status, to_status, note, created_by
  ) values (
    target_agreement_id, 'deleted', agreement_record.workflow_status, 'archived',
    nullif(btrim(delete_note), ''), actor_id
  );

  return jsonb_build_object('id', target_agreement_id);
end;
$$;

create or replace function public.mou_restore(target_agreement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
  actor_id uuid := auth.uid();
begin
  if not private.is_admin() then
    raise exception 'MOU_FORBIDDEN' using errcode = '42501';
  end if;

  select * into agreement_record
  from public.agreements
  where id = target_agreement_id and deleted_at is not null
  for update;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.agreements
  set deleted_at = null, deleted_by = null, workflow_status = 'draft',
      status = 'draft', publication_status = 'draft', public_visible = false,
      updated_by = actor_id
  where id = target_agreement_id;

  insert into public.agreement_workflow_events (
    agreement_id, action, from_status, to_status, created_by
  ) values (target_agreement_id, 'restored', 'archived', 'draft', actor_id);

  return jsonb_build_object('id', target_agreement_id, 'workflow_status', 'draft');
end;
$$;
