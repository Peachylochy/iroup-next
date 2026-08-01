create or replace function public.commit_legacy_travel_import_batch(target_batch_id uuid)
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
  committed_projects integer := 0;
  committed_participants integer := 0;
  inserted_participants integer := 0;
  skipped_projects integer := 0;
  source_status text;
  target_workflow public.workflow_status;
  target_status text;
begin
  if actor_id is null or not private.is_admin() then
    raise exception 'LEGACY_TRAVEL_IMPORT_FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into batch_record
  from public.import_batches
  where id = target_batch_id
    and module = 'travel'::public.module_key
    and import_kind = 'module_data'::public.import_kind
    and source_file_path = 'legacy_staff_travel'
  for update;

  if not found then
    raise exception 'LEGACY_TRAVEL_IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if batch_record.status <> 'ready'::public.import_status
     or batch_record.committed_at is not null then
    raise exception 'LEGACY_TRAVEL_IMPORT_NOT_READY' using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and status = 'invalid'::public.import_row_status
      and review_status <> 'skipped'::public.import_review_status
  ) then
    raise exception 'LEGACY_TRAVEL_IMPORT_HAS_INVALID_ROWS' using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and review_status in (
        'pending'::public.import_review_status,
        'needs_fix'::public.import_review_status
      )
  ) then
    raise exception 'LEGACY_TRAVEL_IMPORT_REVIEW_INCOMPLETE' using errcode = '23514';
  end if;

  update public.import_batches
  set status = 'importing'::public.import_status
  where id = target_batch_id;

  for row_record in
    select *
    from public.import_rows
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
      when source_status in ('completed', 'complete') then 'completed'::public.workflow_status
      when source_status in ('active', 'ongoing') then 'active'::public.workflow_status
      when source_status in ('cancelled', 'canceled') then 'cancelled'::public.workflow_status
      else 'draft'::public.workflow_status
    end;
    target_status := case target_workflow
      when 'completed'::public.workflow_status then 'completed'
      when 'active'::public.workflow_status then 'ongoing'
      when 'cancelled'::public.workflow_status then 'cancelled'
      else 'planned'
    end;

    insert into public.movement_cases (
      legacy_id,
      category,
      direction,
      project_name,
      purpose,
      country_id,
      country_name_snapshot,
      city,
      owner_unit_id,
      participant_group,
      start_date,
      end_date,
      fiscal_year,
      status,
      workflow_status,
      publication_status,
      public_visible,
      participant_count,
      internal_note,
      created_by,
      updated_by
    ) values (
      row_record.normalized_data ->> 'legacyId',
      'staff_official_travel'::public.movement_category,
      'outbound'::public.movement_direction,
      row_record.normalized_data ->> 'projectName',
      nullif(row_record.normalized_data ->> 'purpose', ''),
      nullif(row_record.normalized_data ->> 'countryId', '')::uuid,
      nullif(row_record.normalized_data ->> 'countryNameSnapshot', ''),
      nullif(row_record.normalized_data ->> 'city', ''),
      nullif(row_record.normalized_data ->> 'ownerUnitId', '')::uuid,
      'บุคลากร',
      nullif(row_record.normalized_data ->> 'startDate', '')::date,
      nullif(row_record.normalized_data ->> 'endDate', '')::date,
      nullif(row_record.normalized_data ->> 'fiscalYear', '')::integer,
      target_status,
      target_workflow,
      'published'::public.publication_status,
      true,
      coalesce((row_record.normalized_data ->> 'participantCount')::integer, 0),
      'นำเข้าจากรายงานการเดินทางและ public API ของ iROUP เดิมผ่าน staging batch '
        || target_batch_id::text,
      actor_id,
      actor_id
    )
    on conflict (legacy_id)
    do update set
      project_name = excluded.project_name,
      purpose = excluded.purpose,
      country_id = excluded.country_id,
      country_name_snapshot = excluded.country_name_snapshot,
      city = excluded.city,
      owner_unit_id = excluded.owner_unit_id,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      fiscal_year = excluded.fiscal_year,
      status = excluded.status,
      workflow_status = excluded.workflow_status,
      publication_status = excluded.publication_status,
      public_visible = excluded.public_visible,
      participant_count = excluded.participant_count,
      internal_note = excluded.internal_note,
      deleted_at = null,
      deleted_by = null,
      updated_by = actor_id
    returning *
    into movement_record;

    delete from public.movement_participants
    where movement_id = movement_record.id;

    insert into public.movement_participants (
      movement_id,
      person_id,
      person_source,
      full_name_snapshot,
      organization_unit_id_snapshot,
      organization_unit_name_snapshot,
      position_snapshot,
      participant_role,
      departure_date,
      arrival_date,
      created_by,
      updated_by
    )
    select
      movement_record.id,
      nullif(participant."personId", '')::uuid,
      coalesce(
        nullif(participant."personSource", '')::public.person_type,
        'staff'::public.person_type
      ),
      participant."fullNameSnapshot",
      nullif(participant."organizationUnitIdSnapshot", '')::uuid,
      unit.name_th,
      nullif(participant."positionSnapshot", ''),
      'ผู้เดินทาง',
      movement_record.end_date,
      movement_record.start_date,
      actor_id,
      actor_id
    from jsonb_to_recordset(
      coalesce(row_record.normalized_data -> 'participants', '[]'::jsonb)
    ) as participant(
      "personId" text,
      "personSource" text,
      "fullNameSnapshot" text,
      "organizationUnitIdSnapshot" text,
      "positionSnapshot" text
    )
    left join public.organization_units unit
      on unit.id = nullif(participant."organizationUnitIdSnapshot", '')::uuid;

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

revoke all on function public.commit_legacy_travel_import_batch(uuid)
from public, anon;
grant execute on function public.commit_legacy_travel_import_batch(uuid)
to authenticated;
