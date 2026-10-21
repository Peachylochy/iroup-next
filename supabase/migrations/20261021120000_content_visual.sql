-- Local manual visual workflow. Approval never publishes or changes record_assets.
alter table public.assets
  add column sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  add column uploaded_sha256 text check (uploaded_sha256 is null or uploaded_sha256 ~ '^[a-f0-9]{64}$'),
  add column width integer check (width is null or width > 0),
  add column height integer check (height is null or height > 0),
  add column source_kind text,
  add column rights_basis text,
  add column rights_note text,
  add column attribution text,
  add column origin_url text;

create table public.visual_brief_versions (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id),
  content_version_id uuid not null,
  version_number integer not null check (version_number > 0),
  based_on_id uuid,
  brief jsonb not null,
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  revision integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (work_item_id,id), unique (content_version_id,version_number),
  foreign key (work_item_id,content_version_id) references public.content_versions(work_item_id,id),
  foreign key (work_item_id,based_on_id) references public.visual_brief_versions(work_item_id,id)
);
create table private.content_visual_uploads (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id),
  brief_id uuid not null,
  actor_id uuid not null references public.profiles(id),
  expected_revision integer not null,
  provenance jsonb not null,
  file jsonb not null,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  foreign key (work_item_id,brief_id) references public.visual_brief_versions(work_item_id,id)
);
create table public.content_manual_assets (
  asset_id uuid primary key references public.assets(id),
  work_item_id uuid not null references public.content_work_items(id),
  brief_id uuid not null,
  upload_id uuid not null unique references private.content_visual_uploads(id),
  parent_asset_id uuid,
  revision integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(work_item_id,asset_id),
  foreign key (work_item_id,brief_id) references public.visual_brief_versions(work_item_id,id),
  foreign key (work_item_id,parent_asset_id) references public.content_manual_assets(work_item_id,asset_id)
);
create table public.content_asset_sets (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id),
  brief_id uuid not null,
  version_number integer not null check(version_number > 0),
  based_on_id uuid,
  slots jsonb not null,
  digest text not null check(digest ~ '^[a-f0-9]{64}$'),
  revision integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(work_item_id,id), unique(brief_id,version_number),
  foreign key(work_item_id,brief_id) references public.visual_brief_versions(work_item_id,id),
  foreign key(work_item_id,based_on_id) references public.content_asset_sets(work_item_id,id)
);
create table public.content_visual_reviews (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id),
  target_kind text not null check(target_kind in ('brief','asset_set')),
  brief_id uuid,
  asset_set_id uuid,
  decision text not null check(decision in ('submitted','approved','returned')),
  note text not null default '',
  revision integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check((target_kind='brief' and brief_id is not null and asset_set_id is null)
    or(target_kind='asset_set' and asset_set_id is not null and brief_id is null)),
  foreign key(work_item_id,brief_id) references public.visual_brief_versions(work_item_id,id),
  foreign key(work_item_id,asset_set_id) references public.content_asset_sets(work_item_id,id),
  unique(work_item_id,revision)
);
create table private.content_visual_receipts (
  actor_id uuid not null references public.profiles(id),
  idempotency_key text not null,
  command_digest text not null,
  work_item_id uuid not null references public.content_work_items(id),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,idempotency_key)
);
create index visual_briefs_owner_idx on public.visual_brief_versions(work_item_id,created_at desc);
create index visual_briefs_based_idx on public.visual_brief_versions(based_on_id);
create index visual_uploads_owner_idx on private.content_visual_uploads(work_item_id);
create index visual_uploads_brief_idx on private.content_visual_uploads(brief_id);
create index visual_assets_brief_idx on public.content_manual_assets(brief_id);
create index visual_assets_parent_idx on public.content_manual_assets(parent_asset_id);
create index visual_sets_owner_idx on public.content_asset_sets(work_item_id,created_at desc);
create index visual_sets_based_idx on public.content_asset_sets(based_on_id);
create index visual_reviews_brief_idx on public.content_visual_reviews(brief_id,revision desc);
create index visual_reviews_set_idx on public.content_visual_reviews(asset_set_id,revision desc);
create index visual_receipts_work_idx on private.content_visual_receipts(work_item_id);

