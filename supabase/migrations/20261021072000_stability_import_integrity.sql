-- Local stability: honor reviewed skips and preserve manual enrichment.
-- Existing module records require explicit reconciliation; this migration
-- never deletes import history and does not rewrite historical migrations.

-- A reviewed master import must be applied as one transaction.  If a source
-- mapping or an upsert fails, PostgreSQL rolls back the complete batch.
create or replace function public.commit_master_import_batch(target_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_record public.import_batches%rowtype;
  actor_id uuid := auth.uid();
  country_rows integer := 0;
  unit_rows integer := 0;
  partner_rows integer := 0;
  student_rows integer := 0;
  staff_rows integer := 0;
begin
  if actor_id is null or not private.has_role('system_admin') then
    raise exception 'MASTER_IMPORT_FORBIDDEN' using errcode = '42501';
  end if;

  select * into batch_record
  from public.import_batches
  where id = target_batch_id
    and import_kind = 'master_data'
  for update;

  if not found then
    raise exception 'MASTER_IMPORT_BATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  if batch_record.status <> 'ready' or batch_record.committed_at is not null then
    raise exception 'MASTER_IMPORT_BATCH_NOT_READY' using errcode = 'P0001';
  end if;

  -- Freeze reviewed staging rows for the duration of the atomic commit.
  perform 1 from public.import_rows where batch_id = target_batch_id for update;

  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and review_status <> 'skipped'
      and (status not in ('valid', 'warning') or review_status = 'needs_fix')
  ) then
    raise exception 'MASTER_IMPORT_HAS_UNRESOLVED_ROWS' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and change_action = 'skip'
      and review_status <> 'skipped'
  ) then
    raise exception 'MASTER_IMPORT_HAS_UNREVIEWED_SKIPPED_ROWS' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and master_entity = 'country'
      and review_status <> 'skipped'
      and (
        nullif(normalized_data ->> 'iso2', '') is null
        or nullif(normalized_data ->> 'iso3', '') is null
        or (nullif(normalized_data ->> 'name_th', '') is null and nullif(normalized_data ->> 'name_en', '') is null)
      )
  ) then
    raise exception 'MASTER_IMPORT_COUNTRY_DATA_INCOMPLETE' using errcode = 'P0001';
  end if;

  -- A valid row must identify exactly the canonical record recorded below.
  -- The preview supplies these keys; reject malformed direct staging edits
  -- instead of inserting a destination row with no truthful provenance link.
  if exists (
    select 1 from public.import_rows
    where batch_id = target_batch_id
      and review_status <> 'skipped'
      and (
        master_entity is null
        or normalized_data is null
        or nullif(btrim(case master_entity
          when 'country' then normalized_data ->> 'iso2'
          when 'organization_unit' then normalized_data ->> 'code'
          when 'partner_organization' then normalized_data ->> 'legacy_id'
          else normalized_data ->> 'source_identifier'
        end), '') is null
        or (master_entity in ('student', 'staff')
          and (normalized_data ->> 'person_type') is distinct from master_entity::text)
      )
  ) then
    raise exception 'MASTER_IMPORT_IDENTITY_INVALID' using errcode = '23514';
  end if;

  -- A partner and a person may point to a master row from the same batch.
  -- Verify those source identifiers before writing any destination table.
  if exists (
    with staged_countries as (
      select source_data ->> 'country_id' as source_id
      from public.import_rows staged
      where batch_id = target_batch_id and master_entity = 'country'
        and (review_status <> 'skipped' or exists (
          select 1 from public.countries c where c.iso2 = staged.normalized_data ->> 'iso2'
        ))
    )
    select 1
    from public.import_rows partner_row
    where partner_row.batch_id = target_batch_id
      and partner_row.master_entity = 'partner_organization'
      and partner_row.review_status <> 'skipped'
      and nullif(partner_row.normalized_data ->> 'country_source_id', '') is not null
      and not exists (
        select 1 from staged_countries country_row
        where country_row.source_id = partner_row.normalized_data ->> 'country_source_id'
      )
  ) then
    raise exception 'MASTER_IMPORT_PARTNER_COUNTRY_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (
    with staged_units as (
      select source_data ->> 'unit_id' as source_id
      from public.import_rows staged
      where batch_id = target_batch_id and master_entity = 'organization_unit'
        and (review_status <> 'skipped' or exists (
          select 1 from public.organization_units u where u.code = staged.normalized_data ->> 'code'
        ))
    )
    select 1
    from public.import_rows person_row
    where person_row.batch_id = target_batch_id
      and person_row.master_entity in ('student', 'staff')
      and person_row.review_status <> 'skipped'
      and nullif(person_row.normalized_data ->> 'unit_source_id', '') is not null
      and not exists (
        select 1 from staged_units unit_row
        where unit_row.source_id = person_row.normalized_data ->> 'unit_source_id'
      )
  ) then
    raise exception 'MASTER_IMPORT_PERSON_UNIT_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.import_batches
  set status = 'importing'
  where id = target_batch_id;

  insert into public.countries (
    iso2, iso3, name_th, name_en, search_alias, active, updated_at
  )
  select
    normalized_data ->> 'iso2',
    normalized_data ->> 'iso3',
    coalesce(nullif(normalized_data ->> 'name_th', ''), nullif(normalized_data ->> 'name_en', '')),
    coalesce(nullif(normalized_data ->> 'name_en', ''), nullif(normalized_data ->> 'name_th', '')),
    array(select jsonb_array_elements_text(coalesce(normalized_data -> 'search_alias', '[]'::jsonb))),
    coalesce((normalized_data ->> 'active')::boolean, true),
    now()
  from public.import_rows
  where batch_id = target_batch_id
    and master_entity = 'country'
    and status in ('valid', 'warning')
    and review_status <> 'skipped'
  on conflict (iso2) do update set
    iso3 = excluded.iso3,
    name_th = excluded.name_th,
    name_en = excluded.name_en,
    search_alias = excluded.search_alias,
    active = excluded.active,
    updated_at = now();
  get diagnostics country_rows = row_count;

  insert into public.organization_units (
    code, name_th, name_en, unit_type, active, updated_at
  )
  select
    normalized_data ->> 'code',
    normalized_data ->> 'name_th',
    nullif(normalized_data ->> 'name_en', ''),
    nullif(normalized_data ->> 'unit_type', ''),
    coalesce((normalized_data ->> 'active')::boolean, true),
    now()
  from public.import_rows
  where batch_id = target_batch_id
    and master_entity = 'organization_unit'
    and status in ('valid', 'warning')
    and review_status <> 'skipped'
  on conflict (code) do update set
    name_th = excluded.name_th,
    name_en = excluded.name_en,
    unit_type = excluded.unit_type,
    active = excluded.active,
    updated_at = now();
  get diagnostics unit_rows = row_count;

  with staged_units as (
    select
      source_data ->> 'unit_id' as source_id,
      normalized_data ->> 'code' as code,
      nullif(normalized_data ->> 'parent_source_id', '') as parent_source_id
    from public.import_rows
    where batch_id = target_batch_id
      and master_entity = 'organization_unit'
  )
  update public.organization_units child
  set parent_id = parent.id,
      updated_at = now()
  from staged_units child_source
  join staged_units parent_source on parent_source.source_id = child_source.parent_source_id
  join public.organization_units parent on parent.code = parent_source.code
  where child.code = child_source.code
    and child_source.parent_source_id is not null
    and exists (
      select 1 from public.import_rows child_row
      where child_row.batch_id = target_batch_id
        and child_row.master_entity = 'organization_unit'
        and child_row.normalized_data ->> 'code' = child.code
        and child_row.review_status <> 'skipped'
    );

  with staged_countries as (
    select source_data ->> 'country_id' as source_id, normalized_data ->> 'iso2' as iso2
    from public.import_rows
    where batch_id = target_batch_id and master_entity = 'country'
  ), partners as (
    select normalized_data
    from public.import_rows
    where batch_id = target_batch_id
      and master_entity = 'partner_organization'
      and status in ('valid', 'warning')
      and review_status <> 'skipped'
  )
  insert into public.partner_organizations (
    legacy_id, name_th, name_en, organization_type, country_id, website_url, active, created_by, updated_by, updated_at
  )
  select
    partner.normalized_data ->> 'legacy_id',
    nullif(partner.normalized_data ->> 'name_th', ''),
    partner.normalized_data ->> 'name_en',
    nullif(partner.normalized_data ->> 'organization_type', ''),
    country.id,
    nullif(partner.normalized_data ->> 'website_url', ''),
    coalesce((partner.normalized_data ->> 'active')::boolean, true),
    actor_id,
    actor_id,
    now()
  from partners partner
  left join staged_countries country_source on country_source.source_id = partner.normalized_data ->> 'country_source_id'
  left join public.countries country on country.iso2 = country_source.iso2
  on conflict (legacy_id) do update set
    name_th = excluded.name_th,
    name_en = excluded.name_en,
    organization_type = excluded.organization_type,
    country_id = excluded.country_id,
    website_url = excluded.website_url,
    active = excluded.active,
    updated_by = actor_id,
    updated_at = now();
  get diagnostics partner_rows = row_count;

  with staged_units as (
    select source_data ->> 'unit_id' as source_id, normalized_data ->> 'code' as code
    from public.import_rows
    where batch_id = target_batch_id and master_entity = 'organization_unit'
  ), people_source as (
    select master_entity, normalized_data
    from public.import_rows
    where batch_id = target_batch_id
      and master_entity in ('student', 'staff')
      and status in ('valid', 'warning')
      and review_status <> 'skipped'
  ), imported_people as (
    insert into public.people (
      person_type, source_identifier, prefix_th, first_name_th, last_name_th,
      full_name_th, full_name_en, gender, organization_unit_id,
      program_or_position, source_system, active, created_by, updated_by, updated_at
    )
    select
      (person.normalized_data ->> 'person_type')::public.person_type,
      person.normalized_data ->> 'source_identifier',
      nullif(person.normalized_data ->> 'prefix_th', ''),
      nullif(person.normalized_data ->> 'first_name_th', ''),
      nullif(person.normalized_data ->> 'last_name_th', ''),
      person.normalized_data ->> 'full_name_th',
      nullif(person.normalized_data ->> 'full_name_en', ''),
      nullif(person.normalized_data ->> 'gender', ''),
      unit.id,
      nullif(person.normalized_data ->> 'program_or_position', ''),
      nullif(person.normalized_data ->> 'source_system', ''),
      coalesce((person.normalized_data ->> 'active')::boolean, true),
      actor_id,
      actor_id,
      now()
    from people_source person
    left join staged_units unit_source on unit_source.source_id = person.normalized_data ->> 'unit_source_id'
    left join public.organization_units unit on unit.code = unit_source.code
    on conflict (person_type, source_identifier) where source_identifier is not null do update set
      prefix_th = excluded.prefix_th,
      first_name_th = excluded.first_name_th,
      last_name_th = excluded.last_name_th,
      full_name_th = excluded.full_name_th,
      full_name_en = excluded.full_name_en,
      gender = excluded.gender,
      organization_unit_id = excluded.organization_unit_id,
      program_or_position = excluded.program_or_position,
      source_system = excluded.source_system,
      active = excluded.active,
      updated_by = actor_id,
      updated_at = now()
    returning person_type
  )
  select
    count(*) filter (where person_type = 'student'::public.person_type),
    count(*) filter (where person_type = 'staff'::public.person_type)
  into student_rows, staff_rows
  from imported_people;

  -- Record the real canonical identity for both inserts and intentional
  -- master upserts. Raw source snapshots and review decisions stay unchanged.
  with committed_targets as (
    select row.id as import_row_id, country.id as target_id
    from public.import_rows row
    join public.countries country on country.iso2 = row.normalized_data ->> 'iso2'
    where row.batch_id = target_batch_id and row.master_entity = 'country'
    union all
    select row.id, unit.id
    from public.import_rows row
    join public.organization_units unit on unit.code = row.normalized_data ->> 'code'
    where row.batch_id = target_batch_id and row.master_entity = 'organization_unit'
    union all
    select row.id, partner.id
    from public.import_rows row
    join public.partner_organizations partner on partner.legacy_id = row.normalized_data ->> 'legacy_id'
    where row.batch_id = target_batch_id and row.master_entity = 'partner_organization'
    union all
    select row.id, person.id
    from public.import_rows row
    join public.people person
      on person.person_type::text = row.master_entity::text
      and person.source_identifier = row.normalized_data ->> 'source_identifier'
    where row.batch_id = target_batch_id and row.master_entity in ('student', 'staff')
  )
  update public.import_rows row
  set status = 'imported', target_record_id = target.target_id
  from committed_targets target
  where row.id = target.import_row_id and row.review_status <> 'skipped';

  update public.import_batches
  set status = 'completed', committed_at = now()
  where id = target_batch_id;

  return jsonb_build_object(
    'batch_id', target_batch_id,
    'countries', country_rows,
    'organization_units', unit_rows,
    'partner_organizations', partner_rows,
    'students', student_rows,
    'staff', staff_rows,
    'total_rows', country_rows + unit_rows + partner_rows + student_rows + staff_rows
  );
