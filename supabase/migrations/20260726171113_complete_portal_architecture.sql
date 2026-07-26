-- Complete iROUP Portal architecture.
-- Mobility and official staff travel share one movement core while retaining
-- separate workflows and module permissions.

create type public.movement_category as enum (
  'student_mobility',
  'staff_mobility',
  'staff_official_travel',
  'visiting_delegation'
);

create type public.movement_direction as enum (
  'inbound',
  'outbound',
  'bilateral',
  'not_applicable'
);

create type public.workflow_status as enum (
  'draft',
  'under_review',
  'approved',
  'active',
  'completed',
  'cancelled',
  'archived'
);

create type public.agreement_status as enum (
  'draft',
  'active',
  'expiring',
  'expired',
  'terminated'
);

create type public.audience_type as enum (
  'student',
  'staff',
  'both',
  'external'
);

create type public.event_mode as enum (
  'onsite',
  'online',
  'hybrid'
);

create table public.partner_organizations (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name_th text,
  name_en text not null,
  organization_type text,
  country_id uuid references public.countries (id) on delete restrict,
  city text,
  website_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint partner_organization_has_name check (
    nullif(btrim(name_th), '') is not null
    or nullif(btrim(name_en), '') is not null
  )
);

create table public.budget_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_th text not null,
  name_en text,
  requires_amount boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.file_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_th text not null,
  name_en text,
  public_allowed boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Refactor the first migration's Travel slice into the shared movement core.
drop view public.travel_public;

alter table public.travel_records rename to movement_cases;
alter table public.travel_participants rename to movement_participants;
alter table public.travel_budgets rename to movement_funding;

alter table public.movement_participants rename column travel_id to movement_id;
alter table public.movement_funding rename column travel_id to movement_id;

alter table public.movement_cases
  add column category public.movement_category not null
    default 'staff_official_travel',
  add column direction public.movement_direction not null default 'outbound',
  add column title_en text,
  add column partner_organization_id uuid
    references public.partner_organizations (id) on delete set null,
  add column owner_unit_id uuid
    references public.organization_units (id) on delete set null,
  add column activity_type text,
  add column mobility_mode text,
  add column participant_group text,
  add column study_level text,
  add column approval_reference text,
  add column workflow_status public.workflow_status not null default 'draft';

alter table public.movement_participants
  add column arrival_date date,
  add column departure_date date,
  add column home_organization_name_snapshot text,
  add column host_organization_name_snapshot text,
  add constraint movement_participant_dates_valid check (
    departure_date is null
    or arrival_date is null
    or departure_date >= arrival_date
  );

alter table public.movement_funding
  add column budget_type_id uuid
    references public.budget_types (id) on delete restrict;

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  agreement_number text,
  title_th text not null,
  title_en text,
  agreement_type text not null,
  signed_date date,
  start_date date not null,
  end_date date,
  fiscal_year integer not null check (fiscal_year between 2500 and 3000),
  status public.agreement_status not null default 'draft',
  publication_status public.publication_status not null default 'draft',
  public_visible boolean not null default false,
  internal_note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint agreement_dates_valid check (
    end_date is null or end_date >= start_date
  ),
  constraint published_agreement_is_public check (
    publication_status <> 'published' or public_visible
  )
);

create table public.agreement_partners (
  agreement_id uuid not null
    references public.agreements (id) on delete cascade,
  partner_organization_id uuid not null
    references public.partner_organizations (id) on delete restrict,
  is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (agreement_id, partner_organization_id)
);

create table public.agreement_units (
  agreement_id uuid not null
    references public.agreements (id) on delete cascade,
  organization_unit_id uuid not null
    references public.organization_units (id) on delete restrict,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (agreement_id, organization_unit_id)
);

create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title_th text not null,
  title_en text,
  partner_organization_id uuid
    references public.partner_organizations (id) on delete set null,
  country_id uuid references public.countries (id) on delete restrict,
  audience public.audience_type not null default 'student',
  scholarship_type text,
  funding_type text,
  study_level text,
  publish_date date,
  open_date date,
  close_date date,
  summary_th text,
  summary_en text,
  coverage_th text,
  coverage_en text,
  content_th text,
  content_en text,
  detail_url text,
  apply_url text,
  pinned boolean not null default false,
  publication_status public.publication_status not null default 'draft',
  public_visible boolean not null default false,
  internal_note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint scholarship_dates_valid check (
    close_date is null or open_date is null or close_date >= open_date
  ),
  constraint published_scholarship_is_public check (
    publication_status <> 'published' or public_visible
  )
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title_th text not null,
  title_en text,
  event_type text not null,
  organizer_unit_id uuid
    references public.organization_units (id) on delete set null,
  partner_organization_id uuid
    references public.partner_organizations (id) on delete set null,
  country_id uuid references public.countries (id) on delete restrict,
  mode public.event_mode not null default 'onsite',
  location_th text,
  location_en text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_url text,
  detail_th text,
  detail_en text,
  participant_count integer not null default 0 check (participant_count >= 0),
  pinned boolean not null default false,
  publication_status public.publication_status not null default 'draft',
  public_visible boolean not null default false,
  internal_note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint event_dates_valid check (ends_at >= starts_at),
  constraint published_event_is_public check (
    publication_status <> 'published' or public_visible
  )
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  category text,
  title_th text not null,
  title_en text,
  summary_th text,
  summary_en text,
  content_th text,
  content_en text,
  published_at timestamptz,
  pinned boolean not null default false,
  publication_status public.publication_status not null default 'draft',
  public_visible boolean not null default false,
  internal_note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint published_news_is_public check (
    publication_status <> 'published' or public_visible
  )
);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  category text,
  resource_type text not null default 'article',
  title_th text not null,
  title_en text,
  summary_th text,
  summary_en text,
  content_th text,
  content_en text,
  external_url text,
  published_at timestamptz,
  pinned boolean not null default false,
  publication_status public.publication_status not null default 'draft',
  public_visible boolean not null default false,
  internal_note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint published_knowledge_is_public check (
    publication_status <> 'published' or public_visible
  )
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null,
  storage_path text not null,
  original_file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  file_role_id uuid references public.file_roles (id) on delete restrict,
  is_public boolean not null default false,
  alt_text_th text,
  alt_text_en text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  unique (storage_bucket, storage_path)
);

