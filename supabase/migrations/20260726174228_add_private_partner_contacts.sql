-- Internal relationship contacts for foreign partner organizations.
--
-- These tables live in the exposed `public` schema so the authenticated
-- Next.js workspace can use Supabase Data API. They are not public content:
-- anon receives no table privileges and every table is protected by RLS.

create type public.contact_method_type as enum (
  'email',
  'phone',
  'messaging',
  'social',
  'website',
  'other'
);

create type public.relationship_level as enum (
  'unrated',
  'low',
  'medium',
  'high'
);

create table public.partner_contacts (
  id uuid primary key default gen_random_uuid(),
  partner_organization_id uuid not null
    references public.partner_organizations (id) on delete restrict,
  full_name text not null,
  position_title text,
  department text,
  expertise_areas text[] not null default '{}',
  relationship_level public.relationship_level not null default 'unrated',
  preferred_language text,
  internal_note text,
  source_import_batch_id uuid
    references public.import_batches (id) on delete set null,
  source_row_number integer check (
    source_row_number is null or source_row_number > 0
  ),
  last_contacted_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint partner_contact_name_not_blank check (
    nullif(btrim(full_name), '') is not null
  )
);

create table public.partner_contact_methods (
  id uuid primary key default gen_random_uuid(),
  partner_contact_id uuid not null
    references public.partner_contacts (id) on delete cascade,
  method_type public.contact_method_type not null,
  value text not null,
  label text,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint partner_contact_method_value_not_blank check (
    nullif(btrim(value), '') is not null
  )
);

create table public.partner_contact_interactions (
  id uuid primary key default gen_random_uuid(),
  partner_contact_id uuid not null
    references public.partner_contacts (id) on delete cascade,
  occurred_on date,
  interaction_type text,
  context text,
  movement_id uuid
    references public.movement_cases (id) on delete set null,
  agreement_id uuid
    references public.agreements (id) on delete set null,
  note text,
  follow_up_on date,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint partner_contact_interaction_has_context check (
    nullif(btrim(context), '') is not null
    or movement_id is not null
    or agreement_id is not null
  )
);

create index partner_contacts_organization_idx
  on public.partner_contacts (partner_organization_id);
create index partner_contacts_active_relationship_idx
  on public.partner_contacts (active, relationship_level);
create index partner_contacts_last_contacted_idx
  on public.partner_contacts (last_contacted_on desc nulls last);
create index partner_contacts_import_batch_idx
  on public.partner_contacts (source_import_batch_id)
  where source_import_batch_id is not null;
create index partner_contacts_created_by_idx
  on public.partner_contacts (created_by);
create index partner_contacts_updated_by_idx
  on public.partner_contacts (updated_by);
create index partner_contacts_deleted_by_idx
  on public.partner_contacts (deleted_by)
  where deleted_by is not null;

create index partner_contact_methods_contact_idx
  on public.partner_contact_methods (partner_contact_id);
create index partner_contact_methods_value_idx
  on public.partner_contact_methods (lower(value));
create index partner_contact_methods_created_by_idx
  on public.partner_contact_methods (created_by);
create index partner_contact_methods_updated_by_idx
  on public.partner_contact_methods (updated_by);
create unique index partner_contact_methods_unique
  on public.partner_contact_methods (
    partner_contact_id,
    method_type,
    lower(value)
  );
create unique index partner_contact_one_primary_method_per_type
  on public.partner_contact_methods (partner_contact_id, method_type)
  where is_primary and active;

create index partner_contact_interactions_contact_date_idx
  on public.partner_contact_interactions (
    partner_contact_id,
    occurred_on desc nulls last
  );
create index partner_contact_interactions_movement_idx
  on public.partner_contact_interactions (movement_id)
  where movement_id is not null;
create index partner_contact_interactions_agreement_idx
  on public.partner_contact_interactions (agreement_id)
  where agreement_id is not null;
create index partner_contact_interactions_created_by_idx
  on public.partner_contact_interactions (created_by);