alter table public.visual_brief_versions enable row level security;
alter table public.content_manual_assets enable row level security;
alter table public.content_asset_sets enable row level security;
alter table public.content_visual_reviews enable row level security;
alter table private.content_visual_uploads enable row level security;
alter table private.content_visual_receipts enable row level security;
create policy visual_briefs_read on public.visual_brief_versions for select to authenticated using(private.can_read_content_work_item(work_item_id));
create policy visual_assets_read on public.content_manual_assets for select to authenticated using(private.can_read_content_work_item(work_item_id));
create policy visual_sets_read on public.content_asset_sets for select to authenticated using(private.can_read_content_work_item(work_item_id));
create policy visual_reviews_read on public.content_visual_reviews for select to authenticated using(private.can_read_content_work_item(work_item_id));
-- Deliberately no assets/Storage read policy: binary reads use the server proxy,
-- whose short-lived request is reauthorized rather than a durable signed URL.
revoke all on public.visual_brief_versions,public.content_manual_assets,public.content_asset_sets,public.content_visual_reviews from public,anon,authenticated,service_role;
grant select on public.visual_brief_versions,public.content_manual_assets,public.content_asset_sets,public.content_visual_reviews to authenticated;
revoke all on private.content_visual_uploads,private.content_visual_receipts from public,anon,authenticated,service_role;
create trigger visual_briefs_immutable before update or delete on public.visual_brief_versions for each row execute function private.content_immutable_history();
create trigger visual_assets_immutable before update or delete on public.content_manual_assets for each row execute function private.content_immutable_history();
create trigger visual_sets_immutable before update or delete on public.content_asset_sets for each row execute function private.content_immutable_history();
create trigger visual_reviews_immutable before update or delete on public.content_visual_reviews for each row execute function private.content_immutable_history();
create trigger visual_uploads_immutable before update or delete on private.content_visual_uploads for each row execute function private.content_immutable_history();
create trigger visual_receipts_immutable before update or delete on private.content_visual_receipts for each row execute function private.content_immutable_history();
create function private.content_visual_asset_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.content_manual_assets where asset_id=old.id) then raise exception 'CONTENT_HISTORY_IMMUTABLE' using errcode='55000'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.content_visual_asset_guard() from public,anon,authenticated,service_role;
create trigger content_visual_assets_immutable before update or delete on public.assets for each row execute function private.content_visual_asset_guard();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('content-working','content-working',false,8388608,array['image/png','image/jpeg','image/webp']);
-- No client Storage policies are introduced. A trusted server uses immutable
-- random object paths with upsert:false; pending objects are retained on unknown
-- outcomes and reconciled through the upload reservation on retry.

create function private.content_visual_actor_allowed(p_actor uuid,p_work uuid,p_action text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.content_work_items w join public.profiles p on p.id=p_actor and p.active
    where w.id=p_work
      and ((w.kind='news' and exists(select 1 from public.news_articles n where n.id=w.news_id and n.deleted_at is null))
        or(w.kind='scholarship' and exists(select 1 from public.scholarships s where s.id=w.scholarship_id and s.deleted_at is null)))
      and (exists(select 1 from private.user_roles r where r.user_id=p_actor and r.role in ('system_admin','office_admin'))
        or exists(select 1 from private.module_permissions m where m.user_id=p_actor and m.module=w.kind::public.module_key and m.can_view
          and case p_action when 'view' then true when 'update' then m.can_update when 'publish' then m.can_publish else false end)));
