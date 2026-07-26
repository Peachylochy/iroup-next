create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum (
  'system_admin',
  'office_admin',
  'editor',
  'viewer'
);

create type public.module_key as enum (
  'mou',
  'mobility',
  'travel',
  'scholarship',
  'events',
  'news',
  'knowledge',
  'reports',
  'settings'
);

create type public.publication_status as enum (
  'draft',
  'published',
  'archived'
);

create type public.person_type as enum (
  'student',
  'staff',
  'external'
);

create type public.import_status as enum (
  'uploaded',
  'validating',
  'ready',
  'importing',
  'completed',
  'failed',
  'cancelled'
);

create type public.import_row_status as enum (
  'pending',
  'valid',
  'warning',
  'invalid',
  'duplicate',
  'imported'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  preferred_locale text not null default 'th'
    check (preferred_locale in ('th', 'en')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table private.module_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module public.module_key not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_publish boolean not null default false,
  can_delete boolean not null default false,
  can_import boolean not null default false,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, module)
);

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 text not null unique check (iso2 ~ '^[A-Z]{2}$'),
  iso3 text not null unique check (iso3 ~ '^[A-Z]{3}$'),
  name_th text not null,
  name_en text not null,
  continent_code text,
  search_alias text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_units (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name_th text not null,
  name_en text,
  unit_type text,
  parent_id uuid references public.organization_units (id) on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  person_type public.person_type not null,
  source_identifier text,
  prefix_th text,
  first_name_th text,
  last_name_th text,
  full_name_th text not null,
  prefix_en text,
  first_name_en text,
  last_name_en text,
  full_name_en text,
  gender text,
  organization_unit_id uuid
    references public.organization_units (id) on delete set null,
  program_or_position text,
  source_system text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create unique index people_source_identifier_unique
  on public.people (person_type, source_identifier)
  where source_identifier is not null;

create table public.travel_records (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_name text not null,
  purpose text,
  country_id uuid references public.countries (id) on delete restrict,
  city text,
  start_date date not null,
  end_date date not null,
  fiscal_year integer not null check (fiscal_year between 2500 and 3000),
  status text not null default 'planned'
    check (status in ('planned', 'ongoing', 'completed', 'cancelled')),
  publication_status public.publication_status not null default 'draft',
  public_visible boolean not null default false,
  participant_count integer not null default 0 check (participant_count >= 0),
  internal_note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint travel_dates_valid check (end_date >= start_date),
  constraint published_travel_is_public check (
    publication_status <> 'published' or public_visible
  )
);

create table public.travel_participants (
  id uuid primary key default gen_random_uuid(),
  travel_id uuid not null
    references public.travel_records (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  person_source public.person_type not null,
  full_name_snapshot text not null,
  organization_unit_id_snapshot uuid
    references public.organization_units (id) on delete set null,
  organization_unit_name_snapshot text,
  position_snapshot text,
  participant_role text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  unique (travel_id, person_id)
);

create table public.travel_budgets (
  id uuid primary key default gen_random_uuid(),
  travel_id uuid not null
    references public.travel_records (id) on delete cascade,
  budget_type text not null,
  source_unit_id uuid
    references public.organization_units (id) on delete set null,
  source_name text,
  amount numeric(14, 2) check (amount is null or amount >= 0),
  currency text not null default 'THB' check (currency ~ '^[A-Z]{3}$'),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  module public.module_key not null,
  source_file_name text not null,
  source_file_path text,
  status public.import_status not null default 'uploaded',
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  warning_rows integer not null default 0 check (warning_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.import_batches (id) on delete cascade,
  row_number integer not null check (row_number > 0),
  status public.import_row_status not null default 'pending',
  source_data jsonb not null,
  normalized_data jsonb,
  validation_messages jsonb not null default '[]'::jsonb,
  target_record_id uuid,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create table private.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  before_data jsonb,
  after_data jsonb,
  actor_id uuid,
  occurred_at timestamptz not null default now()
);

create index countries_active_sort_idx
  on public.countries (active, sort_order, name_en);
create index organization_units_parent_idx
  on public.organization_units (parent_id);
create index people_source_identifier_idx
  on public.people (source_identifier)
  where source_identifier is not null;
create index people_name_th_idx
  on public.people using gin (to_tsvector('simple', full_name_th));
create index travel_records_dates_idx
  on public.travel_records (start_date, end_date);
create index travel_records_fiscal_year_idx
  on public.travel_records (fiscal_year);
create index travel_records_country_idx
  on public.travel_records (country_id);
create index travel_records_public_idx
  on public.travel_records (publication_status, public_visible, start_date desc)
  where deleted_at is null;
create index travel_participants_travel_idx
  on public.travel_participants (travel_id);
create index travel_budgets_travel_idx
  on public.travel_budgets (travel_id);
create index import_rows_batch_status_idx
  on public.import_rows (batch_id, status, row_number);
create index audit_logs_record_idx
  on private.audit_logs (table_name, record_id, occurred_at desc);

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles
    where user_id = (select auth.uid())
      and role in ('system_admin', 'office_admin')
  );
$$;

create function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles
    where user_id = (select auth.uid())
      and role = required_role
  );
$$;

create function private.can_access_module(
  requested_module public.module_key,
  requested_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      private.is_admin()
      or exists (
        select 1
        from private.module_permissions
        where user_id = (select auth.uid())
          and module = requested_module
          and case requested_action
            when 'view' then can_view
            when 'create' then can_create
            when 'update' then can_update
            when 'publish' then can_publish
            when 'delete' then can_delete
            when 'import' then can_import
            else false
          end
      )
    );
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function private.protect_record_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at = old.created_at;
  new.created_by = old.created_by;
  new.updated_at = now();
  new.updated_by = coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_logs (
    table_name,
    record_id,
    action,
    before_data,
    after_data,
    actor_id
  )
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    (select auth.uid())
  );
  return coalesce(new, old);
