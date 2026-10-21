-- Manual editorial production. Existing canonical/public content is never
-- rewritten by these commands; approving a version is not publication.
create table public.content_work_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('scholarship', 'news')),
  scholarship_id uuid unique references public.scholarships(id) on delete restrict,
  news_id uuid unique references public.news_articles(id) on delete restrict,
  title text not null,
  row_version integer not null default 1 check (row_version > 0),
  current_snapshot_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  check ((kind = 'scholarship' and scholarship_id is not null and news_id is null)
    or (kind = 'news' and news_id is not null and scholarship_id is null))
);

create table public.content_source_verifications (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id) on delete restrict,
  requested_url text not null,
  final_url text not null,
  publisher text not null,
  title text not null,
  official boolean not null,
  result text not null check (result in ('verified', 'unverified')),
  observed_on date not null,
  valid_until date not null,
  note text not null,
  revision integer not null check (revision > 0),
  method text not null default 'human' check (method = 'human'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (valid_until >= observed_on),
  unique (work_item_id, revision),
  unique (work_item_id, id)
);

create table public.content_snapshots (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id) on delete restrict,
  revision integer not null check (revision > 0),
  facts jsonb not null,
  deadlines jsonb not null default '[]',
  source_verification_ids uuid[] not null default '{}',
  schema_version integer not null default 1 check (schema_version = 1),
  hash_algorithm text not null default 'sha256' check (hash_algorithm = 'sha256'),
  canonicalization text not null default 'postgres-jsonb-text-v1' check (canonicalization = 'postgres-jsonb-text-v1'),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (work_item_id, revision),
  unique (work_item_id, id)
);
alter table public.content_work_items add constraint content_work_items_snapshot_owner
  foreign key (id, current_snapshot_id) references public.content_snapshots(work_item_id, id);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id) on delete restrict,
  snapshot_id uuid not null,
  channel text not null check (channel in ('website', 'facebook')),
  version_number integer not null check (version_number > 0),
  locales jsonb not null,
  based_on_version_id uuid,
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  schema_version integer not null default 1 check (schema_version = 1),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (work_item_id, channel, version_number),
  unique (work_item_id, id),
  foreign key (work_item_id, snapshot_id) references public.content_snapshots(work_item_id, id),
  foreign key (work_item_id, based_on_version_id) references public.content_versions(work_item_id, id)
);

create table public.content_review_decisions (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id) on delete restrict,
  version_id uuid not null,
  decision text not null check (decision in ('submitted', 'approved', 'returned')),
  note text not null default '',
  revision integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (work_item_id, revision),
  foreign key (work_item_id, version_id) references public.content_versions(work_item_id, id)
);

create table private.content_command_receipts (
  actor_id uuid not null references public.profiles(id),
  idempotency_key text not null,
  command_digest text not null,
  work_item_id uuid not null references public.content_work_items(id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, idempotency_key)
);

create index content_work_items_updated_idx on public.content_work_items(updated_at desc, id);
create index content_sources_work_idx on public.content_source_verifications(work_item_id, created_at desc);
create index content_reviews_version_idx on public.content_review_decisions(version_id, revision desc);

-- Read permission comes from the exact domain, never from ownership or another
-- module. The parent must still exist and must not have been soft-deleted.
create function private.can_read_content_work_item(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.content_work_items w
    where w.id = p_id and private.can_access_module(w.kind::public.module_key, 'view')
      and ((w.kind = 'scholarship' and exists (select 1 from public.scholarships s where s.id = w.scholarship_id and s.deleted_at is null))
        or (w.kind = 'news' and exists (select 1 from public.news_articles n where n.id = w.news_id and n.deleted_at is null)))
  );
$$;
revoke all on function private.can_read_content_work_item(uuid) from public, anon;
grant execute on function private.can_read_content_work_item(uuid) to authenticated;

alter table public.content_work_items enable row level security;
alter table public.content_source_verifications enable row level security;
alter table public.content_snapshots enable row level security;
alter table public.content_versions enable row level security;
alter table public.content_review_decisions enable row level security;
alter table private.content_command_receipts enable row level security;
create policy content_work_items_read on public.content_work_items for select to authenticated using (private.can_read_content_work_item(id));
create policy content_sources_read on public.content_source_verifications for select to authenticated using (private.can_read_content_work_item(work_item_id));
create policy content_snapshots_read on public.content_snapshots for select to authenticated using (private.can_read_content_work_item(work_item_id));
create policy content_versions_read on public.content_versions for select to authenticated using (private.can_read_content_work_item(work_item_id));
create policy content_reviews_read on public.content_review_decisions for select to authenticated using (private.can_read_content_work_item(work_item_id));
revoke all on public.content_work_items, public.content_source_verifications, public.content_snapshots,
  public.content_versions, public.content_review_decisions from public, anon, authenticated, service_role;