create table public.record_assets (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  agreement_id uuid references public.agreements (id) on delete cascade,
  movement_id uuid references public.movement_cases (id) on delete cascade,
  scholarship_id uuid references public.scholarships (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  news_id uuid references public.news_articles (id) on delete cascade,
  knowledge_id uuid references public.knowledge_items (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint record_asset_has_one_parent check (
    num_nonnulls(
      agreement_id,
      movement_id,
      scholarship_id,
      event_id,
      news_id,
      knowledge_id
    ) = 1
  )
);

create unique index record_assets_agreement_unique
  on public.record_assets (asset_id, agreement_id)
  where agreement_id is not null;
create unique index record_assets_movement_unique
  on public.record_assets (asset_id, movement_id)
  where movement_id is not null;
create unique index record_assets_scholarship_unique
  on public.record_assets (asset_id, scholarship_id)
  where scholarship_id is not null;
create unique index record_assets_event_unique
  on public.record_assets (asset_id, event_id)
  where event_id is not null;
create unique index record_assets_news_unique
  on public.record_assets (asset_id, news_id)
  where news_id is not null;
create unique index record_assets_knowledge_unique
  on public.record_assets (asset_id, knowledge_id)
  where knowledge_id is not null;

-- Cover the joins and cascades used by operational screens and RLS.
create index partner_organizations_country_idx
  on public.partner_organizations (country_id);
create index partner_organizations_created_by_idx
  on public.partner_organizations (created_by);
create index partner_organizations_updated_by_idx
  on public.partner_organizations (updated_by);

create index movement_cases_category_dates_idx
  on public.movement_cases (category, start_date, end_date);
create index movement_cases_partner_idx
  on public.movement_cases (partner_organization_id);
create index movement_cases_owner_unit_idx
  on public.movement_cases (owner_unit_id);

create index movement_funding_budget_type_idx
  on public.movement_funding (budget_type_id);

create index agreements_dates_idx
  on public.agreements (start_date, end_date);
create index agreements_created_by_idx
  on public.agreements (created_by);
create index agreements_updated_by_idx
  on public.agreements (updated_by);
create index agreements_deleted_by_idx
  on public.agreements (deleted_by);
create index agreement_partners_partner_idx
  on public.agreement_partners (partner_organization_id);
create index agreement_partners_created_by_idx
  on public.agreement_partners (created_by);
create index agreement_units_unit_idx
  on public.agreement_units (organization_unit_id);
create index agreement_units_created_by_idx
  on public.agreement_units (created_by);

create index scholarships_country_idx
  on public.scholarships (country_id);
create index scholarships_partner_idx
  on public.scholarships (partner_organization_id);
create index scholarships_dates_idx
  on public.scholarships (open_date, close_date);
create index scholarships_created_by_idx
  on public.scholarships (created_by);
create index scholarships_updated_by_idx
  on public.scholarships (updated_by);
create index scholarships_deleted_by_idx
  on public.scholarships (deleted_by);

create index events_dates_idx on public.events (starts_at, ends_at);
create index events_organizer_idx on public.events (organizer_unit_id);
create index events_partner_idx on public.events (partner_organization_id);
create index events_country_idx on public.events (country_id);
create index events_created_by_idx on public.events (created_by);
create index events_updated_by_idx on public.events (updated_by);
create index events_deleted_by_idx on public.events (deleted_by);

create index news_articles_published_idx
  on public.news_articles (published_at desc)
  where publication_status = 'published' and deleted_at is null;
create index news_articles_created_by_idx
  on public.news_articles (created_by);
create index news_articles_updated_by_idx
  on public.news_articles (updated_by);
create index news_articles_deleted_by_idx
  on public.news_articles (deleted_by);

create index knowledge_items_published_idx
  on public.knowledge_items (published_at desc)
  where publication_status = 'published' and deleted_at is null;
create index knowledge_items_created_by_idx
  on public.knowledge_items (created_by);
create index knowledge_items_updated_by_idx
  on public.knowledge_items (updated_by);
create index knowledge_items_deleted_by_idx
  on public.knowledge_items (deleted_by);

create index assets_file_role_idx on public.assets (file_role_id);
create index assets_created_by_idx on public.assets (created_by);
create index record_assets_agreement_idx on public.record_assets (agreement_id);
create index record_assets_movement_idx on public.record_assets (movement_id);
create index record_assets_scholarship_idx on public.record_assets (scholarship_id);
create index record_assets_event_idx on public.record_assets (event_id);
create index record_assets_news_idx on public.record_assets (news_id);
create index record_assets_knowledge_idx on public.record_assets (knowledge_id);
create index record_assets_created_by_idx on public.record_assets (created_by);

alter trigger travel_records_protect_audit_fields
  on public.movement_cases rename to movement_cases_protect_audit_fields;
alter trigger travel_participants_protect_audit_fields
  on public.movement_participants rename to movement_participants_protect_audit_fields;
alter trigger travel_budgets_protect_audit_fields
  on public.movement_funding rename to movement_funding_protect_audit_fields;
alter trigger travel_records_audit
  on public.movement_cases rename to movement_cases_audit;

drop trigger travel_participants_refresh_count on public.movement_participants;
drop function private.refresh_travel_participant_count();

create function private.refresh_movement_participant_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_movement_id uuid := coalesce(new.movement_id, old.movement_id);
begin
  update public.movement_cases
  set participant_count = (
    select count(*)::integer
    from public.movement_participants
    where movement_id = affected_movement_id
  )
  where id = affected_movement_id;
  return coalesce(new, old);
end;
$$;

create trigger movement_participants_refresh_count
after insert or update or delete on public.movement_participants
for each row execute function private.refresh_movement_participant_count();

create trigger partner_organizations_protect_audit_fields
before update on public.partner_organizations
for each row execute function private.protect_record_audit_fields();

create trigger budget_types_set_updated_at
before update on public.budget_types
for each row execute function private.set_updated_at();

create trigger file_roles_set_updated_at
before update on public.file_roles
for each row execute function private.set_updated_at();

create trigger agreements_protect_audit_fields
before update on public.agreements
for each row execute function private.protect_record_audit_fields();
create trigger agreements_audit
after insert or update or delete on public.agreements
for each row execute function private.audit_row_change();

create trigger scholarships_protect_audit_fields
before update on public.scholarships
for each row execute function private.protect_record_audit_fields();
create trigger scholarships_audit
after insert or update or delete on public.scholarships
for each row execute function private.audit_row_change();

create trigger events_protect_audit_fields
before update on public.events
for each row execute function private.protect_record_audit_fields();
create trigger events_audit
after insert or update or delete on public.events
for each row execute function private.audit_row_change();

create trigger news_articles_protect_audit_fields
before update on public.news_articles
for each row execute function private.protect_record_audit_fields();
create trigger news_articles_audit
after insert or update or delete on public.news_articles
for each row execute function private.audit_row_change();

create trigger knowledge_items_protect_audit_fields
before update on public.knowledge_items
for each row execute function private.protect_record_audit_fields();
create trigger knowledge_items_audit
after insert or update or delete on public.knowledge_items
for each row execute function private.audit_row_change();

create function private.movement_module(
  requested_category public.movement_category
)
returns public.module_key
language sql
immutable
set search_path = ''
as $$
  select case
    when requested_category = 'staff_official_travel'
      then 'travel'::public.module_key
    else 'mobility'::public.module_key
  end
$$;

create function private.can_access_movement(
  requested_category public.movement_category,
  requested_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_module(
    private.movement_module(requested_category),
    requested_action
  )
$$;

alter table public.partner_organizations enable row level security;
alter table public.budget_types enable row level security;
alter table public.file_roles enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_partners enable row level security;
alter table public.agreement_units enable row level security;
alter table public.scholarships enable row level security;
alter table public.events enable row level security;
alter table public.news_articles enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.assets enable row level security;
alter table public.record_assets enable row level security;

drop policy travel_anon_select_published on public.movement_cases;
drop policy travel_authenticated_select on public.movement_cases;
drop policy travel_internal_insert on public.movement_cases;
drop policy travel_internal_update on public.movement_cases;
drop policy travel_internal_delete on public.movement_cases;

create policy movement_anon_select_published
on public.movement_cases for select
to anon
using (
  publication_status = 'published'
  and public_visible
  and deleted_at is null
);

create policy movement_authenticated_select
on public.movement_cases for select
to authenticated
using (
  (
    publication_status = 'published'
    and public_visible
    and deleted_at is null
  )
  or private.can_access_movement(category, 'view')
);

create policy movement_authenticated_insert
on public.movement_cases for insert
to authenticated
with check (
  private.can_access_movement(category, 'create')
  and (
    publication_status = 'draft'
    or private.can_access_movement(category, 'publish')
  )
);

create policy movement_authenticated_update
on public.movement_cases for update
to authenticated
using (
  private.can_access_movement(category, 'update')
  and (
    publication_status <> 'published'
    or private.can_access_movement(category, 'publish')
  )
)
with check (
  private.can_access_movement(category, 'update')
  and (
    publication_status = 'draft'
    or private.can_access_movement(category, 'publish')
  )
);

create policy movement_authenticated_delete
on public.movement_cases for delete
to authenticated
using (private.can_access_movement(category, 'delete'));

drop policy travel_participants_internal_select
  on public.movement_participants;
drop policy travel_participants_internal_insert
  on public.movement_participants;
drop policy travel_participants_internal_update
  on public.movement_participants;
drop policy travel_participants_internal_delete
  on public.movement_participants;

create policy movement_participants_select
on public.movement_participants for select
to authenticated
using (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_participants.movement_id
      and private.can_access_movement(movement_cases.category, 'view')
  )
);

create policy movement_participants_insert
on public.movement_participants for insert
to authenticated
with check (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_participants.movement_id
      and private.can_access_movement(movement_cases.category, 'update')
  )
);

create policy movement_participants_update
on public.movement_participants for update
to authenticated
using (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_participants.movement_id
      and private.can_access_movement(movement_cases.category, 'update')
  )
)
with check (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_participants.movement_id
      and private.can_access_movement(movement_cases.category, 'update')
  )
);

