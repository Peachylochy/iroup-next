-- Travel's authenticated workspace list. Run under the caller's RLS rather
-- than a privileged owner, and return only the bounded list projection.
create function public.travel_list_v2(
  p_q text default '',
  p_status text default '',
  p_country uuid default null,
  p_unit uuid default null,
  p_year integer default null,
  p_sort text default 'updated_desc',
  p_page integer default 1
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  search_text text := lower(left(btrim(coalesce(p_q, '')), 200));
  requested_sort text := case when p_sort in ('updated_desc', 'start_desc', 'start_asc', 'name_asc')
    then p_sort else 'updated_desc' end;
  result jsonb;
begin
  -- Published rows have a separate public-read policy. That policy must not
  -- expose workspace totals or filter metadata to a revoked/inactive user.
  if auth.uid() is null or not private.can_access_module('travel', 'view') then
    raise exception 'TRAVEL_LIST_FORBIDDEN' using errcode = '42501';
  end if;

  if coalesce(p_status, '') not in ('', 'draft', 'under_review', 'approved', 'active', 'completed', 'cancelled', 'archived')
    or (p_year is not null and p_year not between 1900 and 3000) then
    raise exception 'TRAVEL_LIST_INVALID_FILTER' using errcode = '22023';
  end if;

  with visible as materialized (
    select
      movement.id, movement.project_name, movement.title_en,
      movement.country_id, movement.owner_unit_id,
      coalesce(nullif(movement.country_name_snapshot, ''), nullif(country.name_th, ''), country.name_en) as country_name,
      coalesce(nullif(movement.partner_name_snapshot, ''), nullif(partner.name_th, ''), partner.name_en) as partner_name,
      coalesce(nullif(unit.name_th, ''), unit.name_en) as owner_unit_name,
      coalesce(nullif(country.name_th, ''), nullif(country.name_en, ''), nullif(movement.country_name_snapshot, ''), 'ไม่ระบุชื่อประเทศ') as country_filter_name,
      movement.start_date, movement.end_date, movement.fiscal_year,
      movement.workflow_status, movement.participant_count, movement.updated_at,
      -- Search both saved snapshots and current names without returning extra
      -- record fields. strpos treats %, _, quotes and backslashes literally.
      lower(concat_ws(' ', movement.project_name, movement.title_en,
        movement.country_name_snapshot, country.name_th, country.name_en,
        movement.partner_name_snapshot, partner.name_th, partner.name_en,
        unit.name_th, unit.name_en, movement.approval_reference)) as search_value
    from public.movement_cases as movement
    left join public.countries as country on country.id = movement.country_id
    left join public.organization_units as unit on unit.id = movement.owner_unit_id
    left join public.partner_organizations as partner on partner.id = movement.partner_organization_id
    where movement.category = 'staff_official_travel'
      and movement.deleted_at is null
  ), filtered as materialized (
    select * from visible
    where (search_text = '' or strpos(search_value, search_text) > 0)
      and (coalesce(p_status, '') = '' or workflow_status::text = p_status)
      and (p_country is null or country_id = p_country)
      and (p_unit is null or owner_unit_id = p_unit)
      and (p_year is null or fiscal_year = p_year)
  ), pagination as (
    select count(*) as total,
      least(greatest(coalesce(p_page, 1), 1), greatest(1, (count(*) + 19) / 20)) as page
    from filtered
  ), ranked as (
    select filtered.*, row_number() over (order by
      case when requested_sort = 'updated_desc' then updated_at end desc nulls last,
      case when requested_sort = 'start_desc' then start_date end desc nulls last,
      case when requested_sort = 'start_asc' then start_date end asc nulls last,
      case when requested_sort = 'name_asc' then lower(project_name) end asc nulls last,
      id asc
    ) as position
    from filtered
  ), page_rows as (
    select ranked.* from ranked cross join pagination
    where position > (pagination.page - 1) * 20
      and position <= pagination.page * 20
  ), country_options as (
    select country_id as id, min(country_filter_name) as label
    from visible where country_id is not null group by country_id
  ), unit_options as (
    select owner_unit_id as id, coalesce(min(owner_unit_name), 'ไม่ระบุชื่อหน่วยงาน') as label
    from visible where owner_unit_id is not null group by owner_unit_id
  )
  select jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'project_name', project_name, 'title_en', title_en,
      'country_name', country_name, 'partner_name', partner_name, 'owner_unit_name', owner_unit_name,
      'start_date', start_date, 'end_date', end_date, 'fiscal_year', fiscal_year,
      'workflow_status', workflow_status, 'participant_count', participant_count, 'updated_at', updated_at
    ) order by position), '[]'::jsonb) from page_rows),
    'total', pagination.total, 'page', pagination.page, 'pageSize', 20,
    'summary', (select jsonb_build_object(
      'total', count(*), 'active', count(*) filter (where workflow_status = 'active'),
      'underReview', count(*) filter (where workflow_status = 'under_review')
    ) from visible),
    'filters', jsonb_build_object(
      'countries', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label) order by label, id), '[]'::jsonb) from country_options),
      'units', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label) order by label, id), '[]'::jsonb) from unit_options),
      'years', (select coalesce(jsonb_agg(fiscal_year order by fiscal_year desc), '[]'::jsonb)
        from (select distinct fiscal_year from visible where fiscal_year is not null) as years)
    )
  ) into result from pagination;

  return result;
end;
$$;

revoke all on function public.travel_list_v2(text, text, uuid, uuid, integer, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.travel_list_v2(text, text, uuid, uuid, integer, text, integer) to authenticated;

comment on function public.travel_list_v2(text, text, uuid, uuid, integer, text, integer)
  is 'RLS-preserving authenticated Travel list, literal search, filters, deterministic 20-row pages and visible-record metadata.';