$$;
revoke all on function private.content_visual_actor_allowed(uuid,uuid,text) from public,anon,authenticated,service_role;
create function private.content_visual_brief_state(p_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case when private.content_version_state(b.content_version_id) is distinct from 'approved'
    or exists(select 1 from public.visual_brief_versions n where n.content_version_id=b.content_version_id and n.version_number>b.version_number) then 'stale'
    when r.decision='submitted' then 'under_review' else coalesce(r.decision,'draft') end
  from public.visual_brief_versions b left join lateral(select decision from public.content_visual_reviews where brief_id=b.id order by revision desc limit 1) r on true where b.id=p_id;
$$;
revoke all on function private.content_visual_brief_state(uuid) from public,anon,authenticated,service_role;
create function private.content_visual_set_state(p_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case when private.content_visual_brief_state(s.brief_id) is distinct from 'approved'
    or exists(select 1 from public.content_asset_sets n where n.brief_id=s.brief_id and n.version_number>s.version_number) then 'stale'
    when r.decision='submitted' then 'under_review' else coalesce(r.decision,'draft') end
  from public.content_asset_sets s left join lateral(select decision from public.content_visual_reviews where asset_set_id=s.id order by revision desc limit 1) r on true where s.id=p_id;
$$;
revoke all on function private.content_visual_set_state(uuid) from public,anon,authenticated,service_role;

create function private.content_visual_validate_brief(p_brief jsonb,p_review boolean default false)
returns void language plpgsql immutable set search_path='' as $$
declare k text; panel jsonb;
begin
  perform private.content_assert_keys(p_brief,array['title','objective','audience','key_message','design_notes','brand_notes','prompt','negative_prompt','width','height','panels']);
  foreach k in array array['title','objective','audience','key_message','design_notes','brand_notes','prompt','negative_prompt'] loop
    if jsonb_typeof(p_brief->k) is distinct from 'string' then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
    perform private.content_assert_text(p_brief->k,k in ('title','objective','audience','key_message') or(k='brand_notes' and p_review),case when k='title' then 200 when k in ('objective','audience','key_message') then 2000 else 8000 end);
  end loop;
  if jsonb_typeof(p_brief->'width') is distinct from 'number' or jsonb_typeof(p_brief->'height') is distinct from 'number'
    or coalesce(p_brief->>'width','')!~'^[0-9]{1,4}$' or coalesce(p_brief->>'height','')!~'^[0-9]{1,4}$'
    or (p_brief->>'width')::integer not between 64 and 4096 or (p_brief->>'height')::integer not between 64 and 4096
    or (p_brief->>'width')::integer*(p_brief->>'height')::integer>16000000
    or jsonb_typeof(p_brief->'panels') is distinct from 'array' then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  if jsonb_array_length(p_brief->'panels') not between 1 and 6 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  for panel in select value from jsonb_array_elements(p_brief->'panels') loop
    perform private.content_assert_keys(panel,array['key','label','notes']);
    if coalesce(panel->>'key','')!~'^[a-z][a-z0-9_-]{0,39}$' or jsonb_typeof(panel->'notes') is distinct from 'string' then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
    perform private.content_assert_text(panel->'label',true,200);
    perform private.content_assert_text(panel->'notes',false,2000);
  end loop;
  if (select count(distinct value->>'key') from jsonb_array_elements(p_brief->'panels'))<>jsonb_array_length(p_brief->'panels') then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
end;
$$;
revoke all on function private.content_visual_validate_brief(jsonb,boolean) from public,anon,authenticated,service_role;
create function private.content_visual_validate_file(p_file jsonb)
returns void language plpgsql immutable set search_path='' as $$
begin
  perform private.content_assert_keys(p_file,array['original_file_name','mime_type','size_bytes','width','height','sha256','uploaded_sha256','transform']);
  perform private.content_assert_text(p_file->'original_file_name',true,255);
  if (p_file->>'original_file_name') ~ '[/\\\x00-\x1f]' or (p_file->>'original_file_name') in ('.','..')
    or coalesce(p_file->>'mime_type','') not in ('image/png','image/jpeg','image/webp')
    or coalesce(p_file->>'sha256','')!~'^[a-f0-9]{64}$' or coalesce(p_file->>'uploaded_sha256','')!~'^[a-f0-9]{64}$'
    or p_file->>'transform' is distinct from 'visual-raster-v1'
    or jsonb_typeof(p_file->'size_bytes') is distinct from 'number' or coalesce(p_file->>'size_bytes','')!~'^[0-9]{1,8}$'
    or (p_file->>'size_bytes')::integer not between 1 and 8388608
    or jsonb_typeof(p_file->'width') is distinct from 'number' or jsonb_typeof(p_file->'height') is distinct from 'number'
    or coalesce(p_file->>'width','')!~'^[0-9]{1,4}$' or coalesce(p_file->>'height','')!~'^[0-9]{1,4}$'
    or (p_file->>'width')::integer not between 64 and 4096 or (p_file->>'height')::integer not between 64 and 4096
    or (p_file->>'width')::integer*(p_file->>'height')::integer>16000000 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
end;
$$;
revoke all on function private.content_visual_validate_file(jsonb) from public,anon,authenticated,service_role;
create function private.content_visual_validate_provenance(p_work uuid,p_value jsonb)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  perform private.content_assert_keys(p_value,array['source_kind','rights_basis','rights_note','attribution','origin_url','parent_asset_id']);
  if coalesce(p_value->>'source_kind','') not in ('manual_upload','canva_export') or coalesce(p_value->>'rights_basis','') not in ('owned','licensed','permission','public_domain')
    or jsonb_typeof(p_value->'attribution') is distinct from 'string' or jsonb_typeof(p_value->'origin_url') is distinct from 'string'
    or not(p_value ? 'parent_asset_id') then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  perform private.content_assert_text(p_value->'rights_note',true,4000);
  perform private.content_assert_text(p_value->'attribution',false,2000);
  perform private.content_assert_url(p_value->'origin_url',false);
  if p_value->>'parent_asset_id' is not null and not exists(select 1 from public.content_manual_assets where work_item_id=p_work and asset_id=(p_value->>'parent_asset_id')::uuid) then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
end;
$$;
revoke all on function private.content_visual_validate_provenance(uuid,jsonb) from public,anon,authenticated,service_role;
create function private.content_visual_validate_slots(p_work uuid,p_brief uuid,p_slots jsonb,p_review boolean default false)
returns void language plpgsql stable security definer set search_path='' as $$
declare brief jsonb; slot jsonb;
begin
  select b.brief into brief from public.visual_brief_versions b where b.id=p_brief and b.work_item_id=p_work;
  if brief is null or jsonb_typeof(p_slots) is distinct from 'array' then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  if jsonb_array_length(p_slots) not between 1 and 6 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  for slot in select value from jsonb_array_elements(p_slots) loop
    perform private.content_assert_keys(slot,array['panel_key','asset_id','alt_text_th','alt_text_en']);
    if jsonb_typeof(slot->'alt_text_th') is distinct from 'string' or jsonb_typeof(slot->'alt_text_en') is distinct from 'string'
      or not exists(select 1 from jsonb_array_elements(brief->'panels') p where p->>'key'=slot->>'panel_key') then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
    perform private.content_assert_text(slot->'alt_text_th',p_review,1000);
    perform private.content_assert_text(slot->'alt_text_en',p_review,1000);
    if not exists(select 1 from public.content_manual_assets m join public.assets a on a.id=m.asset_id
      where m.work_item_id=p_work and m.brief_id=p_brief and m.asset_id=(slot->>'asset_id')::uuid
        and a.width=(brief->>'width')::integer and a.height=(brief->>'height')::integer
        and a.storage_bucket='content-working' and not a.is_public and a.sha256 is not null) then raise exception 'ASSET_NOT_READY' using errcode='22023'; end if;
  end loop;
  if (select count(distinct value->>'panel_key') from jsonb_array_elements(p_slots))<>jsonb_array_length(p_slots)
    or (select count(distinct value->>'asset_id') from jsonb_array_elements(p_slots))<>jsonb_array_length(p_slots)
    or(p_review and jsonb_array_length(p_slots)<>jsonb_array_length(brief->'panels')) then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
end;
$$;
revoke all on function private.content_visual_validate_slots(uuid,uuid,jsonb,boolean) from public,anon,authenticated,service_role;

create function public.content_visual_execute(p_command jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); op text:=p_command->>'op'; request_key text:=p_command->>'idempotency_key';
  work public.content_work_items%rowtype; receipt private.content_visual_receipts%rowtype;
  brief public.visual_brief_versions%rowtype; aset public.content_asset_sets%rowtype;
  requested_action text; requested_decision text:=p_command->>'decision'; previous_decision text;
  new_id uuid; new_revision integer; result jsonb; request_digest text; previous_id uuid; number integer; upload_id uuid;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform 1 from public.profiles where id=actor and active for share;
  if not found then raise exception 'PROFILE_INACTIVE' using errcode='42501'; end if;
  perform 1 from private.user_roles where user_id=actor for share;
  perform 1 from private.module_permissions where user_id=actor for share;
  if p_command is null or jsonb_typeof(p_command)<>'object' or length(p_command::text)>120000
    or coalesce(op,'') not in ('save_brief','review_brief','reserve_upload','save_set','review_set')
    or coalesce(request_key,'')!~'^[A-Za-z0-9:_-]{8,200}$'
    or coalesce(p_command->>'expected_revision','')!~'^[1-9][0-9]{0,8}$' then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  select * into work from public.content_work_items where id=(p_command->>'work_item_id')::uuid;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  requested_action:=case when op in ('review_brief','review_set') and requested_decision in ('approve','return') then 'publish' else 'update' end;
  if not private.content_visual_actor_allowed(actor,work.id,requested_action) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||request_key,721200));
  request_digest:=private.content_digest(p_command);
  select * into receipt from private.content_visual_receipts where actor_id=actor and idempotency_key=request_key;
  if found then
    if receipt.command_digest<>request_digest then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    result:=receipt.result;
    if op='reserve_upload' then
      -- Serialize with finalization before checking completion. A completed
      -- receipt is safe to replay even after later edits; a pending ticket is
      -- useful only while its exact revision and approved brief remain current.
      select * into work from public.content_work_items where id=work.id for update;
      select m.asset_id,m.revision into new_id,new_revision from public.content_manual_assets m where m.upload_id=(result->>'upload_id')::uuid;
      if found then result:=result||jsonb_build_object('asset_id',new_id,'row_version',new_revision);
      else
        if work.row_version<>(receipt.result->>'row_version')::integer then raise exception 'STALE_REVISION' using errcode='PT409'; end if;
        if private.content_visual_brief_state((p_command->>'brief_id')::uuid) is distinct from 'approved' then raise exception 'BRIEF_NOT_APPROVED' using errcode='22023'; end if;
      end if;
    end if;
    return result;
  end if;
  select * into work from public.content_work_items where id=work.id for update;
  if work.row_version<>(p_command->>'expected_revision')::integer then raise exception 'STALE_REVISION' using errcode='PT409'; end if;
  new_revision:=work.row_version+1;
  result:=jsonb_build_object('work_item_id',work.id,'row_version',new_revision);
  if op='save_brief' then
    perform private.content_assert_keys(p_command,array['op','work_item_id','expected_revision','idempotency_key','content_version_id','brief']);
    if not exists(select 1 from public.content_versions where work_item_id=work.id and id=(p_command->>'content_version_id')::uuid) then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    if private.content_version_state((p_command->>'content_version_id')::uuid) is distinct from 'approved' then raise exception 'VERSION_NOT_APPROVED' using errcode='22023'; end if;
    perform private.content_visual_validate_brief(p_command->'brief');
    if(select count(*) from public.visual_brief_versions where work_item_id=work.id)>=100 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
    select b.id,b.version_number into previous_id,number from public.visual_brief_versions b where b.content_version_id=(p_command->>'content_version_id')::uuid order by b.version_number desc limit 1;
    insert into public.visual_brief_versions(work_item_id,content_version_id,version_number,based_on_id,brief,digest,revision,created_by)
    values(work.id,(p_command->>'content_version_id')::uuid,coalesce(number,0)+1,previous_id,p_command->'brief',private.content_digest(jsonb_build_object('schema_version',1,'content_version_id',p_command->>'content_version_id','brief',p_command->'brief')),new_revision,actor) returning id into new_id;
    result:=result||jsonb_build_object('brief_id',new_id);
  elsif op in ('review_brief','reserve_upload','save_set') then
    select * into brief from public.visual_brief_versions where id=(p_command->>'brief_id')::uuid and work_item_id=work.id;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    if op='review_brief' then
      perform private.content_assert_keys(p_command,array['op','work_item_id','expected_revision','idempotency_key','brief_id','decision','note']);
      if exists(select 1 from public.visual_brief_versions b where b.content_version_id=brief.content_version_id and b.version_number>brief.version_number) then raise exception 'STALE_VERSION' using errcode='PT409'; end if;
      select r.decision into previous_decision from public.content_visual_reviews r where r.brief_id=brief.id order by revision desc limit 1;
      if coalesce(requested_decision,'') not in ('submit','approve','return')
        or(requested_decision='submit' and coalesce(previous_decision,'') in ('submitted','approved'))
        or(requested_decision in ('approve','return') and previous_decision is distinct from 'submitted') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
      perform private.content_assert_text(p_command->'note',requested_decision='return',4000);
      if requested_decision<>'return' then
        if private.content_version_state(brief.content_version_id) is distinct from 'approved' then raise exception 'VERSION_NOT_APPROVED' using errcode='22023'; end if;
        perform private.content_visual_validate_brief(brief.brief,true);
      end if;
      insert into public.content_visual_reviews(work_item_id,target_kind,brief_id,decision,note,revision,created_by)
      values(work.id,'brief',brief.id,case requested_decision when 'submit' then 'submitted' when 'approve' then 'approved' else 'returned' end,coalesce(p_command->>'note',''),new_revision,actor);
      result:=result||jsonb_build_object('brief_id',brief.id);
    else
      if private.content_visual_brief_state(brief.id) is distinct from 'approved' then raise exception 'BRIEF_NOT_APPROVED' using errcode='22023'; end if;
      if op='reserve_upload' then
        perform private.content_assert_keys(p_command,array['op','work_item_id','expected_revision','idempotency_key','brief_id','provenance','file']);
        perform private.content_visual_validate_provenance(work.id,p_command->'provenance');
        perform private.content_visual_validate_file(p_command->'file');
        if p_command->'file'->>'width'<>brief.brief->>'width' or p_command->'file'->>'height'<>brief.brief->>'height' then raise exception 'ASSET_NOT_READY' using errcode='22023'; end if;
        if(select count(*) from public.content_manual_assets where work_item_id=work.id)>=100 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
        upload_id:=gen_random_uuid();
        insert into private.content_visual_uploads(id,work_item_id,brief_id,actor_id,expected_revision,provenance,file,storage_path)
        values(upload_id,work.id,brief.id,actor,work.row_version,p_command->'provenance',p_command->'file','work-items/'||work.id::text||'/'||upload_id::text||case p_command->'file'->>'mime_type' when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.webp' end);
        result:=jsonb_build_object('upload_id',upload_id,'storage_path',(select storage_path from private.content_visual_uploads where id=upload_id),'row_version',work.row_version,'asset_id',null);
      else
        perform private.content_assert_keys(p_command,array['op','work_item_id','expected_revision','idempotency_key','brief_id','slots']);
        perform private.content_visual_validate_slots(work.id,brief.id,p_command->'slots');
        if(select count(*) from public.content_asset_sets where work_item_id=work.id)>=100 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
        select s.id,s.version_number into previous_id,number from public.content_asset_sets s where s.brief_id=brief.id order by s.version_number desc limit 1;
        insert into public.content_asset_sets(work_item_id,brief_id,version_number,based_on_id,slots,digest,revision,created_by)
        values(work.id,brief.id,coalesce(number,0)+1,previous_id,p_command->'slots',private.content_digest(jsonb_build_object('schema_version',1,'brief_id',brief.id,'slots',p_command->'slots')),new_revision,actor) returning id into new_id;
        result:=result||jsonb_build_object('asset_set_id',new_id);
      end if;
    end if;
  else
    perform private.content_assert_keys(p_command,array['op','work_item_id','expected_revision','idempotency_key','asset_set_id','decision','note']);
    select * into aset from public.content_asset_sets where id=(p_command->>'asset_set_id')::uuid and work_item_id=work.id;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    if exists(select 1 from public.content_asset_sets s where s.brief_id=aset.brief_id and s.version_number>aset.version_number) then raise exception 'STALE_VERSION' using errcode='PT409'; end if;
    select r.decision into previous_decision from public.content_visual_reviews r where r.asset_set_id=aset.id order by revision desc limit 1;
    if coalesce(requested_decision,'') not in ('submit','approve','return')
      or(requested_decision='submit' and coalesce(previous_decision,'') in ('submitted','approved'))
      or(requested_decision in ('approve','return') and previous_decision is distinct from 'submitted') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
    perform private.content_assert_text(p_command->'note',requested_decision='return',4000);
    if requested_decision<>'return' then
      if private.content_visual_brief_state(aset.brief_id) is distinct from 'approved' then raise exception 'BRIEF_NOT_APPROVED' using errcode='22023'; end if;
      perform private.content_visual_validate_slots(work.id,aset.brief_id,aset.slots,true);
    end if;
    insert into public.content_visual_reviews(work_item_id,target_kind,asset_set_id,decision,note,revision,created_by)
    values(work.id,'asset_set',aset.id,case requested_decision when 'submit' then 'submitted' when 'approve' then 'approved' else 'returned' end,coalesce(p_command->>'note',''),new_revision,actor);
    result:=result||jsonb_build_object('asset_set_id',aset.id);
  end if;
  if op<>'reserve_upload' then update public.content_work_items set row_version=new_revision,updated_by=actor,updated_at=clock_timestamp() where id=work.id; end if;
  insert into private.content_visual_receipts(actor_id,idempotency_key,command_digest,work_item_id,result) values(actor,request_key,request_digest,work.id,result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'POLICY_VIOLATION' using errcode='22023';
end;
$$;
revoke all on function public.content_visual_execute(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.content_visual_execute(jsonb) to authenticated;

create function public.content_visual_finalize_upload(p_actor_id uuid,p_upload_id uuid,p_verified jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare upload private.content_visual_uploads%rowtype; work public.content_work_items%rowtype; existing public.content_manual_assets%rowtype; new_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into upload from private.content_visual_uploads where id=p_upload_id;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if upload.actor_id is distinct from p_actor_id then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.profiles where id=p_actor_id and active for share;
  if not found then raise exception 'PROFILE_INACTIVE' using errcode='42501'; end if;
  perform 1 from private.user_roles where user_id=p_actor_id for share;
  perform 1 from private.module_permissions where user_id=p_actor_id for share;
  if not private.content_visual_actor_allowed(p_actor_id,upload.work_item_id,'update') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform private.content_visual_validate_file(p_verified);
  if upload.file<>p_verified then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
  select * into work from public.content_work_items where id=upload.work_item_id for update;
  select * into existing from public.content_manual_assets where upload_id=p_upload_id;
  if found then return jsonb_build_object('work_item_id',work.id,'row_version',existing.revision,'asset_id',existing.asset_id); end if;
  if work.row_version<>upload.expected_revision then raise exception 'STALE_REVISION' using errcode='PT409'; end if;
  if private.content_visual_brief_state(upload.brief_id) is distinct from 'approved' then raise exception 'BRIEF_NOT_APPROVED' using errcode='22023'; end if;
  if(select count(*) from public.content_manual_assets where work_item_id=work.id)>=100 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='content-working' and o.name=upload.storage_path
    and o.metadata->>'mimetype'=p_verified->>'mime_type' and (o.metadata->>'size')::bigint=(p_verified->>'size_bytes')::bigint) then raise exception 'ASSET_NOT_READY' using errcode='22023'; end if;
  insert into public.assets(storage_bucket,storage_path,original_file_name,mime_type,size_bytes,is_public,created_by,sha256,uploaded_sha256,width,height,source_kind,rights_basis,rights_note,attribution,origin_url)
  values('content-working',upload.storage_path,p_verified->>'original_file_name',p_verified->>'mime_type',(p_verified->>'size_bytes')::bigint,false,p_actor_id,
    p_verified->>'sha256',p_verified->>'uploaded_sha256',(p_verified->>'width')::integer,(p_verified->>'height')::integer,upload.provenance->>'source_kind',upload.provenance->>'rights_basis',upload.provenance->>'rights_note',upload.provenance->>'attribution',upload.provenance->>'origin_url') returning id into new_id;
  insert into public.content_manual_assets(asset_id,work_item_id,brief_id,upload_id,parent_asset_id,revision,created_by)
  values(new_id,work.id,upload.brief_id,p_upload_id,(upload.provenance->>'parent_asset_id')::uuid,work.row_version+1,p_actor_id);
  update public.content_work_items set row_version=row_version+1,updated_by=p_actor_id,updated_at=clock_timestamp() where id=work.id;
  return jsonb_build_object('work_item_id',work.id,'row_version',work.row_version+1,'asset_id',new_id);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'POLICY_VIOLATION' using errcode='22023';
end;
$$;
revoke all on function public.content_visual_finalize_upload(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.content_visual_finalize_upload(uuid,uuid,jsonb) to service_role;

create function public.content_visual_asset_file(p_actor_id uuid,p_asset_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare work_id uuid; result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select work_item_id into work_id from public.content_manual_assets where asset_id=p_asset_id;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if not private.content_visual_actor_allowed(p_actor_id,work_id,'view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object('storage_path',storage_path,'mime_type',mime_type,'sha256',sha256,'size_bytes',size_bytes) into result from public.assets where id=p_asset_id;
  return result;
end;
$$;
revoke all on function public.content_visual_asset_file(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.content_visual_asset_file(uuid,uuid) to service_role;

create function public.content_visual_inspect(p_work_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare work public.content_work_items%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into work from public.content_work_items where id=p_work_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if not private.content_visual_actor_allowed(auth.uid(),work.id,'view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  result:=jsonb_build_object('work_item',jsonb_build_object('id',work.id,'row_version',work.row_version,'kind',work.kind,'record_id',coalesce(work.scholarship_id,work.news_id)));
  result:=result||jsonb_build_object('content_versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'channel',v.channel,'version_number',v.version_number,'state',private.content_version_state(v.id),'digest',v.digest) order by v.created_at desc,v.id)
    from public.content_versions v where v.id in (select id from public.content_versions where work_item_id=work.id order by created_at desc,id limit 20)
      or v.id in(select distinct on(channel) id from public.content_versions where work_item_id=work.id order by channel,version_number desc)),'[]'::jsonb));
  result:=result||jsonb_build_object('briefs',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'content_version_id',b.content_version_id,'version_number',b.version_number,'based_on_id',b.based_on_id,'brief',b.brief,'state',private.content_visual_brief_state(b.id),'is_latest',not exists(select 1 from public.visual_brief_versions n where n.content_version_id=b.content_version_id and n.version_number>b.version_number),'created_at',b.created_at) order by b.revision desc,b.id) from public.visual_brief_versions b where b.work_item_id=work.id),'[]'::jsonb));
  result:=result||jsonb_build_object('assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'brief_id',m.brief_id,'original_file_name',a.original_file_name,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'width',a.width,'height',a.height,'sha256',a.sha256,'uploaded_sha256',a.uploaded_sha256,'source_kind',a.source_kind,'rights_basis',a.rights_basis,'rights_note',a.rights_note,'attribution',a.attribution,'origin_url',a.origin_url,'parent_asset_id',m.parent_asset_id,'created_at',m.created_at) order by m.revision desc,a.id) from public.content_manual_assets m join public.assets a on a.id=m.asset_id where m.work_item_id=work.id),'[]'::jsonb));
  result:=result||jsonb_build_object('asset_sets',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'brief_id',s.brief_id,'version_number',s.version_number,'based_on_id',s.based_on_id,'slots',s.slots,'state',private.content_visual_set_state(s.id),'is_latest',not exists(select 1 from public.content_asset_sets n where n.brief_id=s.brief_id and n.version_number>s.version_number),'created_at',s.created_at) order by s.revision desc,s.id) from public.content_asset_sets s where s.work_item_id=work.id),'[]'::jsonb));
  result:=result||jsonb_build_object('reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'target_kind',r.target_kind,'target_id',coalesce(r.brief_id,r.asset_set_id),'decision',r.decision,'note',r.note,'created_at',r.created_at) order by r.revision desc) from(select * from public.content_visual_reviews where work_item_id=work.id order by revision desc limit 100) r),'[]'::jsonb));
  return result;
end;
$$;
revoke all on function public.content_visual_inspect(uuid) from public,anon,authenticated,service_role;
grant execute on function public.content_visual_inspect(uuid) to authenticated;