create policy movement_participants_delete
on public.movement_participants for delete
to authenticated
using (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_participants.movement_id
      and private.can_access_movement(movement_cases.category, 'delete')
  )
);

drop policy travel_budgets_internal_select on public.movement_funding;
drop policy travel_budgets_internal_insert on public.movement_funding;
drop policy travel_budgets_internal_update on public.movement_funding;
drop policy travel_budgets_internal_delete on public.movement_funding;

create policy movement_funding_select
on public.movement_funding for select
to authenticated
using (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_funding.movement_id
      and private.can_access_movement(movement_cases.category, 'view')
  )
);

create policy movement_funding_insert
on public.movement_funding for insert
to authenticated
with check (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_funding.movement_id
      and private.can_access_movement(movement_cases.category, 'update')
  )
);

create policy movement_funding_update
on public.movement_funding for update
to authenticated
using (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_funding.movement_id
      and private.can_access_movement(movement_cases.category, 'update')
  )
)
with check (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_funding.movement_id
      and private.can_access_movement(movement_cases.category, 'update')
  )
);

create policy movement_funding_delete
on public.movement_funding for delete
to authenticated
using (
  exists (
    select 1
    from public.movement_cases
    where movement_cases.id = movement_funding.movement_id
      and private.can_access_movement(movement_cases.category, 'delete')
  )
);

