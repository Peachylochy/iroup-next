-- A full Student Mobility form save must commit or roll back as one unit.
-- Reuse the established permission, lock, validation and audit contracts.
-- The guarded component RPCs remain available for existing consumers.
create function public.student_mobility_save(
  target_movement_id uuid,
  expected_updated_at timestamptz,
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
  saved jsonb;
  component_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'STUDENT_MOBILITY_FORBIDDEN' using errcode = '42501';
  end if;
  -- Replacing participants/funding and review have always required update.
  -- Check before creating a draft, including for create-only callers.
  perform private.student_mobility_require_permission('update');
  if jsonb_typeof(participants) is distinct from 'array'
    or jsonb_typeof(funding) is distinct from 'array' then
    raise exception 'STUDENT_MOBILITY_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Participants and funding must be arrays.';
  end if;

  saved := public.student_mobility_save_draft(
    target_movement_id, expected_updated_at, payload
  );
  component_result := public.student_mobility_replace_participants(
    (saved ->> 'id')::uuid, (saved ->> 'updated_at')::timestamptz, participants
  );
  saved := saved || component_result;
  component_result := public.student_mobility_replace_funding(
    (saved ->> 'id')::uuid, (saved ->> 'updated_at')::timestamptz, funding
  );
  saved := saved || component_result;
  if submit_for_review then
    component_result := public.student_mobility_submit_for_review(
      (saved ->> 'id')::uuid, (saved ->> 'updated_at')::timestamptz
    );
    saved := saved || component_result;
  end if;
  return saved;
end;
$$;

revoke all on function public.student_mobility_save(
  uuid, timestamptz, jsonb, jsonb, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.student_mobility_save(
  uuid, timestamptz, jsonb, jsonb, jsonb, boolean
) to authenticated;

-- Manual staff participants have no people master id. The existing person_type
-- enum supports external; do not introduce an unsupported manual enum value.
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
      participant_person_type := 'external';
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

revoke all on function public.staff_movement_save(
  uuid, timestamptz, public.movement_category, jsonb, jsonb, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.staff_movement_save(
  uuid, timestamptz, public.movement_category, jsonb, jsonb, jsonb, boolean
) to authenticated;