grant select on public.content_work_items, public.content_source_verifications, public.content_snapshots,
  public.content_versions, public.content_review_decisions to authenticated;
revoke all on private.content_command_receipts from public, anon, authenticated, service_role;

create function private.content_immutable_history()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'CONTENT_HISTORY_IMMUTABLE' using errcode = '55000';
end;
$$;
revoke all on function private.content_immutable_history() from public, anon, authenticated;
create trigger content_sources_immutable before update or delete on public.content_source_verifications for each row execute function private.content_immutable_history();
create trigger content_snapshots_immutable before update or delete on public.content_snapshots for each row execute function private.content_immutable_history();
create trigger content_versions_immutable before update or delete on public.content_versions for each row execute function private.content_immutable_history();
create trigger content_reviews_immutable before update or delete on public.content_review_decisions for each row execute function private.content_immutable_history();
create trigger content_receipts_immutable before update or delete on private.content_command_receipts for each row execute function private.content_immutable_history();

-- Existing forms keep working on unmanaged records. Once enrolled, all editor
-- writes must enter the editorial workflow; public columns remain untouched.
create function private.guard_managed_content_record()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists (
    select 1 from public.content_work_items w
    where (tg_table_name = 'scholarships' and w.scholarship_id = old.id)
       or (tg_table_name = 'news_articles' and w.news_id = old.id)
  ) then
    raise exception 'CONTENT_MANAGED_RECORD' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_managed_content_record() from public, anon, authenticated;
create trigger scholarships_content_guard before update or delete on public.scholarships for each row execute function private.guard_managed_content_record();
create trigger news_content_guard before update or delete on public.news_articles for each row execute function private.guard_managed_content_record();

-- JSON is deliberately versioned as PostgreSQL jsonb text, not advertised as
-- RFC 8785/JCS. Presentation text never feeds back into snapshot facts.
create function private.content_digest(p_value jsonb)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_value::text, 'UTF8')), 'hex');
$$;
revoke all on function private.content_digest(jsonb) from public, anon, authenticated, service_role;

create function private.content_assert_keys(p_value jsonb, p_keys text[])
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object'
    or exists (select 1 from jsonb_object_keys(p_value) k where not (k = any(p_keys))) then
    raise exception 'POLICY_VIOLATION' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.content_assert_keys(jsonb, text[]) from public, anon, authenticated, service_role;

