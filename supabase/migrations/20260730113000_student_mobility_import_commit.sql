-- Commit a reviewed student-mobility staging batch atomically. The parser and
-- mapping UI never write movement records; this function is the only commit
-- boundary and always runs in the caller's authenticated permission context.
create or replace function public.commit_student_mobility_import_batch(target_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  batch_record public.import_batches%rowtype;
  row_record public.import_rows%rowtype;
  movement_record public.movement_cases%rowtype;
  target_movement_uuid uuid;
  committed_projects integer := 0;
  committed_participants integer := 0;
  skipped_projects integer := 0;
  inserted_participants integer := 0;
  source_status text;
  target_workflow public.workflow_status;
  target_status text;
  target_publication public.publication_status;
  target_public_visible boolean;
begin
  if actor_id is null or not private.can_access_movement('student_mobility'::public.movement_category, 'import') then
    raise exception 'STUDENT_MOBILITY_IMPORT_FORBIDDEN' using errcode = '42501';
  end if;

  select * into batch_record
  from public.import_batches
  where id = target_batch_id
    and module = 'mobility'::public.module_key
    and import_kind = 'module_data'::public.import_kind
  for update;

  if not found then
    raise exception 'STUDENT_MOBILITY_IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if batch_record.status <> 'ready'::public.import_status or batch_record.committed_at is not null then
    raise exception 'STUDENT_MOBILITY_IMPORT_NOT_READY' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.import_rows
    where batch_id = target_batch_id
      and status = 'invalid'::public.import_row_status
      and review_status <> 'skipped'::public.import_review_status
  ) then
    raise exception 'STUDENT_MOBILITY_IMPORT_HAS_INVALID_ROWS' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.import_rows
    where batch_id = target_batch_id
      and review_status in ('pending'::public.import_review_status, 'needs_fix'::public.import_review_status)
  ) then
    raise exception 'STUDENT_MOBILITY_IMPORT_REVIEW_INCOMPLETE' using errcode = '23514';
  end if;

  update public.import_batches
  set status = 'importing'::public.import_status
  where id = target_batch_id;

  for row_record in
    select * from public.import_rows
    where batch_id = target_batch_id
    order by row_number
    for update
  loop
    if row_record.review_status = 'skipped'::public.import_review_status
       or row_record.change_action = 'skip'::public.import_change_action then
      skipped_projects := skipped_projects + 1;
      continue;
    end if;

    source_status := lower(coalesce(row_record.normalized_data ->> 'sourceStatus', ''));
    target_workflow := case
      when source_status in ('completed', 'complete', 'เสร็จสิ้น') then 'completed'::public.workflow_status
      when source_status in ('active', 'ongoing', 'ใช้งานอยู่', 'กำลังดำเนินการ') then 'active'::public.workflow_status
      when source_status in ('cancelled', 'canceled', 'ยกเลิก') then 'cancelled'::public.workflow_status
      else 'draft'::public.workflow_status
    end;
    target_status := case target_workflow
      when 'completed'::public.workflow_status then 'completed'
      when 'active'::public.workflow_status then 'ongoing'
      when 'cancelled'::public.workflow_status then 'cancelled'
      else 'planned'
    end;
    target_public_visible := coalesce((row_record.normalized_data ->> 'publicVisible')::boolean, false)
      and target_workflow in ('active'::public.workflow_status, 'completed'::public.workflow_status);
    target_publication := case when target_public_visible
      then 'published'::public.publication_status
      else 'draft'::public.publication_status
    end;

    insert into public.movement_cases (
      legacy_id, category, direction, project_name, purpose, country_id,
      country_name_snapshot, city, partner_organization_id, partner_name_snapshot,
      owner_unit_id, participant_group, study_level, start_date, end_date,
      fiscal_year, status, workflow_status, publication_status, public_visible,
      internal_note, created_by, updated_by
    ) values (
      row_record.normalized_data ->> 'legacyId',
      'student_mobility'::public.movement_category,
      coalesce(nullif(row_record.normalized_data ->> 'direction', '')::public.movement_direction, 'not_applicable'::public.movement_direction),
      row_record.normalized_data ->> 'projectName',
      nullif(row_record.normalized_data ->> 'purpose', ''),
      nullif(row_record.normalized_data ->> 'countryId', '')::uuid,
      nullif(row_record.normalized_data ->> 'countryNameSnapshot', ''),
      nullif(row_record.normalized_data ->> 'city', ''),
      nullif(row_record.normalized_data ->> 'partnerOrganizationId', '')::uuid,
      nullif(row_record.normalized_data ->> 'partnerNameSnapshot', ''),
      nullif(row_record.normalized_data ->> 'ownerUnitId', '')::uuid,
      nullif(row_record.normalized_data ->> 'participantGroup', ''),
      nullif(row_record.normalized_data ->> 'studyLevel', ''),
      nullif(row_record.normalized_data ->> 'startDate', '')::date,
      nullif(row_record.normalized_data ->> 'endDate', '')::date,
      nullif(row_record.normalized_data ->> 'fiscalYear', '')::integer,
      target_status, target_workflow, target_publication, target_public_visible,
      'นำเข้าจากระบบ iROUP เดิมผ่าน staging batch ' || target_batch_id::text,
      actor_id, actor_id
    )
    on conflict (legacy_id) where legacy_id is not null
    do update set
      direction = excluded.direction,
      project_name = excluded.project_name,
      purpose = excluded.purpose,
      country_id = excluded.country_id,
      country_name_snapshot = excluded.country_name_snapshot,
      city = excluded.city,
      partner_organization_id = excluded.partner_organization_id,
      partner_name_snapshot = excluded.partner_name_snapshot,
      owner_unit_id = excluded.owner_unit_id,
      participant_group = excluded.participant_group,
      study_level = excluded.study_level,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      fiscal_year = excluded.fiscal_year,
      status = excluded.status,
      workflow_status = excluded.workflow_status,
      publication_status = excluded.publication_status,
      public_visible = excluded.public_visible,
      internal_note = excluded.internal_note,
      deleted_at = null,
      deleted_by = null,
      updated_by = actor_id
    returning * into movement_record;

    target_movement_uuid := movement_record.id;
    delete from public.movement_participants where movement_id = movement_record.id;

    insert into public.movement_participants (
      movement_id, person_id, person_source, full_name_snapshot,
      organization_unit_id_snapshot, organization_unit_name_snapshot,
      participant_role, student_id_snapshot, faculty_snapshot,
      study_program_snapshot, gender_snapshot, created_by, updated_by
    )
    select
      target_movement_uuid,
      person.id,
      'student'::public.person_type,
      participant."fullNameSnapshot",
      coalesce(nullif(participant."organizationUnitIdSnapshot", '')::uuid, person.organization_unit_id),
      unit.name_th,
      coalesce(nullif(participant."participantRole", ''), 'นิสิต'),
      participant."sourceIdentifier",
      unit.name_th,
      nullif(participant."programOrPositionSnapshot", ''),
      nullif(participant."genderSnapshot", ''),
      actor_id,
      actor_id
    from jsonb_to_recordset(coalesce(row_record.normalized_data -> 'participants', '[]'::jsonb))
      as participant(
        "legacyParticipantId" text,
        "sourceIdentifier" text,
        "fullNameSnapshot" text,
        "genderSnapshot" text,
        "programOrPositionSnapshot" text,
        "participantRole" text,
        "sourceUnitId" text,
        "organizationUnitIdSnapshot" text
      )
    left join public.people person
      on person.person_type = 'student'::public.person_type
      and person.source_identifier = participant."sourceIdentifier"
    left join public.organization_units unit
      on unit.id = coalesce(nullif(participant."organizationUnitIdSnapshot", '')::uuid, person.organization_unit_id);

    get diagnostics inserted_participants = row_count;
    committed_participants := committed_participants + inserted_participants;

    update public.import_rows
    set status = 'imported'::public.import_row_status,
        target_record_id = movement_record.id
    where id = row_record.id;
    committed_projects := committed_projects + 1;
  end loop;

  update public.import_batches
  set status = 'completed'::public.import_status,
      committed_at = now()
  where id = target_batch_id;

  return jsonb_build_object(
    'batch_id', target_batch_id,
    'projects', committed_projects,
    'participants', committed_participants,
    'skipped', skipped_projects
  );
end;
$$;

revoke all on function public.commit_student_mobility_import_batch(uuid) from public, anon;
grant execute on function public.commit_student_mobility_import_batch(uuid) to authenticated;
