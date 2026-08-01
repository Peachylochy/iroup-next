-- Participant and funding writes are part of one draft save, but they are
-- useful audit events in their own right. Give them distinct action names so
-- the detail timeline does not render three indistinguishable "draft" rows.
create or replace function public.student_mobility_replace_participants(
  target_movement_id uuid, expected_updated_at timestamptz, participants jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  movement_record public.movement_cases%rowtype;
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'STUDENT_MOBILITY_FORBIDDEN' using errcode = '42501';
  end if;

  perform private.student_mobility_require_permission('update');

  if jsonb_typeof(participants) <> 'array' then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Participants must be an array.';
  end if;

  select * into movement_record
  from public.movement_cases
  where id = target_movement_id
    and category = 'student_mobility'
    and deleted_at is null
  for update;

  if not found then
    raise exception 'STUDENT_MOBILITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if movement_record.workflow_status <> 'draft' then
    raise exception 'STUDENT_MOBILITY_INVALID_TRANSITION' using errcode = '23514';
  end if;
  if expected_updated_at is null or movement_record.updated_at <> expected_updated_at then
    raise exception 'STUDENT_MOBILITY_CONFLICT' using errcode = '40001';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(participants) as p(full_name_snapshot text)
    where nullif(btrim(p.full_name_snapshot), '') is null
  ) then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Each participant needs a full name.';
  end if;

  delete from public.movement_participants
  where movement_id = target_movement_id;

  insert into public.movement_participants (
    movement_id, person_id, person_source, full_name_snapshot,
    organization_unit_id_snapshot, organization_unit_name_snapshot,
    position_snapshot, participant_role, arrival_date, departure_date,
    home_organization_name_snapshot, host_organization_name_snapshot,
    student_id_snapshot, faculty_snapshot, study_program_snapshot,
    study_level_snapshot, gender_snapshot, created_by, updated_by
  )
  select
    target_movement_id,
    p.person_id,
    coalesce(p.person_source, 'student'::public.person_type),
    nullif(btrim(p.full_name_snapshot), ''),
    p.organization_unit_id_snapshot,
    nullif(btrim(p.organization_unit_name_snapshot), ''),
    nullif(btrim(p.position_snapshot), ''),
    nullif(btrim(p.participant_role), ''),
    p.arrival_date,
    p.departure_date,
    nullif(btrim(p.home_organization_name_snapshot), ''),
    nullif(btrim(p.host_organization_name_snapshot), ''),
    nullif(btrim(p.student_id_snapshot), ''),
    nullif(btrim(p.faculty_snapshot), ''),
    nullif(btrim(p.study_program_snapshot), ''),
    nullif(btrim(p.study_level_snapshot), ''),
    nullif(btrim(p.gender_snapshot), ''),
    actor_id,
    actor_id
  from jsonb_to_recordset(participants) as p(
    person_id uuid,
    person_source public.person_type,
    full_name_snapshot text,
    organization_unit_id_snapshot uuid,
    organization_unit_name_snapshot text,
    position_snapshot text,
    participant_role text,
    arrival_date date,
    departure_date date,
    home_organization_name_snapshot text,
    host_organization_name_snapshot text,
    student_id_snapshot text,
    faculty_snapshot text,
    study_program_snapshot text,
    study_level_snapshot text,
    gender_snapshot text
  );

  update public.movement_cases
  set updated_by = actor_id
  where id = target_movement_id
  returning * into movement_record;

  insert into public.movement_workflow_events (
    movement_id, action, from_status, to_status, created_by
  )
  values (
    target_movement_id, 'participants_replaced', 'draft', 'draft', actor_id
  );

  return jsonb_build_object(
    'id', movement_record.id,
    'updated_at', movement_record.updated_at,
    'participant_count', movement_record.participant_count
  );
end;
$$;

create or replace function public.student_mobility_replace_funding(
  target_movement_id uuid, expected_updated_at timestamptz, funding jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  movement_record public.movement_cases%rowtype;
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'STUDENT_MOBILITY_FORBIDDEN' using errcode = '42501';
  end if;

  perform private.student_mobility_require_permission('update');

  if jsonb_typeof(funding) <> 'array' then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Funding must be an array.';
  end if;

  select * into movement_record
  from public.movement_cases
  where id = target_movement_id
    and category = 'student_mobility'
    and deleted_at is null
  for update;

  if not found then
    raise exception 'STUDENT_MOBILITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if movement_record.workflow_status <> 'draft' then
    raise exception 'STUDENT_MOBILITY_INVALID_TRANSITION' using errcode = '23514';
  end if;
  if expected_updated_at is null or movement_record.updated_at <> expected_updated_at then
    raise exception 'STUDENT_MOBILITY_CONFLICT' using errcode = '40001';
  end if;

  delete from public.movement_funding
  where movement_id = target_movement_id;

  insert into public.movement_funding (
    movement_id, budget_type, budget_type_id, source_unit_id, source_name,
    amount, currency, note, created_by, updated_by
  )
  select
    target_movement_id,
    coalesce(nullif(btrim(f.budget_type), ''), 'unspecified'),
    f.budget_type_id,
    f.source_unit_id,
    nullif(btrim(f.source_name), ''),
    f.amount,
    coalesce(nullif(btrim(f.currency), ''), 'THB'),
    nullif(btrim(f.note), ''),
    actor_id,
    actor_id
  from jsonb_to_recordset(funding) as f(
    budget_type text,
    budget_type_id uuid,
    source_unit_id uuid,
    source_name text,
    amount numeric,
    currency text,
    note text
  );

  update public.movement_cases
  set updated_by = actor_id
  where id = target_movement_id
  returning * into movement_record;

  insert into public.movement_workflow_events (
    movement_id, action, from_status, to_status, created_by
  )
  values (
    target_movement_id, 'funding_replaced', 'draft', 'draft', actor_id
  );

  return jsonb_build_object(
    'id', movement_record.id,
    'updated_at', movement_record.updated_at
  );
end;
$$;

revoke all on function public.student_mobility_replace_participants(
  uuid, timestamptz, jsonb
) from public, anon;
revoke all on function public.student_mobility_replace_funding(
  uuid, timestamptz, jsonb
) from public, anon;
grant execute on function public.student_mobility_replace_participants(
  uuid, timestamptz, jsonb
) to authenticated;
grant execute on function public.student_mobility_replace_funding(
  uuid, timestamptz, jsonb
) to authenticated;
