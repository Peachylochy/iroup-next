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
  if actor_id is null or not private.is_admin() then
    raise exception 'LEGACY_CONTACT_IMPORT_FORBIDDEN' using errcode = '42501';
  end if;

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
      update public.partner_contacts
      set position_title = nullif(row_record.normalized_data ->> 'positionTitle', ''),
          department = nullif(row_record.normalized_data ->> 'department', ''),
          expertise_areas = coalesce(
            array(
              select jsonb_array_elements_text(
                coalesce(row_record.normalized_data -> 'expertiseAreas', '[]'::jsonb)
              )
            ),
            '{}'::text[]
          ),
          relationship_level = coalesce(
            nullif(row_record.normalized_data ->> 'relationshipLevel', '')::public.relationship_level,
            'unrated'::public.relationship_level
          ),
          preferred_language = nullif(
            row_record.normalized_data ->> 'preferredLanguage',
            ''
          ),
          internal_note = nullif(row_record.normalized_data ->> 'internalNote', ''),
          source_import_batch_id = target_batch_id,
          source_row_number = row_record.row_number,
          last_contacted_on = nullif(
            row_record.normalized_data ->> 'lastContactedOn',
            ''
          )::date,
          active = true,
          updated_by = actor_id
      where id = contact_record.id
      returning * into contact_record;
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

    delete from public.partner_contact_methods
    where partner_contact_id = contact_record.id;

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