create policy partner_organizations_anon_select
on public.partner_organizations for select
to anon
using (active);

create policy partner_organizations_authenticated_select
on public.partner_organizations for select
to authenticated
using (
  active
  or private.is_admin()
  or private.can_access_module('mou', 'view')
);

create policy partner_organizations_admin_insert
on public.partner_organizations for insert
to authenticated
with check (
  private.is_admin()
  or private.can_access_module('settings', 'create')
);

create policy partner_organizations_admin_update
on public.partner_organizations for update
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'update')
)
with check (
  private.is_admin()
  or private.can_access_module('settings', 'update')
);

create policy partner_organizations_admin_delete
on public.partner_organizations for delete
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'delete')
);

create policy budget_types_authenticated_select
on public.budget_types for select
to authenticated
using (active or private.is_admin());

create policy budget_types_admin_all
on public.budget_types for all
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'update')
)
with check (
  private.is_admin()
  or private.can_access_module('settings', 'update')
);

create policy file_roles_authenticated_select
on public.file_roles for select
to authenticated
using (active or private.is_admin());

create policy file_roles_admin_all
on public.file_roles for all
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'update')
)
with check (
  private.is_admin()
  or private.can_access_module('settings', 'update')
);

create policy agreements_anon_select_published
on public.agreements for select
to anon
using (
  publication_status = 'published'
  and public_visible
  and deleted_at is null
);

create policy agreements_authenticated_select
on public.agreements for select
to authenticated
using (
  (
    publication_status = 'published'
    and public_visible
    and deleted_at is null
  )
  or private.can_access_module('mou', 'view')
);

create policy agreements_authenticated_insert
on public.agreements for insert
to authenticated
with check (
  private.can_access_module('mou', 'create')
  and (
    publication_status = 'draft'
    or private.can_access_module('mou', 'publish')
  )
);

create policy agreements_authenticated_update
on public.agreements for update
to authenticated
using (
  private.can_access_module('mou', 'update')
  and (
    publication_status <> 'published'
    or private.can_access_module('mou', 'publish')
  )
)
with check (
  private.can_access_module('mou', 'update')
  and (
    publication_status = 'draft'
    or private.can_access_module('mou', 'publish')
  )
);

create policy agreements_authenticated_delete
on public.agreements for delete
to authenticated
using (private.can_access_module('mou', 'delete'));

