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
  if actor_id is null or not private.is_admin() then
    raise exception 'LEGACY_MOU_IMPORT_FORBIDDEN' using errcode = '42501';
  end if;

  select *
  into batch_record
  from public.import_batches
  where id = target_batch_id
    and module = 'mou'::public.module_key
    and import_kind = 'module_data'::public.import_kind
  for update;

  if not found then
    raise exception 'LEGACY_MOU_IMPORT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if batch_record.status <> 'ready'::public.import_status
     or batch_record.committed_at is not null then
    raise exception 'LEGACY_MOU_IMPORT_NOT_READY' using errcode = '23514';
  end if;
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
    do update set
      title_th = excluded.title_th,
      title_en = excluded.title_en,
      agreement_type = excluded.agreement_type,
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
    returning *
    into agreement_record;

    delete from public.agreement_partners
    where agreement_id = agreement_record.id;
    delete from public.agreement_units
    where agreement_id = agreement_record.id;

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
