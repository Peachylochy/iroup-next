-- MOU writes are workflow-controlled. Browser clients call the public RPCs
-- below instead of mutating agreements and their relations directly.

alter table public.agreements
  add column workflow_status public.workflow_status;

update public.agreements
set workflow_status = case
  when publication_status = 'published' and status = 'active' then 'active'::public.workflow_status
  when publication_status = 'archived' then 'archived'::public.workflow_status
  else 'draft'::public.workflow_status
end
where workflow_status is null;

alter table public.agreements
  alter column agreement_type drop not null,
  alter column start_date drop not null,
  alter column fiscal_year drop not null,
  alter column workflow_status set default 'draft',
  alter column workflow_status set not null,
  add constraint published_agreement_requires_active_workflow check (
    publication_status <> 'published'
    or (
      public_visible
      and status = 'active'
      and workflow_status = 'active'
    )
  );

create unique index agreements_number_not_deleted_unique
  on public.agreements (nullif(btrim(agreement_number), ''))
  where deleted_at is null
    and nullif(btrim(agreement_number), '') is not null;

create table public.agreement_workflow_events (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null
    references public.agreements (id) on delete cascade,
  action text not null check (
    action in (
      'created',
      'saved_draft',
      'submitted_for_review',
      'returned_to_draft',
      'published',
      'archived',
      'terminated'
    )
  ),
  from_status public.workflow_status,
  to_status public.workflow_status not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict
);

create index agreement_workflow_events_agreement_created_idx
  on public.agreement_workflow_events (agreement_id, created_at desc);

alter table public.agreement_workflow_events enable row level security;

create policy agreement_workflow_events_authenticated_select
on public.agreement_workflow_events for select
to authenticated
using (private.can_access_module('mou', 'view'));

drop policy agreements_authenticated_insert on public.agreements;
drop policy agreements_authenticated_update on public.agreements;
drop policy agreements_authenticated_delete on public.agreements;
drop policy agreement_partners_authenticated_insert on public.agreement_partners;
drop policy agreement_partners_authenticated_update on public.agreement_partners;
drop policy agreement_partners_authenticated_delete on public.agreement_partners;
drop policy agreement_units_authenticated_insert on public.agreement_units;
drop policy agreement_units_authenticated_update on public.agreement_units;
drop policy agreement_units_authenticated_delete on public.agreement_units;

