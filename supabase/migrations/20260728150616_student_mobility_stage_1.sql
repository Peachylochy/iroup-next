-- Student Mobility Stage 1: workflow-only internal writes.
-- Travel and staff-mobility keep their existing policies until their own workflow work.

alter table public.movement_cases
  alter column start_date drop not null,
  alter column end_date drop not null,
  alter column fiscal_year drop not null,
  add column departure_at timestamptz,
  add column return_at timestamptz,
  add column partner_name_snapshot text,
  add column country_name_snapshot text,
  drop constraint travel_dates_valid,
  add constraint movement_dates_valid check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  add constraint movement_datetimes_valid check (
    return_at is null or departure_at is null or return_at >= departure_at
  );

alter table public.movement_participants
  add column student_id_snapshot text,
  add column faculty_snapshot text,
  add column study_program_snapshot text,
  add column study_level_snapshot text,
  add column gender_snapshot text;

create table public.movement_workflow_events (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.movement_cases (id) on delete cascade,
  action text not null check (action in (
    'created', 'saved_draft', 'submitted_for_review', 'returned_to_draft',
    'approved', 'activated', 'completed', 'cancelled', 'deleted', 'restored'
  )),
  from_status public.workflow_status,
  to_status public.workflow_status,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict
);

create index movement_workflow_events_movement_created_idx
  on public.movement_workflow_events (movement_id, created_at desc);

alter table public.movement_workflow_events enable row level security;

create policy movement_workflow_events_authenticated_select
on public.movement_workflow_events for select to authenticated
using (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_workflow_events.movement_id
    and private.can_access_movement(movement_cases.category, 'view')
));

-- Block browser table writes only for student mobility. Existing categories are preserved.
drop policy movement_authenticated_insert on public.movement_cases;
drop policy movement_authenticated_update on public.movement_cases;
drop policy movement_authenticated_delete on public.movement_cases;

create policy movement_authenticated_insert
on public.movement_cases for insert to authenticated
with check (
  category <> 'student_mobility'::public.movement_category
  and private.can_access_movement(category, 'create')
  and (publication_status = 'draft' or private.can_access_movement(category, 'publish'))
);

create policy movement_authenticated_update
on public.movement_cases for update to authenticated
using (
  category <> 'student_mobility'::public.movement_category
  and private.can_access_movement(category, 'update')
  and (publication_status <> 'published' or private.can_access_movement(category, 'publish'))
)
with check (
  category <> 'student_mobility'::public.movement_category
  and private.can_access_movement(category, 'update')
  and (publication_status = 'draft' or private.can_access_movement(category, 'publish'))
);

create policy movement_authenticated_delete
on public.movement_cases for delete to authenticated
using (
  category <> 'student_mobility'::public.movement_category
  and private.can_access_movement(category, 'delete')
);

drop policy movement_participants_insert on public.movement_participants;
drop policy movement_participants_update on public.movement_participants;
drop policy movement_participants_delete on public.movement_participants;

create policy movement_participants_insert
on public.movement_participants for insert to authenticated
with check (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_participants.movement_id
    and movement_cases.category <> 'student_mobility'::public.movement_category
    and private.can_access_movement(movement_cases.category, 'update')
));

create policy movement_participants_update
on public.movement_participants for update to authenticated
using (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_participants.movement_id
    and movement_cases.category <> 'student_mobility'::public.movement_category
    and private.can_access_movement(movement_cases.category, 'update')
))
with check (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_participants.movement_id
    and movement_cases.category <> 'student_mobility'::public.movement_category
    and private.can_access_movement(movement_cases.category, 'update')
));

create policy movement_participants_delete
on public.movement_participants for delete to authenticated
using (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_participants.movement_id
    and movement_cases.category <> 'student_mobility'::public.movement_category
    and private.can_access_movement(movement_cases.category, 'delete')
));

drop policy movement_funding_insert on public.movement_funding;
drop policy movement_funding_update on public.movement_funding;
drop policy movement_funding_delete on public.movement_funding;

create policy movement_funding_insert
on public.movement_funding for insert to authenticated
with check (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_funding.movement_id
    and movement_cases.category <> 'student_mobility'::public.movement_category
    and private.can_access_movement(movement_cases.category, 'update')
));

create policy movement_funding_update
on public.movement_funding for update to authenticated
using (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_funding.movement_id
    and movement_cases.category <> 'student_mobility'::public.movement_category
    and private.can_access_movement(movement_cases.category, 'update')
))
with check (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_funding.movement_id
    and movement_cases.category <> 'student_mobility'::public.movement_category
    and private.can_access_movement(movement_cases.category, 'update')
));

