create or replace function public.partner_contact_save(
  target_contact_id uuid,
  expected_updated_at timestamptz,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  actor_id uuid := auth.uid();
  saved public.partner_contacts;
  contact_id uuid;
  method jsonb;
  method_type_value public.contact_method_type;
begin
  if actor_id is null or not private.can_access_module('mou', case when target_contact_id is null then 'create' else 'update' end) then
    raise exception using errcode = '42501', message = 'PARTNER_CONTACT_FORBIDDEN';
  end if;

  if nullif(btrim(payload ->> 'full_name'), '') is null
     or nullif(payload ->> 'partner_organization_id', '') is null then
    raise exception using errcode = '22023', message = 'PARTNER_CONTACT_VALIDATION_FAILED',
      detail = 'กรุณาระบุชื่อผู้ติดต่อและองค์กร';
  end if;

  if not exists (
    select 1 from public.partner_organizations
    where id = (payload ->> 'partner_organization_id')::uuid
      and active
  ) then
    raise exception using errcode = '22023', message = 'PARTNER_CONTACT_VALIDATION_FAILED',
      detail = 'ไม่พบองค์กรที่เลือกในข้อมูลอ้างอิง';
  end if;

  if target_contact_id is null then
    insert into public.partner_contacts (
      partner_organization_id,
      full_name,
      position_title,
      department,
      expertise_areas,
      relationship_level,
      preferred_language,
      internal_note,
      last_contacted_on,
      active,
      created_by
    )
    values (
      (payload ->> 'partner_organization_id')::uuid,
      btrim(payload ->> 'full_name'),
      nullif(btrim(payload ->> 'position_title'), ''),
      nullif(btrim(payload ->> 'department'), ''),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(payload -> 'expertise_areas', '[]'::jsonb))),
        '{}'::text[]
      ),
      coalesce(nullif(payload ->> 'relationship_level', '')::public.relationship_level, 'unrated'),
      nullif(btrim(payload ->> 'preferred_language'), ''),
      nullif(btrim(payload ->> 'internal_note'), ''),
      nullif(payload ->> 'last_contacted_on', '')::date,
      coalesce((payload ->> 'active')::boolean, true),
      actor_id
    )
    returning * into saved;
  else
    update public.partner_contacts
    set
      partner_organization_id = (payload ->> 'partner_organization_id')::uuid,
      full_name = btrim(payload ->> 'full_name'),
      position_title = nullif(btrim(payload ->> 'position_title'), ''),
      department = nullif(btrim(payload ->> 'department'), ''),
      expertise_areas = coalesce(
        array(select jsonb_array_elements_text(coalesce(payload -> 'expertise_areas', '[]'::jsonb))),
        '{}'::text[]
      ),
      relationship_level = coalesce(nullif(payload ->> 'relationship_level', '')::public.relationship_level, 'unrated'),
      preferred_language = nullif(btrim(payload ->> 'preferred_language'), ''),
      internal_note = nullif(btrim(payload ->> 'internal_note'), ''),
      last_contacted_on = nullif(payload ->> 'last_contacted_on', '')::date,
      active = coalesce((payload ->> 'active')::boolean, true),
      updated_by = actor_id,
      updated_at = now()
    where id = target_contact_id
      and deleted_at is null
      and (expected_updated_at is null or updated_at = expected_updated_at)
    returning * into saved;

    if saved.id is null then
      if exists (select 1 from public.partner_contacts where id = target_contact_id and deleted_at is null) then
        raise exception using errcode = '40001', message = 'PARTNER_CONTACT_CONFLICT';
      end if;
      raise exception using errcode = 'P0002', message = 'PARTNER_CONTACT_NOT_FOUND';
    end if;
  end if;

  contact_id := saved.id;
  delete from public.partner_contact_methods where partner_contact_id = contact_id;

  for method in select value from jsonb_array_elements(coalesce(payload -> 'methods', '[]'::jsonb))
  loop
    if nullif(btrim(method ->> 'value'), '') is null then
      continue;
    end if;
    method_type_value := coalesce(nullif(method ->> 'method_type', '')::public.contact_method_type, 'other');
    insert into public.partner_contact_methods (
      partner_contact_id,
      method_type,
      value,
      label,
      is_primary,
      active,
      created_by
    )
    values (
      contact_id,
      method_type_value,
      btrim(method ->> 'value'),
      nullif(btrim(method ->> 'label'), ''),
      coalesce((method ->> 'is_primary')::boolean, false),
      true,
      actor_id
    );
  end loop;

  return jsonb_build_object(
    'id', saved.id,
    'updated_at', saved.updated_at
  );
end;
$$;

revoke all on function public.partner_contact_save(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.partner_contact_save(uuid, timestamptz, jsonb) to authenticated;