create policy agreement_partners_anon_select
on public.agreement_partners for select
to anon
using (
  exists (
    select 1 from public.agreements
    where agreements.id = agreement_partners.agreement_id
      and agreements.publication_status = 'published'
      and agreements.public_visible
      and agreements.deleted_at is null
  )
);

create policy agreement_partners_authenticated_select
on public.agreement_partners for select
to authenticated
using (
  exists (
    select 1 from public.agreements
    where agreements.id = agreement_partners.agreement_id
  )
);

create policy agreement_partners_authenticated_insert
on public.agreement_partners for insert
to authenticated
with check (private.can_access_module('mou', 'update'));

create policy agreement_partners_authenticated_update
on public.agreement_partners for update
to authenticated
using (private.can_access_module('mou', 'update'))
with check (private.can_access_module('mou', 'update'));

create policy agreement_partners_authenticated_delete
on public.agreement_partners for delete
to authenticated
using (private.can_access_module('mou', 'update'));

create policy agreement_units_anon_select
on public.agreement_units for select
to anon
using (
  exists (
    select 1 from public.agreements
    where agreements.id = agreement_units.agreement_id
      and agreements.publication_status = 'published'
      and agreements.public_visible
      and agreements.deleted_at is null
  )
);

create policy agreement_units_authenticated_select
on public.agreement_units for select
to authenticated
using (
  exists (
    select 1 from public.agreements
    where agreements.id = agreement_units.agreement_id
  )
);

create policy agreement_units_authenticated_insert
on public.agreement_units for insert
to authenticated
with check (private.can_access_module('mou', 'update'));

create policy agreement_units_authenticated_update
on public.agreement_units for update
to authenticated
using (private.can_access_module('mou', 'update'))
with check (private.can_access_module('mou', 'update'));

create policy agreement_units_authenticated_delete
on public.agreement_units for delete
to authenticated
using (private.can_access_module('mou', 'update'));

create policy scholarships_anon_select_published
on public.scholarships for select
to anon
using (
  publication_status = 'published'
  and public_visible
  and deleted_at is null
);

create policy scholarships_authenticated_select
on public.scholarships for select
to authenticated
using (
  (
    publication_status = 'published'
    and public_visible
    and deleted_at is null
  )
  or private.can_access_module('scholarship', 'view')
);

create policy scholarships_authenticated_insert
on public.scholarships for insert
to authenticated
with check (
  private.can_access_module('scholarship', 'create')
  and (
    publication_status = 'draft'
    or private.can_access_module('scholarship', 'publish')
  )
);

create policy scholarships_authenticated_update
on public.scholarships for update
to authenticated
using (
  private.can_access_module('scholarship', 'update')
  and (
    publication_status <> 'published'
    or private.can_access_module('scholarship', 'publish')
  )
)
with check (
  private.can_access_module('scholarship', 'update')
  and (
    publication_status = 'draft'
    or private.can_access_module('scholarship', 'publish')
  )
);

create policy scholarships_authenticated_delete
on public.scholarships for delete
to authenticated
using (private.can_access_module('scholarship', 'delete'));

create policy events_anon_select_published
on public.events for select
to anon
using (
  publication_status = 'published'
  and public_visible
  and deleted_at is null
);

create policy events_authenticated_select
on public.events for select
to authenticated
using (
  (
    publication_status = 'published'
    and public_visible
    and deleted_at is null
  )
  or private.can_access_module('events', 'view')
);

create policy events_authenticated_insert
on public.events for insert
to authenticated
with check (
  private.can_access_module('events', 'create')
  and (
    publication_status = 'draft'
    or private.can_access_module('events', 'publish')
  )
);

create policy events_authenticated_update
on public.events for update
to authenticated
using (
  private.can_access_module('events', 'update')
  and (
    publication_status <> 'published'
    or private.can_access_module('events', 'publish')
  )
)
with check (
  private.can_access_module('events', 'update')
  and (
    publication_status = 'draft'
    or private.can_access_module('events', 'publish')
  )
);

create policy events_authenticated_delete
on public.events for delete
to authenticated
using (private.can_access_module('events', 'delete'));

create policy news_anon_select_published
on public.news_articles for select
to anon
using (
  publication_status = 'published'
  and public_visible
  and deleted_at is null
);

create policy news_authenticated_select
on public.news_articles for select
to authenticated
using (
  (
    publication_status = 'published'
    and public_visible
    and deleted_at is null
  )
  or private.can_access_module('news', 'view')
);

create policy news_authenticated_insert
on public.news_articles for insert
to authenticated
with check (
  private.can_access_module('news', 'create')
  and (
    publication_status = 'draft'
    or private.can_access_module('news', 'publish')
  )
);

create policy news_authenticated_update
on public.news_articles for update
to authenticated
using (
  private.can_access_module('news', 'update')
  and (
    publication_status <> 'published'
    or private.can_access_module('news', 'publish')
  )
)
with check (
  private.can_access_module('news', 'update')
  and (
    publication_status = 'draft'
    or private.can_access_module('news', 'publish')
  )
);