end;
$$;

revoke all on function public.commit_master_import_batch(uuid) from public, anon;
grant execute on function public.commit_master_import_batch(uuid) to authenticated;

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
  perform 1 from public.import_rows where batch_id = target_batch_id for update;

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
    do nothing
    returning * into movement_record;

    if not found then
      raise exception 'STUDENT_MOBILITY_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION' using errcode = '23514';
    end if;

    target_movement_uuid := movement_record.id;

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

-- Import legacy public MOU data only after it has been staged and reviewed.
-- The function is intentionally System Admin-only and commits the complete
-- batch in one transaction so a partial legacy import cannot leak through.
create or replace function public.commit_legacy_mou_import_batch(target_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  batch_record public.import_batches%rowtype;
  row_record public.import_rows%rowtype;
  agreement_record public.agreements%rowtype;
  target_partner_id uuid;
  committed_count integer := 0;
  skipped_count integer := 0;
  source_status text;
  target_status public.agreement_status;
  target_workflow public.workflow_status;
  target_publication public.publication_status;
  target_public_visible boolean;
begin
  if actor_id is null or not private.has_role('system_admin') then
    raise exception 'LEGACY_MOU_IMPORT_FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into batch_record
  from public.import_batches
  where id = target_batch_id
    and module = 'mou'::public.module_key
    and import_kind = 'module_data'::public.import_kind
    and source_file_path = 'v2.public.mou.list'
  for update;

  if not found then
    raise exception 'LEGACY_MOU_IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if batch_record.status <> 'ready'::public.import_status
     or batch_record.committed_at is not null then
    raise exception 'LEGACY_MOU_IMPORT_NOT_READY' using errcode = '23514';
  end if;
  perform 1 from public.import_rows where batch_id = target_batch_id for update;

  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and status = 'invalid'::public.import_row_status
      and review_status <> 'skipped'::public.import_review_status
  ) then
    raise exception 'LEGACY_MOU_IMPORT_HAS_INVALID_ROWS' using errcode = '23514';
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
    raise exception 'LEGACY_MOU_IMPORT_REVIEW_INCOMPLETE' using errcode = '23514';
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
      skipped_count := skipped_count + 1;
      continue;
    end if;

    source_status := lower(coalesce(row_record.normalized_data ->> 'sourceStatus', ''));
    target_status := case
      when source_status = 'active' then 'active'::public.agreement_status
      when source_status = 'expired' then 'expired'::public.agreement_status
      when source_status = 'terminated' then 'terminated'::public.agreement_status
      else 'draft'::public.agreement_status
    end;
    target_workflow := case
      when target_status = 'active'::public.agreement_status
        then 'active'::public.workflow_status
      when target_status in (
        'expired'::public.agreement_status,
        'terminated'::public.agreement_status
      )
        then 'completed'::public.workflow_status
      else 'draft'::public.workflow_status
    end;
    target_public_visible := target_status = 'active'::public.agreement_status;
    target_publication := case
      when target_public_visible then 'published'::public.publication_status
      else 'archived'::public.publication_status
    end;

    insert into public.agreements (
      legacy_id,
      title_th,
      title_en,
      agreement_type,
      start_date,
      end_date,
      fiscal_year,
      status,
      workflow_status,
      publication_status,
      public_visible,
      internal_note,
      created_by,
      updated_by
    ) values (
      row_record.normalized_data ->> 'legacyId',
      row_record.normalized_data ->> 'titleTh',
      nullif(row_record.normalized_data ->> 'titleEn', ''),
      nullif(row_record.normalized_data ->> 'agreementType', ''),
      nullif(row_record.normalized_data ->> 'startDate', '')::date,
      nullif(row_record.normalized_data ->> 'endDate', '')::date,
      nullif(row_record.normalized_data ->> 'fiscalYear', '')::integer,
      target_status,
      target_workflow,
      target_publication,
      target_public_visible,
      'นำเข้าจาก iROUP เดิมผ่าน staging batch ' || target_batch_id::text,
      actor_id,
      actor_id
    )
    on conflict (legacy_id)
    do nothing
    returning *
    into agreement_record;

    if not found then
      raise exception 'LEGACY_MOU_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION' using errcode = '23514';
    end if;


    target_partner_id := nullif(
      row_record.normalized_data ->> 'partnerOrganizationId',
      ''
    )::uuid;
    if target_partner_id is null then
      select id
      into target_partner_id
      from public.partner_organizations
      where lower(
        regexp_replace(
          coalesce(nullif(name_en, ''), nullif(name_th, ''), ''),
          '[^[:alnum:]]+',
          '',
          'g'
        )
      ) = lower(
        regexp_replace(
          coalesce(
            nullif(row_record.normalized_data ->> 'partnerNameEn', ''),
            nullif(row_record.normalized_data ->> 'partnerNameTh', ''),
            ''
          ),
          '[^[:alnum:]]+',
          '',
          'g'
        )
      )
      and active
      order by created_at
      limit 1;
    end if;
    if target_partner_id is null then
      insert into public.partner_organizations (
        name_th,
        name_en,
        country_id,
        active,
        verification_status,
        source_note,
        created_by,
        updated_by
      ) values (
        nullif(row_record.normalized_data ->> 'partnerNameTh', ''),
        nullif(row_record.normalized_data ->> 'partnerNameEn', ''),
        nullif(row_record.normalized_data ->> 'countryId', '')::uuid,
        true,
        'verified',
        'สร้างจาก MOU ใน public API ของ iROUP เดิมผ่าน staging batch '
          || target_batch_id::text,
        actor_id,
        actor_id
      )
      returning id into target_partner_id;
    end if;

    insert into public.agreement_partners (
      agreement_id,
      partner_organization_id,
      is_lead,
      created_by,
      partner_name_th_snapshot,
      partner_name_en_snapshot,
      country_id_snapshot,
      country_name_th_snapshot,
      country_name_en_snapshot,
      continent_code_snapshot,
      country_source
    ) values (
      agreement_record.id,
      target_partner_id,
      true,
      actor_id,
      nullif(row_record.normalized_data ->> 'partnerNameTh', ''),
      nullif(row_record.normalized_data ->> 'partnerNameEn', ''),
      nullif(row_record.normalized_data ->> 'countryId', '')::uuid,
      nullif(row_record.normalized_data ->> 'countryNameTh', ''),
      nullif(row_record.normalized_data ->> 'countryNameEn', ''),
      nullif(row_record.normalized_data ->> 'continentCode', ''),
      'legacy_snapshot'
    );

    insert into public.agreement_units (
      agreement_id,
      organization_unit_id,
      is_owner,
      created_by
    ) values (
      agreement_record.id,
      (row_record.normalized_data ->> 'ownerUnitId')::uuid,
      true,
      actor_id
    );

    update public.import_rows
    set status = 'imported'::public.import_row_status,
        target_record_id = agreement_record.id
    where id = row_record.id;

    committed_count := committed_count + 1;
  end loop;

  update public.import_batches
  set status = 'completed'::public.import_status,
      committed_at = now()
  where id = target_batch_id;

  return jsonb_build_object(
    'batch_id', target_batch_id,
    'agreements', committed_count,
    'skipped', skipped_count
  );