create index partner_contact_interactions_updated_by_idx
  on public.partner_contact_interactions (updated_by);

create trigger partner_contacts_protect_audit_fields
before update on public.partner_contacts
for each row execute function private.protect_record_audit_fields();

create trigger partner_contact_methods_protect_audit_fields
before update on public.partner_contact_methods
for each row execute function private.protect_record_audit_fields();

create trigger partner_contact_interactions_protect_audit_fields
before update on public.partner_contact_interactions
for each row execute function private.protect_record_audit_fields();

create trigger partner_contacts_audit
after insert or update or delete on public.partner_contacts
for each row execute function private.audit_row_change();

create trigger partner_contact_methods_audit
after insert or update or delete on public.partner_contact_methods
for each row execute function private.audit_row_change();

create trigger partner_contact_interactions_audit
after insert or update or delete on public.partner_contact_interactions
for each row execute function private.audit_row_change();

alter table public.partner_contacts enable row level security;
alter table public.partner_contact_methods enable row level security;
alter table public.partner_contact_interactions enable row level security;

create policy partner_contacts_select
on public.partner_contacts for select
to authenticated
using (private.can_access_module('mou', 'view'));

create policy partner_contacts_insert
on public.partner_contacts for insert
to authenticated
with check (
  private.can_access_module('mou', 'create')
  and created_by = (select auth.uid())
);

create policy partner_contacts_update
on public.partner_contacts for update
to authenticated
using (private.can_access_module('mou', 'update'))
with check (private.can_access_module('mou', 'update'));

create policy partner_contacts_delete
on public.partner_contacts for delete
to authenticated
using (private.can_access_module('mou', 'delete'));

create policy partner_contact_methods_select
on public.partner_contact_methods for select
to authenticated
using (private.can_access_module('mou', 'view'));

create policy partner_contact_methods_insert
on public.partner_contact_methods for insert
to authenticated
with check (
  private.can_access_module('mou', 'create')
  and created_by = (select auth.uid())
);

create policy partner_contact_methods_update
on public.partner_contact_methods for update
to authenticated
using (private.can_access_module('mou', 'update'))
with check (private.can_access_module('mou', 'update'));

create policy partner_contact_methods_delete
on public.partner_contact_methods for delete
to authenticated
using (private.can_access_module('mou', 'delete'));

create policy partner_contact_interactions_select
on public.partner_contact_interactions for select
to authenticated
using (private.can_access_module('mou', 'view'));

create policy partner_contact_interactions_insert
on public.partner_contact_interactions for insert
to authenticated
with check (
  private.can_access_module('mou', 'create')
  and created_by = (select auth.uid())
);

create policy partner_contact_interactions_update
on public.partner_contact_interactions for update
to authenticated
using (private.can_access_module('mou', 'update'))
with check (private.can_access_module('mou', 'update'));

create policy partner_contact_interactions_delete
on public.partner_contact_interactions for delete
to authenticated
using (private.can_access_module('mou', 'delete'));

-- MOU editors maintain their own partner directory without needing Settings.
drop policy partner_organizations_admin_insert
on public.partner_organizations;
create policy partner_organizations_internal_insert
on public.partner_organizations for insert
to authenticated
with check (
  private.is_admin()
  or private.can_access_module('settings', 'create')
  or private.can_access_module('mou', 'create')
);

drop policy partner_organizations_admin_update
on public.partner_organizations;
create policy partner_organizations_internal_update
on public.partner_organizations for update
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'update')
  or private.can_access_module('mou', 'update')
)
with check (
  private.is_admin()
  or private.can_access_module('settings', 'update')
  or private.can_access_module('mou', 'update')
);

revoke all on
  public.partner_contacts,
  public.partner_contact_methods,
  public.partner_contact_interactions
from anon, authenticated;

grant select, insert, update, delete on
  public.partner_contacts,
  public.partner_contact_methods,
  public.partner_contact_interactions
to authenticated;