create policy news_authenticated_delete
on public.news_articles for delete
to authenticated
using (private.can_access_module('news', 'delete'));

create policy knowledge_anon_select_published
on public.knowledge_items for select
to anon
using (
  publication_status = 'published'
  and public_visible
  and deleted_at is null
);

create policy knowledge_authenticated_select
on public.knowledge_items for select
to authenticated
using (
  (
    publication_status = 'published'
    and public_visible
    and deleted_at is null
  )
  or private.can_access_module('knowledge', 'view')
);

create policy knowledge_authenticated_insert
on public.knowledge_items for insert
to authenticated
with check (
  private.can_access_module('knowledge', 'create')
  and (
    publication_status = 'draft'
    or private.can_access_module('knowledge', 'publish')
  )
);

create policy knowledge_authenticated_update
on public.knowledge_items for update
to authenticated
using (
  private.can_access_module('knowledge', 'update')
  and (
    publication_status <> 'published'
    or private.can_access_module('knowledge', 'publish')
  )
)
with check (
  private.can_access_module('knowledge', 'update')
  and (
    publication_status = 'draft'
    or private.can_access_module('knowledge', 'publish')
  )
);

create policy knowledge_authenticated_delete
on public.knowledge_items for delete
to authenticated
using (private.can_access_module('knowledge', 'delete'));

create function private.can_access_any_module(requested_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1
      from private.module_permissions
      where user_id = (select auth.uid())
        and (
          (requested_action = 'view' and can_view)
          or (requested_action = 'create' and can_create)
          or (requested_action = 'update' and can_update)
          or (requested_action = 'publish' and can_publish)
          or (requested_action = 'delete' and can_delete)
          or (requested_action = 'import' and can_import)
        )
    )
$$;

create function private.can_access_record_asset(
  requested_agreement_id uuid,
  requested_movement_id uuid,
  requested_scholarship_id uuid,
  requested_event_id uuid,
  requested_news_id uuid,
  requested_knowledge_id uuid,
  requested_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      requested_agreement_id is not null
      and private.can_access_module('mou', requested_action)
    )
    or (
      requested_movement_id is not null
      and exists (
        select 1 from public.movement_cases
        where movement_cases.id = requested_movement_id
          and private.can_access_movement(
            movement_cases.category,
            requested_action
          )
      )
    )
    or (
      requested_scholarship_id is not null
      and private.can_access_module('scholarship', requested_action)
    )
    or (
      requested_event_id is not null
      and private.can_access_module('events', requested_action)
    )
    or (
      requested_news_id is not null
      and private.can_access_module('news', requested_action)
    )
    or (
      requested_knowledge_id is not null
      and private.can_access_module('knowledge', requested_action)
    )
$$;

create policy record_assets_anon_select
on public.record_assets for select
to anon
using (
  (
    agreement_id is not null
    and exists (
      select 1 from public.agreements
      where agreements.id = record_assets.agreement_id
        and agreements.publication_status = 'published'
        and agreements.public_visible
        and agreements.deleted_at is null
    )
  )
  or (
    movement_id is not null
    and exists (
      select 1 from public.movement_cases
      where movement_cases.id = record_assets.movement_id
        and movement_cases.publication_status = 'published'
        and movement_cases.public_visible
        and movement_cases.deleted_at is null
    )
  )
  or (
    scholarship_id is not null
    and exists (
      select 1 from public.scholarships
      where scholarships.id = record_assets.scholarship_id
        and scholarships.publication_status = 'published'
        and scholarships.public_visible
        and scholarships.deleted_at is null
    )
  )
  or (
    event_id is not null
    and exists (
      select 1 from public.events
      where events.id = record_assets.event_id
        and events.publication_status = 'published'
        and events.public_visible
        and events.deleted_at is null
    )
  )
  or (
    news_id is not null
    and exists (
      select 1 from public.news_articles
      where news_articles.id = record_assets.news_id
        and news_articles.publication_status = 'published'
        and news_articles.public_visible
        and news_articles.deleted_at is null
    )
  )
  or (
    knowledge_id is not null
    and exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = record_assets.knowledge_id
        and knowledge_items.publication_status = 'published'
        and knowledge_items.public_visible
        and knowledge_items.deleted_at is null
    )
  )
);

create policy record_assets_authenticated_select
on public.record_assets for select
to authenticated
using (
  private.can_access_record_asset(
    agreement_id,
    movement_id,
    scholarship_id,
    event_id,
    news_id,
    knowledge_id,
    'view'
  )
);

create policy record_assets_authenticated_insert
on public.record_assets for insert
to authenticated
with check (
  private.can_access_record_asset(
    agreement_id,
    movement_id,
    scholarship_id,
    event_id,
    news_id,
    knowledge_id,
    'update'
  )
);

create policy record_assets_authenticated_update
on public.record_assets for update
to authenticated
using (
  private.can_access_record_asset(
    agreement_id,
    movement_id,
    scholarship_id,
    event_id,
    news_id,
    knowledge_id,
    'update'
  )
)
with check (
  private.can_access_record_asset(
    agreement_id,
    movement_id,
    scholarship_id,
    event_id,
    news_id,
    knowledge_id,
    'update'
  )
);