end;
$$;

revoke all on function public.commit_legacy_mou_import_batch(uuid)
from public, anon;
grant execute on function public.commit_legacy_mou_import_batch(uuid)
to authenticated;

create or replace function public.commit_legacy_contact_import_batch(target_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  batch_record public.import_batches%rowtype;
  row_record public.import_rows%rowtype;
  contact_record public.partner_contacts%rowtype;
  committed_count integer := 0;
  skipped_count integer := 0;
begin
  if actor_id is null or not private.has_role('system_admin') then
    raise exception 'LEGACY_CONTACT_IMPORT_FORBIDDEN' using errcode = '42501';
  end if;

  -- The contact natural key has no unique index. Serialize legacy contact
  -- commits across batches so a second import sees the first committed contact
  -- before deciding whether it is new. Existing contact rows are still locked
  -- below; no historical data needs deduplication to add this guard.
  perform pg_catalog.pg_advisory_xact_lock(720001::bigint);

  select *
  into batch_record
  from public.import_batches
  where id = target_batch_id
    and module = 'mou'::public.module_key
    and import_kind = 'module_data'::public.import_kind
    and source_file_path = 'legacy_partner_contacts'
  for update;

  if not found then
    raise exception 'LEGACY_CONTACT_IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if batch_record.status <> 'ready'::public.import_status
     or batch_record.committed_at is not null then
    raise exception 'LEGACY_CONTACT_IMPORT_NOT_READY' using errcode = '23514';
  end if;
  perform 1 from public.import_rows where batch_id = target_batch_id for update;

  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and status = 'invalid'::public.import_row_status
      and review_status <> 'skipped'::public.import_review_status
  ) then
    raise exception 'LEGACY_CONTACT_IMPORT_HAS_INVALID_ROWS' using errcode = '23514';
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
    raise exception 'LEGACY_CONTACT_IMPORT_REVIEW_INCOMPLETE' using errcode = '23514';
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
      skipped_count := skipped_count + 1;
      continue;
    end if;

    select *
    into contact_record
    from public.partner_contacts
    where partner_organization_id =
      (row_record.normalized_data ->> 'partnerOrganizationId')::uuid
      and lower(btrim(full_name)) =
        lower(btrim(row_record.normalized_data ->> 'fullName'))
      and deleted_at is null
    order by created_at
    limit 1
    for update;

    if found then
      raise exception 'LEGACY_CONTACT_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION' using errcode = '23514';
    else
      insert into public.partner_contacts (
        partner_organization_id,
        full_name,
        position_title,
        department,
        expertise_areas,
        relationship_level,
        preferred_language,
        internal_note,
        source_import_batch_id,
        source_row_number,
        last_contacted_on,
        active,
        created_by,
        updated_by
      ) values (
        (row_record.normalized_data ->> 'partnerOrganizationId')::uuid,
        row_record.normalized_data ->> 'fullName',
        nullif(row_record.normalized_data ->> 'positionTitle', ''),
        nullif(row_record.normalized_data ->> 'department', ''),
        coalesce(
          array(
            select jsonb_array_elements_text(
              coalesce(row_record.normalized_data -> 'expertiseAreas', '[]'::jsonb)
            )
          ),
          '{}'::text[]
        ),
        coalesce(
          nullif(row_record.normalized_data ->> 'relationshipLevel', '')::public.relationship_level,
          'unrated'::public.relationship_level
        ),
        nullif(row_record.normalized_data ->> 'preferredLanguage', ''),
        nullif(row_record.normalized_data ->> 'internalNote', ''),
        target_batch_id,
        row_record.row_number,
        nullif(row_record.normalized_data ->> 'lastContactedOn', '')::date,
        true,
        actor_id,
        actor_id
      )
      returning * into contact_record;
    end if;

    insert into public.partner_contact_methods (
      partner_contact_id,
      method_type,
      value,
      is_primary,
      active,
      created_by,
      updated_by
    )
    select
      contact_record.id,
      method.method_type::public.contact_method_type,
      method.value,
      method.ordinality = 1,
      true,
      actor_id,
      actor_id
    from rows from (
      jsonb_to_recordset(
        coalesce(row_record.normalized_data -> 'contactMethods', '[]'::jsonb)
      ) as (method_type text, value text)
    ) with ordinality as method(method_type, value, ordinality)
    where nullif(btrim(method.value), '') is not null;

    update public.import_rows
    set status = 'imported'::public.import_row_status,
        target_record_id = contact_record.id
    where id = row_record.id;

    committed_count := committed_count + 1;
  end loop;

  update public.import_batches
  set status = 'completed'::public.import_status,
      committed_at = now()
  where id = target_batch_id;

  return jsonb_build_object(
    'batch_id', target_batch_id,
    'contacts', committed_count,
    'skipped', skipped_count
  );
end;
$$;

revoke all on function public.commit_legacy_contact_import_batch(uuid)
from public, anon;
grant execute on function public.commit_legacy_contact_import_batch(uuid)
to authenticated;

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
  if actor_id is null or not private.has_role('system_admin') then
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
  perform 1 from public.import_rows where batch_id = target_batch_id for update;

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
    do nothing
    returning *
    into movement_record;

    if not found then
      raise exception 'LEGACY_TRAVEL_IMPORT_EXISTING_RECORD_REQUIRES_RECONCILIATION' using errcode = '23514';
    end if;


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