create function private.mou_require_permission(required_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_access_module('mou', required_action) then
    raise exception 'MOU_FORBIDDEN'
      using errcode = '42501',
        detail = format('Missing MOU %s permission.', required_action);
  end if;
end;
$$;

create function private.mou_validate_ready_for_review(
  target_agreement_id uuid,
  require_signed_date boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
begin
  select *
  into agreement_record
  from public.agreements
  where id = target_agreement_id
    and deleted_at is null;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;

  if nullif(btrim(agreement_record.title_th), '') is null
    or nullif(btrim(agreement_record.agreement_type), '') is null
    or agreement_record.start_date is null
    or agreement_record.fiscal_year is null then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514',
        detail = 'Complete title, type, start date, and fiscal year before submitting.';
  end if;

  if require_signed_date and agreement_record.signed_date is null then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514',
        detail = 'A signed date is required before publishing.';
  end if;

  if not exists (
    select 1
    from public.agreement_partners
    where agreement_id = target_agreement_id
  ) or (
    select count(*)
    from public.agreement_partners
    where agreement_id = target_agreement_id
      and is_lead
  ) <> 1 then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514',
        detail = 'Select partners and exactly one lead partner before submitting.';
  end if;

  if (
    select count(*)
    from public.agreement_units
    where agreement_id = target_agreement_id
      and is_owner
  ) <> 1 then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514',
        detail = 'Select exactly one owner unit before submitting.';
  end if;
end;
$$;

create function public.mou_save_draft(
  target_agreement_id uuid,
  expected_updated_at timestamptz,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
  saved_agreement public.agreements%rowtype;
  actor_id uuid := auth.uid();
  payload_title text := nullif(btrim(payload ->> 'title_th'), '');
  payload_partners jsonb := payload -> 'partners';
  payload_units jsonb := payload -> 'units';
  lead_partner_count integer;
  owner_unit_count integer;
  action_name text;
begin
  if actor_id is null then
    raise exception 'MOU_FORBIDDEN' using errcode = '42501';
  end if;

  if payload_title is null then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514', detail = 'A Thai MOU title is required to save a draft.';
  end if;

  if target_agreement_id is null then
    perform private.mou_require_permission('create');

    insert into public.agreements (
      agreement_number,
      title_th,
      title_en,
      agreement_type,
      signed_date,
      start_date,
      end_date,
      fiscal_year,
      internal_note,
      status,
      workflow_status,
      publication_status,
      public_visible,
      created_by,
      updated_by
    )
    values (
      nullif(btrim(payload ->> 'agreement_number'), ''),
      payload_title,
      nullif(btrim(payload ->> 'title_en'), ''),
      nullif(btrim(payload ->> 'agreement_type'), ''),
      nullif(payload ->> 'signed_date', '')::date,
      nullif(payload ->> 'start_date', '')::date,
      nullif(payload ->> 'end_date', '')::date,
      nullif(payload ->> 'fiscal_year', '')::integer,
      nullif(btrim(payload ->> 'internal_note'), ''),
      'draft',
      'draft',
      'draft',
      false,
      actor_id,
      actor_id
    )
    returning * into saved_agreement;

    action_name := 'created';
  else
    perform private.mou_require_permission('update');

    select *
    into agreement_record
    from public.agreements
    where id = target_agreement_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
    end if;

    if agreement_record.workflow_status <> 'draft' then
      raise exception 'MOU_INVALID_TRANSITION'
        using errcode = '23514', detail = 'Only a draft MOU can be edited.';
    end if;

    if expected_updated_at is null
      or agreement_record.updated_at <> expected_updated_at then
      raise exception 'MOU_CONFLICT'
        using errcode = '40001', detail = 'The MOU was changed by another user.';
    end if;

    update public.agreements
    set
      agreement_number = nullif(btrim(payload ->> 'agreement_number'), ''),
      title_th = payload_title,
      title_en = nullif(btrim(payload ->> 'title_en'), ''),
      agreement_type = nullif(btrim(payload ->> 'agreement_type'), ''),
      signed_date = nullif(payload ->> 'signed_date', '')::date,
      start_date = nullif(payload ->> 'start_date', '')::date,
      end_date = nullif(payload ->> 'end_date', '')::date,
      fiscal_year = nullif(payload ->> 'fiscal_year', '')::integer,
      internal_note = nullif(btrim(payload ->> 'internal_note'), ''),
      updated_by = actor_id
    where id = target_agreement_id
    returning * into saved_agreement;

    action_name := 'saved_draft';
  end if;

  if payload_partners is not null then
    if jsonb_typeof(payload_partners) <> 'array' then
      raise exception 'MOU_VALIDATION_FAILED'
        using errcode = '23514', detail = 'Partners must be an array.';
    end if;

    select count(*)
    into lead_partner_count
    from jsonb_to_recordset(payload_partners) as partner(id uuid, is_lead boolean)
    where coalesce(partner.is_lead, false);

    if lead_partner_count > 1 then
      raise exception 'MOU_VALIDATION_FAILED'
        using errcode = '23514', detail = 'Only one lead partner is allowed.';
    end if;

    delete from public.agreement_partners
    where agreement_id = saved_agreement.id;

    insert into public.agreement_partners (
      agreement_id,
      partner_organization_id,
      is_lead,
      created_by
    )
    select
      saved_agreement.id,
      partner.id,
      coalesce(partner.is_lead, false),
      actor_id
    from jsonb_to_recordset(payload_partners) as partner(id uuid, is_lead boolean);
  end if;

  if payload_units is not null then
    if jsonb_typeof(payload_units) <> 'array' then
      raise exception 'MOU_VALIDATION_FAILED'
        using errcode = '23514', detail = 'Units must be an array.';
    end if;

    select count(*)
    into owner_unit_count
    from jsonb_to_recordset(payload_units) as unit(id uuid, is_owner boolean)
    where coalesce(unit.is_owner, false);

    if owner_unit_count > 1 then
      raise exception 'MOU_VALIDATION_FAILED'
        using errcode = '23514', detail = 'Only one owner unit is allowed.';
    end if;

    delete from public.agreement_units
    where agreement_id = saved_agreement.id;

    insert into public.agreement_units (
      agreement_id,
      organization_unit_id,
      is_owner,
      created_by
    )
    select
      saved_agreement.id,
      unit.id,
      coalesce(unit.is_owner, false),
      actor_id
    from jsonb_to_recordset(payload_units) as unit(id uuid, is_owner boolean);
  end if;

  insert into public.agreement_workflow_events (
    agreement_id,
    action,
    from_status,
    to_status,
    created_by
  )
  values (
    saved_agreement.id,
    action_name,
    case when action_name = 'created' then null else 'draft'::public.workflow_status end,
    'draft',
    actor_id
  );

  return jsonb_build_object(
    'id', saved_agreement.id,
    'status', saved_agreement.status,
    'workflow_status', saved_agreement.workflow_status,
    'publication_status', saved_agreement.publication_status,
    'updated_at', saved_agreement.updated_at
  );
end;
$$;

create function public.mou_submit_for_review(
  target_agreement_id uuid,
  expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
  saved_agreement public.agreements%rowtype;
  actor_id uuid := auth.uid();
begin
  perform private.mou_require_permission('update');

  select *
  into agreement_record
  from public.agreements
  where id = target_agreement_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;

  if agreement_record.workflow_status <> 'draft' then
    raise exception 'MOU_INVALID_TRANSITION'
      using errcode = '23514', detail = 'Only a draft MOU can be submitted.';
  end if;

  if expected_updated_at is null
    or agreement_record.updated_at <> expected_updated_at then
    raise exception 'MOU_CONFLICT'
      using errcode = '40001', detail = 'The MOU was changed by another user.';
  end if;

  perform private.mou_validate_ready_for_review(target_agreement_id, false);

  update public.agreements
  set
    workflow_status = 'under_review',
    status = 'draft',
    publication_status = 'draft',
    public_visible = false,
    updated_by = actor_id
  where id = target_agreement_id
  returning * into saved_agreement;

  insert into public.agreement_workflow_events (
    agreement_id,
    action,
    from_status,
    to_status,
    created_by
  ) values (
    target_agreement_id,
    'submitted_for_review',
    'draft',
    'under_review',
    actor_id
  );

  return jsonb_build_object(
    'id', saved_agreement.id,
    'status', saved_agreement.status,
    'workflow_status', saved_agreement.workflow_status,
    'publication_status', saved_agreement.publication_status,
    'updated_at', saved_agreement.updated_at
  );
end;
$$;

create function public.mou_return_to_draft(
  target_agreement_id uuid,
  expected_updated_at timestamptz,
  return_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
  saved_agreement public.agreements%rowtype;
  actor_id uuid := auth.uid();
begin
  perform private.mou_require_permission('publish');

  select *
  into agreement_record
  from public.agreements
  where id = target_agreement_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;

  if agreement_record.workflow_status <> 'under_review' then
    raise exception 'MOU_INVALID_TRANSITION'
      using errcode = '23514', detail = 'Only a submitted MOU can be returned.';
  end if;

  if expected_updated_at is null
    or agreement_record.updated_at <> expected_updated_at then
    raise exception 'MOU_CONFLICT'
      using errcode = '40001', detail = 'The MOU was changed by another user.';
  end if;

  update public.agreements
  set workflow_status = 'draft', updated_by = actor_id
  where id = target_agreement_id
  returning * into saved_agreement;

  insert into public.agreement_workflow_events (
    agreement_id, action, from_status, to_status, note, created_by
  ) values (
    target_agreement_id, 'returned_to_draft', 'under_review', 'draft',
    nullif(btrim(return_note), ''), actor_id
  );

  return jsonb_build_object(
    'id', saved_agreement.id,
    'workflow_status', saved_agreement.workflow_status,
    'updated_at', saved_agreement.updated_at
  );
end;
$$;

create function public.mou_publish(
  target_agreement_id uuid,
  expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
  saved_agreement public.agreements%rowtype;
  actor_id uuid := auth.uid();
begin
  perform private.mou_require_permission('publish');

  select *
  into agreement_record
  from public.agreements
  where id = target_agreement_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;

  if agreement_record.workflow_status <> 'under_review' then
    raise exception 'MOU_INVALID_TRANSITION'
      using errcode = '23514', detail = 'Only a submitted MOU can be published.';
  end if;

  if expected_updated_at is null
    or agreement_record.updated_at <> expected_updated_at then
    raise exception 'MOU_CONFLICT'
      using errcode = '40001', detail = 'The MOU was changed by another user.';
  end if;

  perform private.mou_validate_ready_for_review(target_agreement_id, true);

  update public.agreements
  set
    workflow_status = 'active',
    status = 'active',
    publication_status = 'published',
    public_visible = true,
    updated_by = actor_id
  where id = target_agreement_id
  returning * into saved_agreement;

  insert into public.agreement_workflow_events (
    agreement_id, action, from_status, to_status, created_by
  ) values (
    target_agreement_id, 'published', 'under_review', 'active', actor_id
  );

  return jsonb_build_object(
    'id', saved_agreement.id,
    'status', saved_agreement.status,
    'workflow_status', saved_agreement.workflow_status,
    'publication_status', saved_agreement.publication_status,
    'updated_at', saved_agreement.updated_at
  );
end;
$$;

revoke all on function private.mou_require_permission(text)
  from public, anon, authenticated;
revoke all on function private.mou_validate_ready_for_review(uuid, boolean)
  from public, anon, authenticated;

revoke all on function public.mou_save_draft(uuid, timestamptz, jsonb)
  from public, anon;
revoke all on function public.mou_submit_for_review(uuid, timestamptz)
  from public, anon;
revoke all on function public.mou_return_to_draft(uuid, timestamptz, text)
  from public, anon;
revoke all on function public.mou_publish(uuid, timestamptz)
  from public, anon;

grant execute on function public.mou_save_draft(uuid, timestamptz, jsonb)
  to authenticated;
grant execute on function public.mou_submit_for_review(uuid, timestamptz)
  to authenticated;
grant execute on function public.mou_return_to_draft(uuid, timestamptz, text)
  to authenticated;
grant execute on function public.mou_publish(uuid, timestamptz)
  to authenticated;

grant select on public.agreement_workflow_events to authenticated;
