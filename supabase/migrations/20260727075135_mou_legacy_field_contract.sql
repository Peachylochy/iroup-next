-- MOU legacy compatibility contract approved in
-- docs/MOU_PRESERVE_IMPROVE_RETIRE_MATRIX.md.

create function private.mou_thai_fiscal_year(target_date date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(year from target_date)::integer
    + 543
    + case when extract(month from target_date)::integer >= 10 then 1 else 0 end;
$$;

create function private.mou_set_fiscal_year()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.start_date is not null then
    new.fiscal_year := private.mou_thai_fiscal_year(new.start_date);
  end if;
  return new;
end;
$$;

drop trigger if exists agreements_set_mou_fiscal_year on public.agreements;
create trigger agreements_set_mou_fiscal_year
before insert or update of start_date on public.agreements
for each row execute function private.mou_set_fiscal_year();

update public.agreements
set fiscal_year = private.mou_thai_fiscal_year(start_date)
where start_date is not null
  and deleted_at is null;

alter table public.agreement_partners
  add column partner_name_th_snapshot text,
  add column partner_name_en_snapshot text,
  add column country_id_snapshot uuid references public.countries (id) on delete restrict,
  add column country_name_th_snapshot text,
  add column country_name_en_snapshot text,
  add column continent_code_snapshot text,
  add column country_source text not null default 'partner_master'
    check (country_source in ('partner_master', 'agreement_override')),
  add column country_override_reason text,
  add constraint agreement_partner_override_reason_required check (
    country_source <> 'agreement_override'
    or nullif(btrim(country_override_reason), '') is not null
  );

create function private.mou_snapshot_partner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  partner_record public.partner_organizations%rowtype;
  country_record public.countries%rowtype;
  effective_country_id uuid;
begin
  select * into partner_record
  from public.partner_organizations
  where id = new.partner_organization_id;

  if not found then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514', detail = 'The selected partner organization does not exist.';
  end if;

  effective_country_id := coalesce(new.country_id_snapshot, partner_record.country_id);

  if new.country_id_snapshot is not null
    and new.country_id_snapshot is distinct from partner_record.country_id then
    new.country_source := 'agreement_override';
  else
    new.country_source := 'partner_master';
    new.country_override_reason := null;
  end if;

  if effective_country_id is not null then
    select * into country_record
    from public.countries
    where id = effective_country_id;
  end if;

  new.partner_name_th_snapshot := coalesce(new.partner_name_th_snapshot, partner_record.name_th);
  new.partner_name_en_snapshot := coalesce(new.partner_name_en_snapshot, partner_record.name_en);
  new.country_id_snapshot := effective_country_id;
  new.country_name_th_snapshot := case when found then country_record.name_th else null end;
  new.country_name_en_snapshot := case when found then country_record.name_en else null end;
  new.continent_code_snapshot := case when found then country_record.continent_code else null end;
  return new;
end;
$$;

drop trigger if exists agreement_partners_snapshot_partner on public.agreement_partners;
create trigger agreement_partners_snapshot_partner
before insert or update of partner_organization_id, country_id_snapshot on public.agreement_partners
for each row execute function private.mou_snapshot_partner();

-- Backfill any agreements that existed before snapshot columns were introduced.
update public.agreement_partners
set partner_organization_id = partner_organization_id;

alter table public.agreement_workflow_events
  drop constraint agreement_workflow_events_action_check,
  add constraint agreement_workflow_events_action_check check (
    action in (
      'created', 'saved_draft', 'submitted_for_review', 'returned_to_draft',
      'published', 'archived', 'terminated', 'deleted', 'restored'
    )
  );

create or replace function private.mou_validate_ready_for_review(
  target_agreement_id uuid,
  require_signed_date boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
begin
  select * into agreement_record
  from public.agreements
  where id = target_agreement_id and deleted_at is null;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;

  if nullif(btrim(agreement_record.title_th), '') is null
    or nullif(btrim(agreement_record.agreement_type), '') is null
    or agreement_record.start_date is null
    or agreement_record.fiscal_year is null then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514',
      detail = 'Complete title, type, start date, and fiscal year before submitting.';
  end if;

  if agreement_record.end_date is not null
    and agreement_record.end_date < agreement_record.start_date then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514', detail = 'End date cannot be before start date.';
  end if;

  if require_signed_date and agreement_record.signed_date is null then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514', detail = 'A signed date is required before publishing.';
  end if;

  if not exists (
    select 1 from public.agreement_partners
    where agreement_id = target_agreement_id
  ) or (
    select count(*) from public.agreement_partners
    where agreement_id = target_agreement_id and is_lead
  ) <> 1 then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Select partners and exactly one lead partner before submitting.';
  end if;

  if exists (
    select 1 from public.agreement_partners
    where agreement_id = target_agreement_id and is_lead
      and country_id_snapshot is null
  ) then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514', detail = 'The lead partner must have a country before submitting.';
  end if;

  if require_signed_date and exists (
    select 1
    from public.agreement_partners ap
    join public.partner_organizations po on po.id = ap.partner_organization_id
    where ap.agreement_id = target_agreement_id
      and po.verification_status <> 'verified'
  ) then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Verify every partner organization before publishing.';
  end if;

  if (
    select count(*) from public.agreement_units
    where agreement_id = target_agreement_id and is_owner
  ) <> 1 then
    raise exception 'MOU_VALIDATION_FAILED'
      using errcode = '23514', detail = 'Select exactly one owner unit before submitting.';
  end if;
end;
$$;

-- MOU attachment metadata is private even if the agreement itself is public.
drop policy record_assets_anon_select on public.record_assets;
create policy record_assets_anon_select
on public.record_assets for select
to anon
using (
  (movement_id is not null and exists (
    select 1 from public.movement_cases
    where id = record_assets.movement_id and publication_status = 'published'
      and public_visible and deleted_at is null
  ))
  or (scholarship_id is not null and exists (
    select 1 from public.scholarships
    where id = record_assets.scholarship_id and publication_status = 'published'
      and public_visible and deleted_at is null
  ))
  or (event_id is not null and exists (
    select 1 from public.events
    where id = record_assets.event_id and publication_status = 'published'
      and public_visible and deleted_at is null
  ))
  or (news_id is not null and exists (
    select 1 from public.news_articles
    where id = record_assets.news_id and publication_status = 'published'
      and public_visible and deleted_at is null
  ))
  or (knowledge_id is not null and exists (
    select 1 from public.knowledge_items
    where id = record_assets.knowledge_id and publication_status = 'published'
      and public_visible and deleted_at is null
  ))
);

create function public.mou_soft_delete(
  target_agreement_id uuid,
  expected_updated_at timestamptz,
  delete_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
  actor_id uuid := auth.uid();
begin
  perform private.mou_require_permission('delete');

  select * into agreement_record
  from public.agreements
  where id = target_agreement_id and deleted_at is null
  for update;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;
  if expected_updated_at is null or agreement_record.updated_at <> expected_updated_at then
    raise exception 'MOU_CONFLICT' using errcode = '40001';
  end if;

  update public.agreements
  set deleted_at = now(), deleted_by = actor_id, public_visible = false,
      publication_status = 'archived', workflow_status = 'archived', updated_by = actor_id
  where id = target_agreement_id;

  insert into public.agreement_workflow_events (
    agreement_id, action, from_status, to_status, note, created_by
  ) values (
    target_agreement_id, 'deleted', agreement_record.workflow_status, 'archived',
    nullif(btrim(delete_note), ''), actor_id
  );

  return jsonb_build_object(
    'id', target_agreement_id,
    'purge_files_after', now() + interval '30 days'
  );
end;
$$;

create function public.mou_restore(target_agreement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement_record public.agreements%rowtype;
  actor_id uuid := auth.uid();
begin
  if not private.is_admin() then
    raise exception 'MOU_FORBIDDEN' using errcode = '42501';
  end if;

  select * into agreement_record
  from public.agreements
  where id = target_agreement_id and deleted_at is not null
  for update;

  if not found then
    raise exception 'MOU_NOT_FOUND' using errcode = 'P0002';
  end if;
  if agreement_record.deleted_at <= now() - interval '30 days' then
    raise exception 'MOU_RETENTION_EXPIRED'
      using errcode = '23514', detail = 'Files may already have been permanently purged.';
  end if;

  update public.agreements
  set deleted_at = null, deleted_by = null, workflow_status = 'draft',
      status = 'draft', publication_status = 'draft', public_visible = false,
      updated_by = actor_id
  where id = target_agreement_id;

  insert into public.agreement_workflow_events (
    agreement_id, action, from_status, to_status, created_by
  ) values (target_agreement_id, 'restored', 'archived', 'draft', actor_id);

  return jsonb_build_object('id', target_agreement_id, 'workflow_status', 'draft');
end;
$$;

revoke all on function private.mou_thai_fiscal_year(date) from public, anon, authenticated;
revoke all on function private.mou_set_fiscal_year() from public, anon, authenticated;
revoke all on function private.mou_snapshot_partner() from public, anon, authenticated;
revoke all on function public.mou_soft_delete(uuid, timestamptz, text) from public, anon;
revoke all on function public.mou_restore(uuid) from public, anon;
grant execute on function public.mou_soft_delete(uuid, timestamptz, text) to authenticated;
grant execute on function public.mou_restore(uuid) to authenticated;