end;
$$;

create function private.refresh_travel_participant_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_travel_id uuid := coalesce(new.travel_id, old.travel_id);
begin
  update public.travel_records
  set participant_count = (
    select count(*)::integer
    from public.travel_participants
    where travel_id = affected_travel_id
  )
  where id = affected_travel_id;
  return coalesce(new, old);
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger countries_set_updated_at
before update on public.countries
for each row execute function private.set_updated_at();

create trigger organization_units_set_updated_at
before update on public.organization_units
for each row execute function private.set_updated_at();

create trigger people_protect_audit_fields
before update on public.people
for each row execute function private.protect_record_audit_fields();

create trigger travel_records_protect_audit_fields
before update on public.travel_records
for each row execute function private.protect_record_audit_fields();

create trigger travel_participants_protect_audit_fields
before update on public.travel_participants
for each row execute function private.protect_record_audit_fields();

create trigger travel_budgets_protect_audit_fields
before update on public.travel_budgets
for each row execute function private.protect_record_audit_fields();

create trigger travel_records_audit
after insert or update or delete on public.travel_records
for each row execute function private.audit_row_change();

create trigger travel_participants_refresh_count
after insert or update or delete on public.travel_participants
for each row execute function private.refresh_travel_participant_count();

create view public.travel_public
with (security_invoker = true)
as
select
  id,
  project_name,
  purpose,
  country_id,
  city,
  start_date,
  end_date,
  fiscal_year,
  status,
  participant_count
from public.travel_records
where publication_status = 'published'
  and public_visible
  and deleted_at is null;

alter table public.profiles enable row level security;
alter table public.countries enable row level security;
alter table public.organization_units enable row level security;
alter table public.people enable row level security;
alter table public.travel_records enable row level security;
alter table public.travel_participants enable row level security;
alter table public.travel_budgets enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;

create policy profiles_select_self_or_admin
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or private.is_admin());

create policy profiles_update_self_or_admin
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or private.is_admin())
with check ((select auth.uid()) = id or private.is_admin());

create policy countries_select_active
on public.countries for select
to anon, authenticated
using (active);

create policy countries_admin_select_all
on public.countries for select
to authenticated
using (private.is_admin());

create policy countries_admin_insert
on public.countries for insert
to authenticated
with check (private.is_admin());

create policy countries_admin_update
on public.countries for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy countries_admin_delete
on public.countries for delete
to authenticated
using (private.has_role('system_admin'));

create policy organization_units_select_active
on public.organization_units for select
to anon, authenticated
using (active);

create policy organization_units_admin_select_all
on public.organization_units for select
to authenticated
using (private.is_admin());

create policy organization_units_admin_insert
on public.organization_units for insert
to authenticated
with check (private.is_admin());

create policy organization_units_admin_update
on public.organization_units for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy organization_units_admin_delete
on public.organization_units for delete
to authenticated
using (private.has_role('system_admin'));

create policy people_internal_select
on public.people for select
to authenticated
using (
  private.is_admin()
  or private.can_access_module('travel', 'view')
  or private.can_access_module('mobility', 'view')
);

create policy people_internal_insert
on public.people for insert
to authenticated
with check (
  private.is_admin()
  or private.can_access_module('travel', 'create')
  or private.can_access_module('mobility', 'create')
);

create policy people_internal_update
on public.people for update
to authenticated
using (
  private.is_admin()
  or private.can_access_module('travel', 'update')
  or private.can_access_module('mobility', 'update')
)
with check (
  private.is_admin()
  or private.can_access_module('travel', 'update')
  or private.can_access_module('mobility', 'update')
);