create policy record_assets_authenticated_delete
on public.record_assets for delete
to authenticated
using (
  private.can_access_record_asset(
    agreement_id,
    movement_id,
    scholarship_id,
    event_id,
    news_id,
    knowledge_id,
    'update'
  )
);

create policy assets_anon_select_public
on public.assets for select
to anon
using (
  is_public
  and exists (
    select 1 from public.record_assets
    where record_assets.asset_id = assets.id
  )
);

create policy assets_authenticated_select
on public.assets for select
to authenticated
using (
  exists (
    select 1 from public.record_assets
    where record_assets.asset_id = assets.id
  )
);

create policy assets_authenticated_insert
on public.assets for insert
to authenticated
with check (private.can_access_any_module('create'));

create policy assets_authenticated_update
on public.assets for update
to authenticated
using (private.can_access_any_module('update'))
with check (private.can_access_any_module('update'));

create policy assets_authenticated_delete
on public.assets for delete
to authenticated
using (private.can_access_any_module('delete'));

create view public.movements_public
with (security_invoker = true)
as
select
  movement_cases.id,
  movement_cases.category,
  movement_cases.direction,
  movement_cases.project_name,
  movement_cases.title_en,
  movement_cases.purpose,
  movement_cases.country_id,
  movement_cases.city,
  movement_cases.partner_organization_id,
  movement_cases.owner_unit_id,
  movement_cases.start_date,
  movement_cases.end_date,
  movement_cases.fiscal_year,
  movement_cases.status,
  movement_cases.participant_count
from public.movement_cases
where movement_cases.publication_status = 'published'
  and movement_cases.public_visible
  and movement_cases.deleted_at is null;

create view public.agreements_public
with (security_invoker = true)
as
select
  agreements.id,
  agreements.agreement_number,
  agreements.title_th,
  agreements.title_en,
  agreements.agreement_type,
  agreements.signed_date,
  agreements.start_date,
  agreements.end_date,
  agreements.fiscal_year,
  agreements.status,
  array_remove(
    array_agg(
      distinct coalesce(
        partner_organizations.name_th,
        partner_organizations.name_en
      )
    ),
    null
  ) as partner_names
from public.agreements
left join public.agreement_partners
  on agreement_partners.agreement_id = agreements.id
left join public.partner_organizations
  on partner_organizations.id = agreement_partners.partner_organization_id
where agreements.publication_status = 'published'
  and agreements.public_visible
  and agreements.deleted_at is null
group by agreements.id;

create view public.scholarships_public
with (security_invoker = true)
as
select
  id,
  title_th,
  title_en,
  partner_organization_id,
  country_id,
  audience,
  scholarship_type,
  funding_type,
  study_level,
  publish_date,
  open_date,
  close_date,
  summary_th,
  summary_en,
  coverage_th,
  coverage_en,
  content_th,
  content_en,
  detail_url,
  apply_url,
  pinned
from public.scholarships
where publication_status = 'published'
  and public_visible
  and deleted_at is null;

create view public.events_public
with (security_invoker = true)
as
select
  id,
  title_th,
  title_en,
  event_type,
  organizer_unit_id,
  partner_organization_id,
  country_id,
  mode,
  location_th,
  location_en,
  starts_at,
  ends_at,
  registration_url,
  detail_th,
  detail_en,
  participant_count,
  pinned
from public.events
where publication_status = 'published'
  and public_visible
  and deleted_at is null;

create view public.news_public
with (security_invoker = true)
as
select
  id,
  category,
  title_th,
  title_en,
  summary_th,
  summary_en,
  content_th,
  content_en,
  published_at,
  pinned
from public.news_articles
where publication_status = 'published'
  and public_visible
  and deleted_at is null;

create view public.knowledge_public
with (security_invoker = true)
as
select
  id,
  category,
  resource_type,
  title_th,
  title_en,
  summary_th,
  summary_en,
  content_th,
  content_en,
  external_url,
  published_at,
  pinned
from public.knowledge_items
where publication_status = 'published'
  and public_visible
  and deleted_at is null;

create view public.workspace_dashboard_counts
with (security_invoker = true)
as
select
  'mou'::public.module_key as module,
  'agreements'::text as segment,
  count(*)::bigint as total_records,
  count(*) filter (
    where publication_status = 'published'
  )::bigint as published_records
from public.agreements
where private.can_access_module('mou', 'view')
having private.can_access_module('mou', 'view')
union all
select
  private.movement_module(category) as module,
  category::text as segment,
  count(*)::bigint as total_records,
  count(*) filter (
    where publication_status = 'published'
  )::bigint as published_records
from public.movement_cases
where private.can_access_movement(category, 'view')
group by category
union all
select
  'scholarship'::public.module_key,
  'scholarships'::text,
  count(*)::bigint,
  count(*) filter (
    where publication_status = 'published'
  )::bigint