create policy movement_funding_delete
on public.movement_funding for delete to authenticated
using (exists (
  select 1 from public.movement_cases
  where movement_cases.id = movement_funding.movement_id
    and movement_cases.category <> 'student_mobility'::public.movement_category
    and private.can_access_movement(movement_cases.category, 'delete')
));

create function private.student_mobility_require_permission(required_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_access_movement('student_mobility'::public.movement_category, required_action) then
    raise exception 'STUDENT_MOBILITY_FORBIDDEN'
      using errcode = '42501', detail = format('Missing student mobility %s permission.', required_action);
  end if;
end;
$$;

create function private.student_mobility_validate_ready_for_review(target_movement_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare movement_record public.movement_cases%rowtype;
begin
  select * into movement_record from public.movement_cases
  where id = target_movement_id and category = 'student_mobility' and deleted_at is null;
  if not found then raise exception 'STUDENT_MOBILITY_NOT_FOUND' using errcode = 'P0002'; end if;

  if nullif(btrim(movement_record.project_name), '') is null
    or nullif(btrim(movement_record.purpose), '') is null
    or movement_record.owner_unit_id is null
    or movement_record.start_date is null
    or movement_record.fiscal_year is null
    or movement_record.direction = 'not_applicable'::public.movement_direction then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Complete project, purpose, direction, owner unit, departure date, and fiscal year before submitting.';
  end if;

  if movement_record.direction in ('inbound'::public.movement_direction, 'outbound'::public.movement_direction)
    and movement_record.country_id is null then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Select a country for inbound or outbound mobility.';
  end if;

  if not exists (select 1 from public.movement_participants where movement_id = target_movement_id) then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Add at least one student participant before submitting.';
  end if;
end;
$$;

create function public.student_mobility_save_draft(
  target_movement_id uuid, expected_updated_at timestamptz, payload jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  movement_record public.movement_cases%rowtype;
  saved_movement public.movement_cases%rowtype;
  actor_id uuid := auth.uid();
  payload_project_name text := nullif(btrim(payload ->> 'project_name'), '');
  partner_snapshot text;
  country_snapshot text;
  action_name text;
begin
  if actor_id is null then raise exception 'STUDENT_MOBILITY_FORBIDDEN' using errcode = '42501'; end if;
  if payload_project_name is null then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED' using errcode = '23514', detail = 'A project name is required to save a draft.';
  end if;

  select coalesce(nullif(btrim(name_en), ''), nullif(btrim(name_th), '')) into partner_snapshot
  from public.partner_organizations where id = nullif(payload ->> 'partner_organization_id', '')::uuid;
  select coalesce(nullif(btrim(name_en), ''), nullif(btrim(name_th), '')) into country_snapshot
  from public.countries where id = nullif(payload ->> 'country_id', '')::uuid;

  if target_movement_id is null then
    perform private.student_mobility_require_permission('create');
    insert into public.movement_cases (
      category, direction, project_name, title_en, purpose, country_id, city,
      partner_organization_id, partner_name_snapshot, country_name_snapshot,
      owner_unit_id, activity_type, mobility_mode, participant_group, study_level,
      approval_reference, start_date, end_date, departure_at, return_at, fiscal_year,
      status, workflow_status, publication_status, public_visible, internal_note, created_by, updated_by
    ) values (
      'student_mobility', coalesce(nullif(payload ->> 'direction', '')::public.movement_direction, 'outbound'),
      payload_project_name, nullif(btrim(payload ->> 'title_en'), ''), nullif(btrim(payload ->> 'purpose'), ''),
      nullif(payload ->> 'country_id', '')::uuid, nullif(btrim(payload ->> 'city'), ''),
      nullif(payload ->> 'partner_organization_id', '')::uuid,
      coalesce(nullif(btrim(payload ->> 'partner_name_snapshot'), ''), partner_snapshot),
      coalesce(nullif(btrim(payload ->> 'country_name_snapshot'), ''), country_snapshot),
      nullif(payload ->> 'owner_unit_id', '')::uuid, nullif(btrim(payload ->> 'activity_type'), ''),
      nullif(btrim(payload ->> 'mobility_mode'), ''), nullif(btrim(payload ->> 'participant_group'), ''),
      nullif(btrim(payload ->> 'study_level'), ''), nullif(btrim(payload ->> 'approval_reference'), ''),
      nullif(payload ->> 'start_date', '')::date, nullif(payload ->> 'end_date', '')::date,
      nullif(payload ->> 'departure_at', '')::timestamptz, nullif(payload ->> 'return_at', '')::timestamptz,
      nullif(payload ->> 'fiscal_year', '')::integer, 'planned', 'draft', 'draft', false,
      nullif(btrim(payload ->> 'internal_note'), ''), actor_id, actor_id
    ) returning * into saved_movement;
    action_name := 'created';
  else
    perform private.student_mobility_require_permission('update');
    select * into movement_record from public.movement_cases
    where id = target_movement_id and category = 'student_mobility' and deleted_at is null for update;
    if not found then raise exception 'STUDENT_MOBILITY_NOT_FOUND' using errcode = 'P0002'; end if;
    if movement_record.workflow_status <> 'draft' then
      raise exception 'STUDENT_MOBILITY_INVALID_TRANSITION' using errcode = '23514', detail = 'Only a draft can be edited.';
    end if;
    if expected_updated_at is null or movement_record.updated_at <> expected_updated_at then
      raise exception 'STUDENT_MOBILITY_CONFLICT' using errcode = '40001';
    end if;
    update public.movement_cases set
      direction = coalesce(nullif(payload ->> 'direction', '')::public.movement_direction, direction),
      project_name = payload_project_name, title_en = nullif(btrim(payload ->> 'title_en'), ''),
      purpose = nullif(btrim(payload ->> 'purpose'), ''), country_id = nullif(payload ->> 'country_id', '')::uuid,
      city = nullif(btrim(payload ->> 'city'), ''), partner_organization_id = nullif(payload ->> 'partner_organization_id', '')::uuid,
      partner_name_snapshot = coalesce(nullif(btrim(payload ->> 'partner_name_snapshot'), ''), partner_snapshot),
      country_name_snapshot = coalesce(nullif(btrim(payload ->> 'country_name_snapshot'), ''), country_snapshot),
      owner_unit_id = nullif(payload ->> 'owner_unit_id', '')::uuid, activity_type = nullif(btrim(payload ->> 'activity_type'), ''),
      mobility_mode = nullif(btrim(payload ->> 'mobility_mode'), ''), participant_group = nullif(btrim(payload ->> 'participant_group'), ''),
      study_level = nullif(btrim(payload ->> 'study_level'), ''), approval_reference = nullif(btrim(payload ->> 'approval_reference'), ''),
      start_date = nullif(payload ->> 'start_date', '')::date, end_date = nullif(payload ->> 'end_date', '')::date,
      departure_at = nullif(payload ->> 'departure_at', '')::timestamptz, return_at = nullif(payload ->> 'return_at', '')::timestamptz,
      fiscal_year = nullif(payload ->> 'fiscal_year', '')::integer, internal_note = nullif(btrim(payload ->> 'internal_note'), ''), updated_by = actor_id
    where id = target_movement_id returning * into saved_movement;
    action_name := 'saved_draft';
  end if;

  insert into public.movement_workflow_events (movement_id, action, from_status, to_status, created_by)
  values (saved_movement.id, action_name,
    case when action_name = 'created' then null else 'draft'::public.workflow_status end,
    'draft', actor_id);
  return jsonb_build_object('id', saved_movement.id, 'status', saved_movement.status,
    'workflow_status', saved_movement.workflow_status, 'updated_at', saved_movement.updated_at);
end;
$$;

create function public.student_mobility_replace_participants(
  target_movement_id uuid, expected_updated_at timestamptz, participants jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare movement_record public.movement_cases%rowtype; actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'STUDENT_MOBILITY_FORBIDDEN' using errcode = '42501'; end if;
  perform private.student_mobility_require_permission('update');
  if jsonb_typeof(participants) <> 'array' then raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED' using errcode = '23514', detail = 'Participants must be an array.'; end if;
  select * into movement_record from public.movement_cases
  where id = target_movement_id and category = 'student_mobility' and deleted_at is null for update;
  if not found then raise exception 'STUDENT_MOBILITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if movement_record.workflow_status <> 'draft' then raise exception 'STUDENT_MOBILITY_INVALID_TRANSITION' using errcode = '23514'; end if;
  if expected_updated_at is null or movement_record.updated_at <> expected_updated_at then raise exception 'STUDENT_MOBILITY_CONFLICT' using errcode = '40001'; end if;
  if exists (select 1 from jsonb_to_recordset(participants) as p(full_name_snapshot text) where nullif(btrim(p.full_name_snapshot), '') is null) then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED' using errcode = '23514', detail = 'Each participant needs a full name.';
  end if;
  delete from public.movement_participants where movement_id = target_movement_id;
  insert into public.movement_participants (
    movement_id, person_id, person_source, full_name_snapshot, organization_unit_id_snapshot,
    organization_unit_name_snapshot, position_snapshot, participant_role, arrival_date, departure_date,
    home_organization_name_snapshot, host_organization_name_snapshot, student_id_snapshot, faculty_snapshot,
    study_program_snapshot, study_level_snapshot, gender_snapshot, created_by, updated_by
  ) select target_movement_id, p.person_id, coalesce(p.person_source, 'student'::public.person_type),
    nullif(btrim(p.full_name_snapshot), ''), p.organization_unit_id_snapshot, nullif(btrim(p.organization_unit_name_snapshot), ''),
    nullif(btrim(p.position_snapshot), ''), nullif(btrim(p.participant_role), ''), p.arrival_date, p.departure_date,
    nullif(btrim(p.home_organization_name_snapshot), ''), nullif(btrim(p.host_organization_name_snapshot), ''),
    nullif(btrim(p.student_id_snapshot), ''), nullif(btrim(p.faculty_snapshot), ''), nullif(btrim(p.study_program_snapshot), ''),
    nullif(btrim(p.study_level_snapshot), ''), nullif(btrim(p.gender_snapshot), ''), actor_id, actor_id
  from jsonb_to_recordset(participants) as p(
    person_id uuid, person_source public.person_type, full_name_snapshot text, organization_unit_id_snapshot uuid,
    organization_unit_name_snapshot text, position_snapshot text, participant_role text, arrival_date date, departure_date date,
    home_organization_name_snapshot text, host_organization_name_snapshot text, student_id_snapshot text,
    faculty_snapshot text, study_program_snapshot text, study_level_snapshot text, gender_snapshot text
  );
  update public.movement_cases set updated_by = actor_id where id = target_movement_id returning * into movement_record;
  insert into public.movement_workflow_events (movement_id, action, from_status, to_status, created_by)
  values (target_movement_id, 'saved_draft', 'draft', 'draft', actor_id);
  return jsonb_build_object('id', movement_record.id, 'updated_at', movement_record.updated_at, 'participant_count', movement_record.participant_count);
end;
$$;

create function public.student_mobility_replace_funding(
  target_movement_id uuid, expected_updated_at timestamptz, funding jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare movement_record public.movement_cases%rowtype; actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'STUDENT_MOBILITY_FORBIDDEN' using errcode = '42501'; end if;
  perform private.student_mobility_require_permission('update');
  if jsonb_typeof(funding) <> 'array' then raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED' using errcode = '23514', detail = 'Funding must be an array.'; end if;
  select * into movement_record from public.movement_cases
  where id = target_movement_id and category = 'student_mobility' and deleted_at is null for update;
  if not found then raise exception 'STUDENT_MOBILITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if movement_record.workflow_status <> 'draft' then raise exception 'STUDENT_MOBILITY_INVALID_TRANSITION' using errcode = '23514'; end if;
  if expected_updated_at is null or movement_record.updated_at <> expected_updated_at then raise exception 'STUDENT_MOBILITY_CONFLICT' using errcode = '40001'; end if;
  delete from public.movement_funding where movement_id = target_movement_id;
  insert into public.movement_funding (
    movement_id, budget_type, budget_type_id, source_unit_id, source_name,
    amount, currency, note, created_by, updated_by
  ) select target_movement_id, coalesce(nullif(btrim(f.budget_type), ''), 'unspecified'),
    f.budget_type_id, f.source_unit_id, nullif(btrim(f.source_name), ''), f.amount,
    coalesce(nullif(btrim(f.currency), ''), 'THB'), nullif(btrim(f.note), ''), actor_id, actor_id
  from jsonb_to_recordset(funding) as f(
    budget_type text, budget_type_id uuid, source_unit_id uuid, source_name text,
    amount numeric, currency text, note text
  );
  update public.movement_cases set updated_by = actor_id where id = target_movement_id returning * into movement_record;
  insert into public.movement_workflow_events (movement_id, action, from_status, to_status, created_by)
  values (target_movement_id, 'saved_draft', 'draft', 'draft', actor_id);
  return jsonb_build_object('id', movement_record.id, 'updated_at', movement_record.updated_at);
end;
$$;

create function private.student_mobility_transition(
  target_movement_id uuid, expected_updated_at timestamptz, required_action text,
  expected_from public.workflow_status, target_status public.workflow_status, action_name text, transition_note text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare movement_record public.movement_cases%rowtype; saved_movement public.movement_cases%rowtype; actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'STUDENT_MOBILITY_FORBIDDEN' using errcode = '42501'; end if;
  perform private.student_mobility_require_permission(required_action);
  select * into movement_record from public.movement_cases
  where id = target_movement_id and category = 'student_mobility' and deleted_at is null for update;
  if not found then raise exception 'STUDENT_MOBILITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if movement_record.workflow_status <> expected_from then raise exception 'STUDENT_MOBILITY_INVALID_TRANSITION' using errcode = '23514'; end if;
  if expected_updated_at is null or movement_record.updated_at <> expected_updated_at then raise exception 'STUDENT_MOBILITY_CONFLICT' using errcode = '40001'; end if;
  update public.movement_cases set workflow_status = target_status,
    status = case target_status when 'active' then 'ongoing' when 'completed' then 'completed' when 'cancelled' then 'cancelled' else 'planned' end,
    publication_status = 'draft', public_visible = false, updated_by = actor_id
  where id = target_movement_id returning * into saved_movement;
  insert into public.movement_workflow_events (movement_id, action, from_status, to_status, note, created_by)
  values (target_movement_id, action_name, expected_from, target_status, nullif(btrim(transition_note), ''), actor_id);
  return jsonb_build_object('id', saved_movement.id, 'status', saved_movement.status,
    'workflow_status', saved_movement.workflow_status, 'updated_at', saved_movement.updated_at);
end;
$$;

create function public.student_mobility_submit_for_review(target_movement_id uuid, expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.student_mobility_validate_ready_for_review(target_movement_id);
  return private.student_mobility_transition(target_movement_id, expected_updated_at, 'update', 'draft', 'under_review', 'submitted_for_review');
end;
$$;

create function public.student_mobility_return_to_draft(target_movement_id uuid, expected_updated_at timestamptz, return_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.student_mobility_transition(target_movement_id, expected_updated_at, 'publish', 'under_review', 'draft', 'returned_to_draft', return_note);
end;
$$;

create function public.student_mobility_approve(target_movement_id uuid, expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.student_mobility_transition(target_movement_id, expected_updated_at, 'publish', 'under_review', 'approved', 'approved');
end;
$$;

create function public.student_mobility_activate(target_movement_id uuid, expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.student_mobility_transition(target_movement_id, expected_updated_at, 'update', 'approved', 'active', 'activated');
end;
$$;

create function public.student_mobility_complete(target_movement_id uuid, expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.student_mobility_transition(target_movement_id, expected_updated_at, 'update', 'active', 'completed', 'completed');
end;
$$;

revoke all on function private.student_mobility_require_permission(text) from public, anon, authenticated;
revoke all on function private.student_mobility_validate_ready_for_review(uuid) from public, anon, authenticated;
revoke all on function private.student_mobility_transition(uuid, timestamptz, text, public.workflow_status, public.workflow_status, text, text) from public, anon, authenticated;
revoke all on function public.student_mobility_save_draft(uuid, timestamptz, jsonb) from public, anon;
revoke all on function public.student_mobility_replace_participants(uuid, timestamptz, jsonb) from public, anon;
revoke all on function public.student_mobility_replace_funding(uuid, timestamptz, jsonb) from public, anon;
revoke all on function public.student_mobility_submit_for_review(uuid, timestamptz) from public, anon;
revoke all on function public.student_mobility_return_to_draft(uuid, timestamptz, text) from public, anon;
revoke all on function public.student_mobility_approve(uuid, timestamptz) from public, anon;
revoke all on function public.student_mobility_activate(uuid, timestamptz) from public, anon;
revoke all on function public.student_mobility_complete(uuid, timestamptz) from public, anon;

grant execute on function public.student_mobility_save_draft(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.student_mobility_replace_participants(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.student_mobility_replace_funding(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.student_mobility_submit_for_review(uuid, timestamptz) to authenticated;
grant execute on function public.student_mobility_return_to_draft(uuid, timestamptz, text) to authenticated;
grant execute on function public.student_mobility_approve(uuid, timestamptz) to authenticated;
grant execute on function public.student_mobility_activate(uuid, timestamptz) to authenticated;
grant execute on function public.student_mobility_complete(uuid, timestamptz) to authenticated;
grant select on public.movement_workflow_events to authenticated;