create policy travel_public_select
on public.travel_records for select
to anon, authenticated
using (
  publication_status = 'published'
  and public_visible
  and deleted_at is null
);

create policy travel_internal_select
on public.travel_records for select
to authenticated
using (private.can_access_module('travel', 'view'));

create policy travel_internal_insert
on public.travel_records for insert
to authenticated
with check (
  private.can_access_module('travel', 'create')
  and created_by = (select auth.uid())
  and (
    publication_status <> 'published'
    or private.can_access_module('travel', 'publish')
  )
);

create policy travel_internal_update
on public.travel_records for update
to authenticated
using (
  private.can_access_module('travel', 'update')
  and (
    publication_status <> 'published'
    or private.can_access_module('travel', 'publish')
  )
)
with check (
  private.can_access_module('travel', 'update')
  and (
    publication_status <> 'published'
    or private.can_access_module('travel', 'publish')
  )
);

create policy travel_internal_delete
on public.travel_records for delete
to authenticated
using (private.can_access_module('travel', 'delete'));

create policy travel_participants_internal_select
on public.travel_participants for select
to authenticated
using (private.can_access_module('travel', 'view'));

create policy travel_participants_internal_insert
on public.travel_participants for insert
to authenticated
with check (
  private.can_access_module('travel', 'create')
  and created_by = (select auth.uid())
);

create policy travel_participants_internal_update
on public.travel_participants for update
to authenticated
using (private.can_access_module('travel', 'update'))
with check (private.can_access_module('travel', 'update'));

create policy travel_participants_internal_delete
on public.travel_participants for delete
to authenticated
using (private.can_access_module('travel', 'delete'));

create policy travel_budgets_internal_select
on public.travel_budgets for select
to authenticated
using (private.can_access_module('travel', 'view'));

create policy travel_budgets_internal_insert
on public.travel_budgets for insert
to authenticated
with check (
  private.can_access_module('travel', 'create')
  and created_by = (select auth.uid())
);

create policy travel_budgets_internal_update
on public.travel_budgets for update
to authenticated
using (private.can_access_module('travel', 'update'))
with check (private.can_access_module('travel', 'update'));

create policy travel_budgets_internal_delete
on public.travel_budgets for delete
to authenticated
using (private.can_access_module('travel', 'delete'));

create policy import_batches_internal_select
on public.import_batches for select
to authenticated
using (
  created_by = (select auth.uid())
  or private.can_access_module(module, 'import')
);

create policy import_batches_internal_insert
on public.import_batches for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_access_module(module, 'import')
);

create policy import_batches_internal_update
on public.import_batches for update
to authenticated
using (private.can_access_module(module, 'import'))
with check (private.can_access_module(module, 'import'));

create policy import_batches_internal_delete
on public.import_batches for delete
to authenticated
using (private.can_access_module(module, 'delete'));

create policy import_rows_internal_select
on public.import_rows for select
to authenticated
using (
  exists (
    select 1
    from public.import_batches
    where import_batches.id = import_rows.batch_id
  )
);

create policy import_rows_internal_insert
on public.import_rows for insert
to authenticated
with check (
  exists (
    select 1
    from public.import_batches
    where import_batches.id = import_rows.batch_id
  )
);

create policy import_rows_internal_update
on public.import_rows for update
to authenticated
using (
  exists (
    select 1
    from public.import_batches
    where import_batches.id = import_rows.batch_id
  )
)
with check (
  exists (
    select 1
    from public.import_batches
    where import_batches.id = import_rows.batch_id
  )
);

create policy import_rows_internal_delete
on public.import_rows for delete
to authenticated
using (
  exists (
    select 1
    from public.import_batches
    where import_batches.id = import_rows.batch_id
      and private.can_access_module(import_batches.module, 'delete')
  )
);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.can_access_module(public.module_key, text)
  to authenticated;

grant select on public.countries, public.organization_units
  to anon, authenticated;

grant select (
  id,
  project_name,
  purpose,
  country_id,
  city,
  start_date,
  end_date,
  fiscal_year,
  status,
  participant_count,
  publication_status,
  public_visible,
  deleted_at
) on public.travel_records to anon;

grant select on public.travel_public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, preferred_locale) on public.profiles to authenticated;

grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.travel_records to authenticated;
grant select, insert, update, delete on public.travel_participants to authenticated;
grant select, insert, update, delete on public.travel_budgets to authenticated;
grant select, insert, update, delete on public.import_batches to authenticated;
grant select, insert, update, delete on public.import_rows to authenticated;

grant usage on schema private to service_role;
grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;
grant all on all sequences in schema public to service_role;
grant all on all sequences in schema private to service_role;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role, public;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