from public.scholarships
where private.can_access_module('scholarship', 'view')
having private.can_access_module('scholarship', 'view')
union all
select
  'events'::public.module_key,
  'events'::text,
  count(*)::bigint,
  count(*) filter (
    where publication_status = 'published'
  )::bigint
from public.events
where private.can_access_module('events', 'view')
having private.can_access_module('events', 'view')
union all
select
  'news'::public.module_key,
  'news'::text,
  count(*)::bigint,
  count(*) filter (
    where publication_status = 'published'
  )::bigint
from public.news_articles
where private.can_access_module('news', 'view')
having private.can_access_module('news', 'view')
union all
select
  'knowledge'::public.module_key,
  'knowledge'::text,
  count(*)::bigint,
  count(*) filter (
    where publication_status = 'published'
  )::bigint
from public.knowledge_items
where private.can_access_module('knowledge', 'view')
having private.can_access_module('knowledge', 'view');

revoke all on function private.movement_module(public.movement_category)
  from public, anon, authenticated;
revoke all on function private.can_access_movement(
  public.movement_category,
  text
) from public, anon, authenticated;
revoke all on function private.can_access_any_module(text)
  from public, anon, authenticated;
revoke all on function private.can_access_record_asset(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function private.movement_module(
  public.movement_category
) to authenticated;
grant execute on function private.can_access_movement(
  public.movement_category,
  text
) to authenticated;
grant execute on function private.can_access_any_module(text)
  to authenticated;
grant execute on function private.can_access_record_asset(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) to authenticated;

revoke all on public.partner_organizations,
  public.budget_types,
  public.file_roles,
  public.agreements,
  public.agreement_partners,
  public.agreement_units,
  public.scholarships,
  public.events,
  public.news_articles,
  public.knowledge_items,
  public.assets,
  public.record_assets
from anon, authenticated;

grant select, insert, update, delete on
  public.partner_organizations,
  public.budget_types,
  public.file_roles,
  public.agreements,
  public.agreement_partners,
  public.agreement_units,
  public.scholarships,
  public.events,
  public.news_articles,
  public.knowledge_items,
  public.assets,
  public.record_assets
to authenticated;

grant select (
  id,
  name_th,
  name_en,
  organization_type,
  country_id,
  city,
  website_url,
  active
) on public.partner_organizations to anon;

grant select (
  id,
  agreement_number,
  title_th,
  title_en,
  agreement_type,
  signed_date,
  start_date,
  end_date,
  fiscal_year,
  status,
  publication_status,
  public_visible,
  deleted_at
) on public.agreements to anon;

grant select (
  agreement_id,
  partner_organization_id,
  is_lead
) on public.agreement_partners to anon;

grant select (
  agreement_id,
  organization_unit_id,
  is_owner
) on public.agreement_units to anon;

grant select (
  id,
  category,
  direction,
  project_name,
  title_en,
  purpose,
  country_id,
  city,
  partner_organization_id,
  owner_unit_id,
  start_date,
  end_date,
  fiscal_year,
  status,
  participant_count,
  publication_status,
  public_visible,
  deleted_at
) on public.movement_cases to anon;

grant select (
  id,
  title_th,
  title_en,
  partner_organization_id,
  country_id,
  audience,
  scholarship_type,
  funding_type,
  study_level,
  publish_date,
  open_date,
  close_date,
  summary_th,
  summary_en,
  coverage_th,
  coverage_en,
  content_th,
  content_en,
  detail_url,
  apply_url,
  pinned,
  publication_status,
  public_visible,
  deleted_at
) on public.scholarships to anon;

grant select (
  id,
  title_th,
  title_en,
  event_type,
  organizer_unit_id,
  partner_organization_id,
  country_id,
  mode,
  location_th,
  location_en,
  starts_at,
  ends_at,
  registration_url,
  detail_th,
  detail_en,
  participant_count,
  pinned,
  publication_status,
  public_visible,
  deleted_at
) on public.events to anon;

grant select (
  id,
  category,
  title_th,
  title_en,
  summary_th,
  summary_en,
  content_th,
  content_en,
  published_at,
  pinned,
  publication_status,
  public_visible,
  deleted_at
) on public.news_articles to anon;

grant select (
  id,
  category,
  resource_type,
  title_th,
  title_en,
  summary_th,
  summary_en,
  content_th,
  content_en,
  external_url,
  published_at,
  pinned,
  publication_status,
  public_visible,
  deleted_at
) on public.knowledge_items to anon;

grant select (
  id,
  asset_id,
  agreement_id,
  movement_id,
  scholarship_id,
  event_id,
  news_id,
  knowledge_id,
  sort_order
) on public.record_assets to anon;

grant select (
  id,
  storage_bucket,
  storage_path,
  original_file_name,
  mime_type,
  size_bytes,
  file_role_id,
  is_public,
  alt_text_th,
  alt_text_en
) on public.assets to anon;

grant select on
  public.movements_public,
  public.agreements_public,
  public.scholarships_public,
  public.events_public,
  public.news_public,
  public.knowledge_public
to anon, authenticated;

grant select on public.workspace_dashboard_counts to authenticated;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema private to service_role;