create function private.content_trim(p_value text)
returns text language sql immutable set search_path = '' as $$
  -- ECMAScript String.trim whitespace, matching server command validation.
  select btrim(p_value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
revoke all on function private.content_trim(text) from public,anon,authenticated,service_role;

create function private.content_assert_text(p_value jsonb, p_required boolean, p_limit integer)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if (p_required and (p_value is null or p_value = 'null'::jsonb))
    or (p_value is not null and p_value <> 'null'::jsonb
      and (jsonb_typeof(p_value) <> 'string'
        or length(p_value #>> '{}') + regexp_count(p_value #>> '{}', U&'[\+010000-\+10FFFF]') > p_limit
        or (p_required and private.content_trim(p_value #>> '{}') = ''))) then
    raise exception 'POLICY_VIOLATION' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.content_assert_text(jsonb, boolean, integer) from public, anon, authenticated, service_role;

create function private.content_sources_current(p_work_item uuid, p_ids uuid[])
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'SOURCE_REQUIRED' using errcode = '22023';
  end if;
  if cardinality(p_ids) > 100 or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
    or exists (select 1 from unnest(p_ids) x where x is null or not exists (
      select 1 from public.content_source_verifications s where s.id = x and s.work_item_id = p_work_item
    )) then
    raise exception 'POLICY_VIOLATION' using errcode = '22023';
  end if;
  if exists (select 1 from public.content_source_verifications s where s.id = any(p_ids)
    and (not s.official or s.result <> 'verified' or s.valid_until < (now() at time zone 'Asia/Bangkok')::date
      or s.observed_on > (now() at time zone 'Asia/Bangkok')::date
      or exists (select 1 from public.content_source_verifications newer
        where newer.work_item_id = s.work_item_id and newer.final_url = s.final_url and newer.revision > s.revision))) then
    raise exception 'SOURCE_STALE' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.content_sources_current(uuid, uuid[]) from public, anon, authenticated, service_role;

create function private.content_date(p_value jsonb)
returns date language plpgsql immutable set search_path = '' as $$
declare v text; d date;
begin
  perform private.content_assert_text(p_value, true, 10);
  v := p_value #>> '{}';
  if v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
  d := v::date;
  if to_char(d, 'YYYY-MM-DD') <> v then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
  return d;
exception when datetime_field_overflow or invalid_datetime_format then
  raise exception 'POLICY_VIOLATION' using errcode = '22023';
end;
$$;
revoke all on function private.content_date(jsonb) from public, anon, authenticated, service_role;

create function private.content_assert_url(p_value jsonb, p_required boolean)
returns void language plpgsql immutable set search_path = '' as $$
declare v text := p_value #>> '{}'; authority text; host text; port text; parts text[]; octet text;
begin
  perform private.content_assert_text(p_value, p_required, 2000);
  if coalesce(v, '') <> '' and (v <> btrim(v) or v !~ '^https?://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$') then
    raise exception 'POLICY_VIOLATION' using errcode = '22023';
  end if;
  if coalesce(v,'') = '' then return; end if;
  authority := substring(v from '^https?://([^/?#]+)');
  if left(authority,1)='[' then
    parts := regexp_match(authority,'^\[([0-9A-Fa-f:.]+)\](:([0-9]{1,5}))?$');
    if parts is null or family(parts[1]::inet)<>6 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
    port:=parts[3];
  else
    parts:=regexp_match(authority,'^([^:]+)(:([0-9]{1,5}))?$');
    if parts is null then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
    host:=parts[1]; port:=parts[3];
    if length(host)>253 or host !~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.?$' then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
    -- WHATWG URL treats a numeric last label as an IPv4 address. Accept only
    -- explicit four-octet decimal notation, avoiding malformed numeric hosts.
    if host ~ '(^|\.)[0-9]+\.?$' then
      if host !~ '^(0|[1-9][0-9]{0,2})(\.(0|[1-9][0-9]{0,2})){3}$' then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
      foreach octet in array string_to_array(host,'.') loop
        if octet::integer>255 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
      end loop;
    end if;
  end if;
  if port is not null and port::integer>65535 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
exception when invalid_text_representation then
  raise exception 'POLICY_VIOLATION' using errcode='22023';
end;
$$;
revoke all on function private.content_assert_url(jsonb, boolean) from public, anon, authenticated, service_role;

create function private.content_validate_draft(
  p_work_item uuid, p_kind text, p_facts jsonb, p_locales jsonb, p_deadlines jsonb, p_source_ids uuid[]
)
returns void language plpgsql stable security definer set search_path = '' as $$
declare k text; locale jsonb; d jsonb; n integer; parsed_time time; parsed_instant timestamptz;
begin
  perform private.content_assert_keys(p_facts, array['subject','key_points','category','scholarship_type','audience','funding_type','study_level','eligibility','detail_url','apply_url']);
  foreach k in array array['subject','key_points','category','scholarship_type','audience','funding_type','study_level','eligibility','detail_url','apply_url'] loop
    if not (p_facts ? k) or jsonb_typeof(p_facts->k) <> 'string' then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
    perform private.content_assert_text(p_facts->k, k = 'subject', case k when 'subject' then 500 when 'key_points' then 10000 when 'eligibility' then 5000 when 'detail_url' then 2000 when 'apply_url' then 2000 else 200 end);
  end loop;
  if p_facts->>'audience' not in ('student','staff','both','external') then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
  perform private.content_assert_url(p_facts->'detail_url', false);
  perform private.content_assert_url(p_facts->'apply_url', false);
  perform private.content_assert_keys(p_locales, array['th','en']);
  foreach k in array array['th','en'] loop
    locale := p_locales->k;
    perform private.content_assert_keys(locale, array['title','summary','body','coverage']);
    if not (locale ?& array['title','summary','body','coverage']) then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
    perform private.content_assert_text(locale->'title', k = 'th', 500);
    perform private.content_assert_text(locale->'summary', false, 4000);
    perform private.content_assert_text(locale->'body', false, 20000);
    perform private.content_assert_text(locale->'coverage', false, 10000);
    if exists (select 1 from jsonb_each(locale) e where jsonb_typeof(e.value) <> 'string') then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
  end loop;
  if p_source_ids is null or cardinality(p_source_ids) > 100
    or cardinality(p_source_ids) <> (select count(distinct x) from unnest(p_source_ids) x)
    or exists (select 1 from unnest(p_source_ids) x where x is null or not exists (
      select 1 from public.content_source_verifications s where s.work_item_id = p_work_item and s.id = x
    )) then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;

  if p_deadlines is null or jsonb_typeof(p_deadlines) <> 'array' or jsonb_array_length(p_deadlines) > 3
    or (p_kind = 'news' and jsonb_array_length(p_deadlines) <> 0) then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
  select count(distinct value->>'kind') into n from jsonb_array_elements(p_deadlines);
  if n <> jsonb_array_length(p_deadlines) then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
  for d in select value from jsonb_array_elements(p_deadlines) loop
    perform private.content_assert_keys(d, array['kind','applicability','reason','cycle_key','raw_text','precision','date','time','timezone','instant','source_verification_id']);
    if not (d ?& array['kind','applicability','reason','cycle_key','raw_text','precision','date','time','timezone','instant','source_verification_id'])
      or coalesce(d->>'kind','') not in ('university_internal','thai_nominating_body','scholarship_owner')
      or coalesce(d->>'applicability','') not in ('specified','not_applicable')
      or coalesce(d->>'precision','') not in ('date_only','local_datetime','instant')
      or jsonb_typeof(d->'reason') <> 'string' or jsonb_typeof(d->'raw_text') <> 'string'
      or jsonb_typeof(d->'cycle_key') <> 'string' then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
    perform private.content_assert_text(d->'reason', d->>'applicability' = 'not_applicable', 2000);
    perform private.content_assert_text(d->'cycle_key', true, 100);
    perform private.content_assert_text(d->'raw_text', d->>'applicability' = 'specified', 4000);
    foreach k in array array['date','time','timezone','instant','source_verification_id'] loop
      perform private.content_assert_text(d->k, false, 100);
    end loop;
    if d->>'applicability' = 'not_applicable' then
      if d->>'date' is not null or d->>'time' is not null or d->>'timezone' is not null
        or d->>'instant' is not null or d->>'source_verification_id' is not null or coalesce(d->>'raw_text','') <> '' then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
      continue;
    end if;
    if d->>'source_verification_id' is not null and not ((d->>'source_verification_id')::uuid = any(p_source_ids)) then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
    if d->>'timezone' is not null and not exists (select 1 from pg_timezone_names where name = d->>'timezone') then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
    if d->>'precision' = 'date_only' then
      perform private.content_date(d->'date');
      if d->>'time' is not null or d->>'timezone' is not null or d->>'instant' is not null then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
    elsif d->>'precision' = 'local_datetime' then
      perform private.content_date(d->'date');
      if coalesce(d->>'time','') !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' or d->>'instant' is not null then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
      parsed_time := (d->>'time')::time;
    else
      if coalesce(d->>'instant','') !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$'
        or d->>'date' is not null or d->>'time' is not null then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
      parsed_instant := (d->>'instant')::timestamptz;
    end if;
  end loop;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
  raise exception 'POLICY_VIOLATION' using errcode = '22023';
end;
$$;
revoke all on function private.content_validate_draft(uuid,text,jsonb,jsonb,jsonb,uuid[]) from public, anon, authenticated, service_role;

create function public.content_core_execute(p_command jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  op text := p_command->>'op';
  request_key text := p_command->>'idempotency_key';
  request_digest text;
  receipt private.content_command_receipts%rowtype;
  work public.content_work_items%rowtype;
  snapshot public.content_snapshots%rowtype;
  version public.content_versions%rowtype;
  requested_kind text;
  required_action text;
  record_id uuid;
  new_id uuid;
  new_snapshot uuid;
  source_ids uuid[];
  facts jsonb;
  deadlines jsonb;
  snapshot_payload jsonb;
  source jsonb;
  observed date;
  valid_until date;
  new_revision integer;
  previous_decision text;
  requested_decision text;
  result jsonb;
  k text;
  current_day date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = actor and active for share;
  if not found then raise exception 'PROFILE_INACTIVE' using errcode = '42501'; end if;
  -- Pin the actor's existing authorization assignments for this transaction.
  perform 1 from private.user_roles where user_id = actor for share;
  perform 1 from private.module_permissions where user_id = actor for share;
  if p_command is null or jsonb_typeof(p_command) <> 'object' or length(p_command::text) > 200000
    or coalesce(op,'') not in ('open','record_source','save_draft','review')
    or coalesce(request_key,'') !~ '^[A-Za-z0-9:_-]{8,200}$' then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
  if op = 'open' then
    perform private.content_assert_keys(p_command, array['op','kind','record_id','title_th','idempotency_key']);
    requested_kind := p_command->>'kind';
    if coalesce(requested_kind,'') not in ('scholarship','news') then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
    record_id := (p_command->>'record_id')::uuid;
    required_action := case when record_id is null then 'create' else 'update' end;
    perform private.content_assert_text(p_command->'title_th', record_id is null, 500);
  else
    if coalesce(p_command->>'expected_revision','') !~ '^[1-9][0-9]{0,8}$' then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
    select * into work from public.content_work_items where id = (p_command->>'work_item_id')::uuid;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    requested_kind := work.kind;
    record_id := coalesce(work.scholarship_id, work.news_id);
    required_action := case when op = 'review' and p_command->>'decision' in ('approve','return') then 'publish' else 'update' end;
  end if;
  if not private.can_access_module(requested_kind::public.module_key,'view')
    or not private.can_access_module(requested_kind::public.module_key,required_action) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if op <> 'open' and not private.can_read_content_work_item(work.id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || request_key, 721001));
  request_digest := private.content_digest(p_command);
  select * into receipt from private.content_command_receipts where actor_id = actor and idempotency_key = request_key;
  if found then
    if receipt.command_digest <> request_digest then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023'; end if;
    if not private.can_read_content_work_item(receipt.work_item_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
    return receipt.result;
  end if;

  if op = 'open' then
    if record_id is null then
      record_id := gen_random_uuid();
      if requested_kind = 'scholarship' then
        insert into public.scholarships(id,title_th,created_by,updated_by) values(record_id,private.content_trim(p_command->>'title_th'),actor,actor);
      else
        insert into public.news_articles(id,title_th,created_by,updated_by) values(record_id,private.content_trim(p_command->>'title_th'),actor,actor);
      end if;
    elsif requested_kind = 'scholarship' then
      perform 1 from public.scholarships where id = record_id and deleted_at is null for update;
      if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    else
      perform 1 from public.news_articles where id = record_id and deleted_at is null for update;
      if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    end if;
    select * into work from public.content_work_items where kind = requested_kind and coalesce(scholarship_id, news_id) = record_id for update;
    if not found then
      insert into public.content_work_items(kind,scholarship_id,news_id,title,created_by,updated_by)
      values(requested_kind, case when requested_kind='scholarship' then record_id end, case when requested_kind='news' then record_id end,
        case when requested_kind='scholarship' then (select title_th from public.scholarships where id=record_id)
          else (select title_th from public.news_articles where id=record_id) end, actor,actor) returning * into work;
    end if;
    result := jsonb_build_object('work_item_id',work.id,'record_id',record_id,'row_version',work.row_version);
  else
    select * into work from public.content_work_items where id = work.id for update;
    if not private.can_read_content_work_item(work.id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    -- These are user-edit conflicts, not retryable database serialization
    -- failures. PT409 returns HTTP 409 instead of triggering automatic retries.
    if work.row_version <> (p_command->>'expected_revision')::integer then raise exception 'STALE_REVISION' using errcode = 'PT409'; end if;
    new_revision := work.row_version + 1;
    result := jsonb_build_object('work_item_id',work.id,'record_id',record_id,'row_version',new_revision);
    if op = 'record_source' then
      perform private.content_assert_keys(p_command, array['op','work_item_id','expected_revision','idempotency_key','source']);
      source := p_command->'source';
      perform private.content_assert_keys(source, array['title','publisher','requested_url','final_url','observed_on','valid_until','official','result','note']);
      foreach k in array array['title','publisher','requested_url','final_url','observed_on','valid_until','note'] loop
        perform private.content_assert_text(source->k, k <> 'note', case when k='note' then 4000 when k in ('title','publisher') then 500 else 2000 end);
      end loop;
      perform private.content_assert_url(source->'requested_url',true);
      perform private.content_assert_url(source->'final_url',true);
      if jsonb_typeof(source->'official') is distinct from 'boolean' or coalesce(source->>'result','') not in ('verified','unverified') then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
      observed := private.content_date(source->'observed_on');
      valid_until := private.content_date(source->'valid_until');
      if observed > current_day or valid_until < observed then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
      if (select count(*) from public.content_source_verifications where work_item_id=work.id) >= 100 then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
      insert into public.content_source_verifications(work_item_id,requested_url,final_url,publisher,title,official,result,observed_on,valid_until,note,revision,created_by)
      values(work.id,source->>'requested_url',source->>'final_url',source->>'publisher',source->>'title',(source->>'official')::boolean,source->>'result',observed,valid_until,coalesce(source->>'note',''),new_revision,actor)
      returning id into new_id;
      result := result || jsonb_build_object('source_verification_id',new_id);
    elsif op = 'save_draft' then
      perform private.content_assert_keys(p_command, array['op','work_item_id','expected_revision','idempotency_key','channel','facts','source_verification_ids','deadlines','locales']);
      if coalesce(p_command->>'channel','') not in ('website','facebook') or jsonb_typeof(p_command->'source_verification_ids') is distinct from 'array' then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
      select coalesce(array_agg(x::uuid order by x::uuid),'{}'::uuid[]) into source_ids from jsonb_array_elements_text(p_command->'source_verification_ids') x;
      facts := p_command->'facts';
      -- Deadline array order does not create a new fact revision.
      if jsonb_typeof(p_command->'deadlines') is distinct from 'array' then raise exception 'DEADLINE_AMBIGUOUS' using errcode = '22023'; end if;
      select coalesce(jsonb_agg(value order by value->>'kind'),'[]'::jsonb) into deadlines from jsonb_array_elements(p_command->'deadlines');
      perform private.content_validate_draft(work.id,work.kind,facts,p_command->'locales',deadlines,source_ids);
      snapshot_payload := jsonb_build_object('schema_version',1,'facts',facts,'deadlines',deadlines,'source_verification_ids',to_jsonb(source_ids));
      select * into snapshot from public.content_snapshots where id = work.current_snapshot_id;
      if work.current_snapshot_id is null or snapshot.digest <> private.content_digest(snapshot_payload) then
        insert into public.content_snapshots(work_item_id,revision,facts,deadlines,source_verification_ids,digest,created_by)
        values(work.id,new_revision,facts,deadlines,source_ids,private.content_digest(snapshot_payload),actor) returning id into new_snapshot;
      else new_snapshot := work.current_snapshot_id;
      end if;
      select * into version from public.content_versions where work_item_id=work.id and channel=p_command->>'channel' order by version_number desc limit 1;
      insert into public.content_versions(work_item_id,snapshot_id,channel,version_number,locales,based_on_version_id,digest,created_by)
      values(work.id,new_snapshot,p_command->>'channel',coalesce(version.version_number,0)+1,p_command->'locales',version.id,
        private.content_digest(jsonb_build_object('schema_version',1,'channel',p_command->>'channel','snapshot_id',new_snapshot,'locales',p_command->'locales')),actor)
      returning id into new_id;
      result := result || jsonb_build_object('version_id',new_id);
      update public.content_work_items set current_snapshot_id=new_snapshot,title=facts->>'subject' where id=work.id;
    else
      perform private.content_assert_keys(p_command, array['op','work_item_id','expected_revision','idempotency_key','version_id','decision','note']);
      requested_decision := p_command->>'decision';
      if coalesce(requested_decision,'') not in ('submit','approve','return') then raise exception 'POLICY_VIOLATION' using errcode = '22023'; end if;
      perform private.content_assert_text(p_command->'note',requested_decision='return',4000);
      select * into version from public.content_versions where id=(p_command->>'version_id')::uuid and work_item_id=work.id;
      if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
      if exists(select 1 from public.content_versions v where v.work_item_id=work.id and v.channel=version.channel and v.version_number>version.version_number) then raise exception 'STALE_VERSION' using errcode = 'PT409'; end if;
      select decision into previous_decision from public.content_review_decisions where version_id=version.id order by revision desc limit 1;
      if (requested_decision='submit' and coalesce(previous_decision,'') in ('submitted','approved'))
        or (requested_decision in ('approve','return') and previous_decision is distinct from 'submitted') then raise exception 'INVALID_TRANSITION' using errcode = '22023'; end if;
      if requested_decision <> 'return' then
        if version.snapshot_id <> work.current_snapshot_id then raise exception 'STALE_SNAPSHOT' using errcode = 'PT409'; end if;
        select * into snapshot from public.content_snapshots where id=version.snapshot_id;
        perform private.content_sources_current(work.id,snapshot.source_verification_ids);
        foreach k in array array['th','en'] loop
          if private.content_trim(coalesce(version.locales->k->>'title',''))='' or private.content_trim(coalesce(version.locales->k->>'body',''))='' then raise exception 'MISSING_LOCALE' using errcode='22023'; end if;
        end loop;
        if work.kind='scholarship' and (jsonb_array_length(snapshot.deadlines)<>3 or exists (
          select 1 from jsonb_array_elements(snapshot.deadlines) d where d->>'applicability'='specified' and d->>'source_verification_id' is null
        )) then raise exception 'DEADLINE_AMBIGUOUS' using errcode='22023'; end if;
      end if;
      insert into public.content_review_decisions(work_item_id,version_id,decision,note,revision,created_by)
      values(work.id,version.id,case requested_decision when 'submit' then 'submitted' when 'approve' then 'approved' else 'returned' end,coalesce(p_command->>'note',''),new_revision,actor);
      result := result || jsonb_build_object('version_id',version.id);
    end if;
    update public.content_work_items set row_version=new_revision,updated_by=actor,updated_at=clock_timestamp() where id=work.id;
  end if;
  insert into private.content_command_receipts(actor_id,idempotency_key,command_digest,work_item_id,result)
  values(actor,request_key,request_digest,work.id,result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'POLICY_VIOLATION' using errcode='22023';
end;
$$;
revoke all on function public.content_core_execute(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.content_core_execute(jsonb) to authenticated;

create function private.content_version_state(p_version_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when v.snapshot_id is distinct from w.current_snapshot_id
      or exists(select 1 from public.content_versions n where n.work_item_id=v.work_item_id and n.channel=v.channel and n.version_number>v.version_number)
      or exists(select 1 from public.content_source_verifications s where s.id=any(snapshot.source_verification_ids)
        and (not s.official or s.result<>'verified' or s.valid_until<(now() at time zone 'Asia/Bangkok')::date
          or exists(select 1 from public.content_source_verifications newer where newer.work_item_id=s.work_item_id and newer.final_url=s.final_url and newer.revision>s.revision))) then 'stale'
    when decision.decision='submitted' then 'under_review'
    else coalesce(decision.decision,'draft') end
  from public.content_versions v
  join public.content_work_items w on w.id=v.work_item_id
  join public.content_snapshots snapshot on snapshot.id=v.snapshot_id
  left join lateral (select r.decision from public.content_review_decisions r where r.version_id=v.id order by r.revision desc limit 1) decision on true
  where v.id=p_version_id;
$$;
revoke all on function private.content_version_state(uuid) from public,anon,authenticated,service_role;

create function public.content_core_inspect(p_kind text,p_record_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare baseline jsonb; work public.content_work_items%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if coalesce(p_kind,'') not in ('scholarship','news') then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  if not private.can_access_module(p_kind::public.module_key,'view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_kind='scholarship' then
    select jsonb_build_object('title_th',s.title_th,'publication_status',s.publication_status,'public_visible',s.public_visible,
      'facts',jsonb_build_object('subject',s.title_th,'key_points',coalesce(s.summary_th,''),'category','',
        'scholarship_type',coalesce(s.scholarship_type,''),'audience',s.audience,'funding_type',coalesce(s.funding_type,''),
        'study_level',coalesce(s.study_level,''),'eligibility','','detail_url',coalesce(s.detail_url,''),'apply_url',coalesce(s.apply_url,'')),
      'locales',jsonb_build_object(
        'th',jsonb_build_object('title',s.title_th,'summary',coalesce(s.summary_th,''),'body',coalesce(s.content_th,''),'coverage',coalesce(s.coverage_th,'')),
        'en',jsonb_build_object('title',coalesce(s.title_en,''),'summary',coalesce(s.summary_en,''),'body',coalesce(s.content_en,''),'coverage',coalesce(s.coverage_en,''))))
    into baseline from public.scholarships s where s.id=p_record_id and s.deleted_at is null;
  else
    select jsonb_build_object('title_th',n.title_th,'publication_status',n.publication_status,'public_visible',n.public_visible,
      'facts',jsonb_build_object('subject',n.title_th,'key_points',coalesce(n.summary_th,''),'category',coalesce(n.category,''),
        'scholarship_type','','audience','both','funding_type','','study_level','','eligibility','','detail_url','','apply_url',''),
      'locales',jsonb_build_object(
        'th',jsonb_build_object('title',n.title_th,'summary',coalesce(n.summary_th,''),'body',coalesce(n.content_th,''),'coverage',''),
        'en',jsonb_build_object('title',coalesce(n.title_en,''),'summary',coalesce(n.summary_en,''),'body',coalesce(n.content_en,''),'coverage','')))
    into baseline from public.news_articles n where n.id=p_record_id and n.deleted_at is null;
  end if;
  if baseline is null then return null; end if;
  select * into work from public.content_work_items where kind=p_kind and coalesce(scholarship_id,news_id)=p_record_id;
  result := jsonb_build_object('kind',p_kind,'record_id',p_record_id,'baseline',baseline,
    'work_item',case when work.id is null then null else jsonb_build_object('id',work.id,'row_version',work.row_version,'current_snapshot_id',work.current_snapshot_id) end,
    'snapshot',(select jsonb_build_object('id',s.id,'facts',s.facts,'source_verification_ids',s.source_verification_ids,'deadlines',s.deadlines,'digest',s.digest,'created_at',s.created_at) from public.content_snapshots s where s.id=work.current_snapshot_id),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'publisher',s.publisher,'requested_url',s.requested_url,'final_url',s.final_url,
      'observed_on',s.observed_on,'valid_until',s.valid_until,'official',s.official,'result',s.result,'note',s.note,'created_by',s.created_by,'created_at',s.created_at) order by s.revision desc)
      from public.content_source_verifications s where s.work_item_id=work.id),'[]'::jsonb));
  with ranked as (
    select v.*,row_number() over(order by v.created_at desc,v.id) as recent,
      row_number() over(partition by v.channel order by v.version_number desc) as channel_rank
    from public.content_versions v where v.work_item_id=work.id
  )
  select result || jsonb_build_object('versions',coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,'channel',v.channel,'version_number',v.version_number,'snapshot_id',v.snapshot_id,
    'locales',v.locales,'state',private.content_version_state(v.id),'is_latest',v.channel_rank=1,'digest',v.digest,'created_at',v.created_at
  ) order by v.created_at desc,v.id),'[]'::jsonb)) into result from ranked v where recent<=20 or channel_rank=1;
  select result || jsonb_build_object('reviews',coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb)) into result
  from (select id,version_id,decision,note,created_at,created_by from public.content_review_decisions where work_item_id=work.id order by revision desc limit 50) r;
  return result;
end;
$$;
revoke all on function public.content_core_inspect(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.content_core_inspect(text,uuid) to authenticated;

create function public.content_core_list(p_kind text,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare total integer; page integer; result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if coalesce(p_kind,'') not in ('scholarship','news') then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  if not private.can_access_module(p_kind::public.module_key,'view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select case when p_kind='scholarship' then (select count(*) from public.scholarships where deleted_at is null)
    else (select count(*) from public.news_articles where deleted_at is null) end into total;
  page := least(greatest(coalesce(p_page,1),1),greatest(1,(total+19)/20));
  with records as (
    select id,title_th,updated_at,publication_status from public.scholarships where p_kind='scholarship' and deleted_at is null
    union all
    select id,title_th,updated_at,publication_status from public.news_articles where p_kind='news' and deleted_at is null
  ), selected as (
    select r.id,coalesce(w.title,r.title_th) as title_th,greatest(r.updated_at,w.updated_at) as updated_at,r.publication_status,w.id as work_item_id,
      case when w.id is null then 'not_started' else coalesce(private.content_version_state(latest.id),'draft') end as state
    from records r left join public.content_work_items w on w.kind=p_kind and coalesce(w.scholarship_id,w.news_id)=r.id
    left join lateral(select v.id from public.content_versions v where v.work_item_id=w.id order by v.created_at desc,v.id limit 1) latest on true
    order by greatest(r.updated_at,w.updated_at) desc,r.id limit 20 offset (page-1)*20
  )
  select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(selected) order by updated_at desc,id),'[]'::jsonb),'total',total,'page',page,'page_size',20) into result from selected;
  return result;
end;
$$;
revoke all on function public.content_core_list(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.content_core_list(text,integer) to authenticated;
