create or replace function public.staff_movement_save(
  target_movement_id uuid,
  expected_updated_at timestamptz,
  requested_category public.movement_category,
  payload jsonb,
  participants jsonb,
  funding jsonb,
  submit_for_review boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_record public.movement_cases%rowtype;
  saved_record public.movement_cases%rowtype;
  partner_snapshot text;
  country_snapshot text;
  participant jsonb;
  funding_item jsonb;
  participant_person_id uuid;
  participant_person_type public.person_type;
  action_name text;
begin
  if actor_id is null then
    raise exception 'STAFF_MOVEMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_category not in (
    'staff_mobility'::public.movement_category,
    'staff_official_travel'::public.movement_category
  ) then
    raise exception 'STAFF_MOVEMENT_INVALID_CATEGORY' using errcode = '23514';
  end if;
  if nullif(btrim(payload ->> 'project_name'), '') is null then
    raise exception 'STAFF_MOVEMENT_VALIDATION_FAILED'
      using errcode = '23514', detail = 'กรุณาระบุชื่อโครงการหรือเรื่องที่เดินทาง';
  end if;
  if jsonb_typeof(coalesce(participants, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(funding, '[]'::jsonb)) <> 'array' then
    raise exception 'STAFF_MOVEMENT_VALIDATION_FAILED'
      using errcode = '23514', detail = 'รูปแบบข้อมูลผู้เดินทางหรืองบประมาณไม่ถูกต้อง';
  end if;

  select coalesce(nullif(btrim(name_th), ''), nullif(btrim(name_en), ''))
  into partner_snapshot
  from public.partner_organizations
  where id = nullif(payload ->> 'partner_organization_id', '')::uuid
    and active;

  select coalesce(nullif(btrim(name_th), ''), nullif(btrim(name_en), ''))
  into country_snapshot
  from public.countries
  where id = nullif(payload ->> 'country_id', '')::uuid
    and active;

  if target_movement_id is null then
    if not private.can_access_movement(requested_category, 'create') then
      raise exception 'STAFF_MOVEMENT_FORBIDDEN' using errcode = '42501';
    end if;

    insert into public.movement_cases (
      category, direction, project_name, title_en, purpose, country_id, city,
      partner_organization_id, partner_name_snapshot, country_name_snapshot,
      owner_unit_id, activity_type, mobility_mode, participant_group,
      approval_reference, start_date, end_date, departure_at, return_at,
      fiscal_year, status, workflow_status, publication_status, public_visible,
      internal_note, created_by, updated_by
    )
    values (
      requested_category,
      coalesce(nullif(payload ->> 'direction', '')::public.movement_direction, 'outbound'),
      btrim(payload ->> 'project_name'),
      nullif(btrim(payload ->> 'title_en'), ''),
      nullif(btrim(payload ->> 'purpose'), ''),
      nullif(payload ->> 'country_id', '')::uuid,
      nullif(btrim(payload ->> 'city'), ''),
      nullif(payload ->> 'partner_organization_id', '')::uuid,
      coalesce(nullif(btrim(payload ->> 'partner_name_snapshot'), ''), partner_snapshot),
      coalesce(nullif(btrim(payload ->> 'country_name_snapshot'), ''), country_snapshot),
      nullif(payload ->> 'owner_unit_id', '')::uuid,
      nullif(btrim(payload ->> 'activity_type'), ''),
      nullif(btrim(payload ->> 'mobility_mode'), ''),
      'บุคลากร',
      nullif(btrim(payload ->> 'approval_reference'), ''),
      nullif(payload ->> 'start_date', '')::date,
      nullif(payload ->> 'end_date', '')::date,
      nullif(payload ->> 'departure_at', '')::timestamptz,
      nullif(payload ->> 'return_at', '')::timestamptz,
      nullif(payload ->> 'fiscal_year', '')::integer,
      'planned', 'draft', 'draft', false,
      nullif(btrim(payload ->> 'internal_note'), ''),
      actor_id, actor_id
    )
    returning * into saved_record;
    action_name := 'created';
  else
    if not private.can_access_movement(requested_category, 'update') then
      raise exception 'STAFF_MOVEMENT_FORBIDDEN' using errcode = '42501';
    end if;

    select * into current_record
    from public.movement_cases
    where id = target_movement_id
      and category = requested_category
      and deleted_at is null
    for update;

    if not found then
      raise exception 'STAFF_MOVEMENT_NOT_FOUND' using errcode = 'P0002';
    end if;
    if current_record.workflow_status <> 'draft' then
      raise exception 'STAFF_MOVEMENT_INVALID_TRANSITION'
        using errcode = '23514', detail = 'แก้ไขได้เฉพาะรายการสถานะร่าง';
    end if;
    if expected_updated_at is null or current_record.updated_at <> expected_updated_at then
      raise exception 'STAFF_MOVEMENT_CONFLICT' using errcode = '40001';
    end if;

    update public.movement_cases
    set
      direction = coalesce(nullif(payload ->> 'direction', '')::public.movement_direction, direction),
      project_name = btrim(payload ->> 'project_name'),
      title_en = nullif(btrim(payload ->> 'title_en'), ''),
      purpose = nullif(btrim(payload ->> 'purpose'), ''),
      country_id = nullif(payload ->> 'country_id', '')::uuid,
      city = nullif(btrim(payload ->> 'city'), ''),
      partner_organization_id = nullif(payload ->> 'partner_organization_id', '')::uuid,
      partner_name_snapshot = coalesce(nullif(btrim(payload ->> 'partner_name_snapshot'), ''), partner_snapshot),
      country_name_snapshot = coalesce(nullif(btrim(payload ->> 'country_name_snapshot'), ''), country_snapshot),
      owner_unit_id = nullif(payload ->> 'owner_unit_id', '')::uuid,
      activity_type = nullif(btrim(payload ->> 'activity_type'), ''),
      mobility_mode = nullif(btrim(payload ->> 'mobility_mode'), ''),
      approval_reference = nullif(btrim(payload ->> 'approval_reference'), ''),
      start_date = nullif(payload ->> 'start_date', '')::date,
      end_date = nullif(payload ->> 'end_date', '')::date,
      departure_at = nullif(payload ->> 'departure_at', '')::timestamptz,
      return_at = nullif(payload ->> 'return_at', '')::timestamptz,
      fiscal_year = nullif(payload ->> 'fiscal_year', '')::integer,
      internal_note = nullif(btrim(payload ->> 'internal_note'), ''),
      updated_by = actor_id
    where id = target_movement_id
    returning * into saved_record;
    action_name := 'saved_draft';
  end if;

  delete from public.movement_participants where movement_id = saved_record.id;
  for participant in select value from jsonb_array_elements(coalesce(participants, '[]'::jsonb))
  loop
    if nullif(btrim(participant ->> 'full_name_snapshot'), '') is null then
      raise exception 'STAFF_MOVEMENT_VALIDATION_FAILED'
        using errcode = '23514', detail = 'กรุณาระบุชื่อผู้เดินทางทุกรายการ';
    end if;
    participant_person_id := nullif(participant ->> 'person_id', '')::uuid;
    if participant_person_id is not null then
      select person_type into participant_person_type
      from public.people
      where id = participant_person_id and active;
      if not found then
        raise exception 'STAFF_MOVEMENT_VALIDATION_FAILED'
          using errcode = '23514', detail = 'ไม่พบผู้เดินทางใน Data Master';
      end if;
    else
      participant_person_type := 'manual';
    end if;

    insert into public.movement_participants (
      movement_id, person_id, person_source, full_name_snapshot,
      organization_unit_id_snapshot, organization_unit_name_snapshot,
      position_snapshot, participant_role, arrival_date, departure_date,
      home_organization_name_snapshot, host_organization_name_snapshot,
      created_by, updated_by
    )
    values (
      saved_record.id,
      participant_person_id,
      participant_person_type,
      btrim(participant ->> 'full_name_snapshot'),
      nullif(participant ->> 'organization_unit_id_snapshot', '')::uuid,
      nullif(btrim(participant ->> 'organization_unit_name_snapshot'), ''),
      nullif(btrim(participant ->> 'position_snapshot'), ''),
      nullif(btrim(participant ->> 'participant_role'), ''),
      nullif(participant ->> 'arrival_date', '')::date,
      nullif(participant ->> 'departure_date', '')::date,
      nullif(btrim(participant ->> 'home_organization_name_snapshot'), ''),
      nullif(btrim(participant ->> 'host_organization_name_snapshot'), ''),
      actor_id, actor_id
    );
  end loop;

  delete from public.movement_funding where movement_id = saved_record.id;
  for funding_item in select value from jsonb_array_elements(coalesce(funding, '[]'::jsonb))
  loop
    if nullif(btrim(funding_item ->> 'budget_type'), '') is null then
      raise exception 'STAFF_MOVEMENT_VALIDATION_FAILED'
        using errcode = '23514', detail = 'กรุณาระบุประเภทงบประมาณ';
    end if;
    insert into public.movement_funding (
      movement_id, budget_type, source_name, amount, currency, note,
      created_by, updated_by
    )
    values (
      saved_record.id,
      btrim(funding_item ->> 'budget_type'),
      nullif(btrim(funding_item ->> 'source_name'), ''),
      nullif(funding_item ->> 'amount', '')::numeric,
      coalesce(nullif(upper(btrim(funding_item ->> 'currency')), ''), 'THB'),
      nullif(btrim(funding_item ->> 'note'), ''),
      actor_id, actor_id
    );
  end loop;

  if submit_for_review then
    if nullif(payload ->> 'owner_unit_id', '') is null
      or nullif(payload ->> 'start_date', '') is null
      or nullif(payload ->> 'end_date', '') is null
      or jsonb_array_length(participants) = 0 then
      raise exception 'STAFF_MOVEMENT_VALIDATION_FAILED'
        using errcode = '23514',
          detail = 'ก่อนส่งตรวจต้องระบุหน่วยงานเจ้าของ วันไป วันกลับ และผู้เดินทางอย่างน้อย 1 คน';
    end if;
    update public.movement_cases
    set workflow_status = 'under_review', updated_by = actor_id
    where id = saved_record.id
    returning * into saved_record;
  else
    select * into saved_record from public.movement_cases where id = saved_record.id;
  end if;

  insert into public.movement_workflow_events (
    movement_id, action, from_status, to_status, created_by
  )
  values (
    saved_record.id,
    case when submit_for_review then 'submitted_for_review' else action_name end,
    case when action_name = 'created' then null else 'draft'::public.workflow_status end,
    saved_record.workflow_status,
    actor_id
  );

  return jsonb_build_object(
    'id', saved_record.id,
    'workflow_status', saved_record.workflow_status,
    'updated_at', saved_record.updated_at
  );
end;
$$;

create or replace function public.staff_movement_transition(
  target_movement_id uuid,
  expected_updated_at timestamptz,
  requested_action text,
  transition_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  movement_record public.movement_cases%rowtype;
  previous_status public.workflow_status;
  next_status public.workflow_status;
  event_action text;
begin
  if actor_id is null then
    raise exception 'STAFF_MOVEMENT_FORBIDDEN' using errcode = '42501';
  end if;

  select * into movement_record
  from public.movement_cases
  where id = target_movement_id
    and category in (
      'staff_mobility'::public.movement_category,
      'staff_official_travel'::public.movement_category
    )
    and deleted_at is null
  for update;

  if not found then
    raise exception 'STAFF_MOVEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if expected_updated_at is null or movement_record.updated_at <> expected_updated_at then
    raise exception 'STAFF_MOVEMENT_CONFLICT' using errcode = '40001';
  end if;
  previous_status := movement_record.workflow_status;

  if requested_action = 'return_to_draft' and movement_record.workflow_status = 'under_review' then
    if not private.can_access_movement(movement_record.category, 'update') then
      raise exception 'STAFF_MOVEMENT_FORBIDDEN' using errcode = '42501';
    end if;
    if nullif(btrim(transition_note), '') is null then
      raise exception 'STAFF_MOVEMENT_VALIDATION_FAILED'
        using errcode = '23514', detail = 'กรุณาระบุเหตุผลที่ส่งกลับแก้ไข';
    end if;
    next_status := 'draft';
    event_action := 'returned_to_draft';
  elsif requested_action = 'approve' and movement_record.workflow_status = 'under_review' then
    if not private.can_access_movement(movement_record.category, 'publish') then
      raise exception 'STAFF_MOVEMENT_FORBIDDEN' using errcode = '42501';
    end if;
    next_status := 'approved';
    event_action := 'approved';
  elsif requested_action = 'activate' and movement_record.workflow_status = 'approved' then
    if not private.can_access_movement(movement_record.category, 'update') then
      raise exception 'STAFF_MOVEMENT_FORBIDDEN' using errcode = '42501';
    end if;
    next_status := 'active';
    event_action := 'activated';
  elsif requested_action = 'complete' and movement_record.workflow_status = 'active' then
    if not private.can_access_movement(movement_record.category, 'update') then
      raise exception 'STAFF_MOVEMENT_FORBIDDEN' using errcode = '42501';
    end if;
    next_status := 'completed';
    event_action := 'completed';
  else
    raise exception 'STAFF_MOVEMENT_INVALID_TRANSITION'
      using errcode = '23514', detail = 'สถานะปัจจุบันไม่รองรับการดำเนินการนี้';
  end if;

  update public.movement_cases
  set
    workflow_status = next_status,
    status = case
      when next_status = 'active' then 'ongoing'
      when next_status = 'completed' then 'completed'
      else status
    end,
    updated_by = actor_id
  where id = movement_record.id
  returning * into movement_record;

  insert into public.movement_workflow_events (
    movement_id, action, from_status, to_status, note, created_by
  )
  values (
    movement_record.id, event_action, previous_status,
    next_status, nullif(btrim(transition_note), ''), actor_id
  );

  return jsonb_build_object(
    'id', movement_record.id,
    'workflow_status', movement_record.workflow_status,
    'updated_at', movement_record.updated_at
  );
end;
$$;

revoke all on function public.staff_movement_save(
  uuid, timestamptz, public.movement_category, jsonb, jsonb, jsonb, boolean
) from public;
grant execute on function public.staff_movement_save(
  uuid, timestamptz, public.movement_category, jsonb, jsonb, jsonb, boolean
) to authenticated;

revoke all on function public.staff_movement_transition(
  uuid, timestamptz, text, text
) from public;
grant execute on function public.staff_movement_transition(
  uuid, timestamptz, text, text
) to authenticated;
