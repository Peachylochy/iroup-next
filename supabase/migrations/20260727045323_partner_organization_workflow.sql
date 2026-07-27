-- Partner organizations are shared master data for MOU work. New organizations
-- may be recorded from an incoming signing request, then verified before use as
-- a confirmed directory entry.

alter table public.partner_organizations
  alter column name_en drop not null,
  add column verification_status text not null default 'pending_verification'
    check (verification_status in ('pending_verification', 'verified', 'incomplete')),
  add column source_note text;

create index partner_organizations_lookup_idx
  on public.partner_organizations (verification_status, active, name_en);

drop policy partner_organizations_internal_insert on public.partner_organizations;
drop policy partner_organizations_internal_update on public.partner_organizations;
drop policy partner_organizations_admin_delete on public.partner_organizations;

create function private.partner_organization_require_permission(required_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_access_module('mou', required_action) then
    raise exception 'PARTNER_ORGANIZATION_FORBIDDEN'
      using errcode = '42501';
  end if;
end;
$$;

create function public.partner_organization_save(
  target_partner_id uuid,
  expected_updated_at timestamptz,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_partner public.partner_organizations%rowtype;
  requested_status text := coalesce(nullif(btrim(payload ->> 'verification_status'), ''), 'pending_verification');
  requested_name_th text := nullif(btrim(payload ->> 'name_th'), '');
  requested_name_en text := nullif(btrim(payload ->> 'name_en'), '');
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'PARTNER_ORGANIZATION_FORBIDDEN' using errcode = '42501';
  end if;

  if requested_name_th is null and requested_name_en is null then
    raise exception 'PARTNER_ORGANIZATION_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Enter at least a Thai or English organization name.';
  end if;

  if requested_status not in ('pending_verification', 'verified', 'incomplete') then
    raise exception 'PARTNER_ORGANIZATION_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Unsupported verification status.';
  end if;

  if requested_status = 'verified' and not private.can_access_module('mou', 'publish') then
    raise exception 'PARTNER_ORGANIZATION_FORBIDDEN' using errcode = '42501';
  end if;

  if target_partner_id is null then
    perform private.partner_organization_require_permission('create');

    if exists (
      select 1
      from public.partner_organizations
      where lower(coalesce(name_en, name_th)) = lower(coalesce(requested_name_en, requested_name_th))
    ) then
      raise exception 'PARTNER_ORGANIZATION_DUPLICATE'
        using errcode = '23505', detail = 'An organization with the same name already exists.';
    end if;

    insert into public.partner_organizations (
      name_th, name_en, organization_type, country_id, city, website_url,
      verification_status, source_note, created_by, updated_by
    )
    values (
      requested_name_th, requested_name_en, nullif(btrim(payload ->> 'organization_type'), ''),
      nullif(payload ->> 'country_id', '')::uuid, nullif(btrim(payload ->> 'city'), ''),
      nullif(btrim(payload ->> 'website_url'), ''), requested_status,
      nullif(btrim(payload ->> 'source_note'), ''), actor_id, actor_id
    )
    returning * into saved_partner;
  else
    perform private.partner_organization_require_permission('update');

    select * into saved_partner
    from public.partner_organizations
    where id = target_partner_id
    for update;

    if not found then
      raise exception 'PARTNER_ORGANIZATION_NOT_FOUND' using errcode = 'P0002';
    end if;

    if expected_updated_at is null or saved_partner.updated_at <> expected_updated_at then
      raise exception 'PARTNER_ORGANIZATION_CONFLICT'
        using errcode = '40001', detail = 'The organization was changed by another user.';
    end if;

    update public.partner_organizations
    set
      name_th = requested_name_th,
      name_en = requested_name_en,
      organization_type = nullif(btrim(payload ->> 'organization_type'), ''),
      country_id = nullif(payload ->> 'country_id', '')::uuid,
      city = nullif(btrim(payload ->> 'city'), ''),
      website_url = nullif(btrim(payload ->> 'website_url'), ''),
      verification_status = requested_status,
      source_note = nullif(btrim(payload ->> 'source_note'), ''),
      updated_by = actor_id
    where id = target_partner_id
    returning * into saved_partner;
  end if;

  return jsonb_build_object(
    'id', saved_partner.id,
    'updated_at', saved_partner.updated_at,
    'verification_status', saved_partner.verification_status
  );
end;
$$;

revoke all on function public.partner_organization_save(uuid, timestamptz, jsonb)
  from public, anon;
grant execute on function public.partner_organization_save(uuid, timestamptz, jsonb)
  to authenticated;
