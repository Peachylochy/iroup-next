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
  if not private.is_admin() then
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

  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and status in ('invalid', 'duplicate')
  ) then
    raise exception 'MASTER_IMPORT_HAS_UNRESOLVED_ROWS' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and change_action = 'skip'
  ) then
    raise exception 'MASTER_IMPORT_HAS_SKIPPED_ROWS' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.import_rows
    where batch_id = target_batch_id
      and master_entity = 'country'
      and (
        nullif(normalized_data ->> 'iso2', '') is null
        or nullif(normalized_data ->> 'iso3', '') is null
        or (nullif(normalized_data ->> 'name_th', '') is null and nullif(normalized_data ->> 'name_en', '') is null)
      )
  ) then
    raise exception 'MASTER_IMPORT_COUNTRY_DATA_INCOMPLETE' using errcode = 'P0001';
  end if;

  -- A partner and a person may point to a master row from the same batch.
  -- Verify those source identifiers before writing any destination table.
  if exists (
    with staged_countries as (
      select source_data ->> 'country_id' as source_id
      from public.import_rows
      where batch_id = target_batch_id and master_entity = 'country'
    )
    select 1
    from public.import_rows partner_row
    where partner_row.batch_id = target_batch_id
      and partner_row.master_entity = 'partner_organization'
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
      from public.import_rows
      where batch_id = target_batch_id and master_entity = 'organization_unit'
    )
    select 1
    from public.import_rows person_row
    where person_row.batch_id = target_batch_id
      and person_row.master_entity in ('student', 'staff')
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
      and status in ('valid', 'warning')
  )
  update public.organization_units child
  set parent_id = parent.id,
      updated_at = now()
  from staged_units child_source
  join staged_units parent_source on parent_source.source_id = child_source.parent_source_id
  join public.organization_units parent on parent.code = parent_source.code
  where child.code = child_source.code
    and child_source.parent_source_id is not null;

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
