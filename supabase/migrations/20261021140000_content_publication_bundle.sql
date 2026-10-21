-- Private, immutable preparation bundles only. Freezing is not publication:
-- no targets, dispatch, public mirrors, Storage policy or record_assets writes.
create table public.content_publication_bundles (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.content_work_items(id),
  channel text not null check (channel in ('website','facebook')),
  version_number integer not null check (version_number > 0),
  based_on_id uuid,
  content_version_id uuid not null,
  snapshot_id uuid not null,
  brief_id uuid not null,
  asset_set_id uuid not null,
  snapshot_digest text not null check (snapshot_digest ~ '^[a-f0-9]{64}$'),
  content_digest text not null check (content_digest ~ '^[a-f0-9]{64}$'),
  brief_digest text not null check (brief_digest ~ '^[a-f0-9]{64}$'),
  asset_set_digest text not null check (asset_set_digest ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  schema_version integer not null default 1 check (schema_version=1),
  hash_algorithm text not null default 'sha256' check (hash_algorithm='sha256'),
  canonicalization text not null default 'postgres-jsonb-text-v1' check (canonicalization='postgres-jsonb-text-v1'),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  revision integer not null check (revision > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(work_item_id,id), unique(work_item_id,channel,id),
  unique(work_item_id,channel,version_number), unique(work_item_id,asset_set_id), unique(work_item_id,revision),
  foreign key(work_item_id,channel,based_on_id) references public.content_publication_bundles(work_item_id,channel,id),
  foreign key(work_item_id,content_version_id) references public.content_versions(work_item_id,id),
  foreign key(work_item_id,snapshot_id) references public.content_snapshots(work_item_id,id),
  foreign key(work_item_id,brief_id) references public.visual_brief_versions(work_item_id,id),
  foreign key(work_item_id,asset_set_id) references public.content_asset_sets(work_item_id,id)
);
create table private.content_publication_receipts (
  actor_id uuid not null references public.profiles(id),
  idempotency_key text not null,
  command_digest text not null,
  work_item_id uuid not null references public.content_work_items(id),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,idempotency_key)
);
create index publication_bundles_revision_idx on public.content_publication_bundles(work_item_id,revision desc);
create index publication_bundles_content_idx on public.content_publication_bundles(content_version_id);
create index publication_bundles_snapshot_idx on public.content_publication_bundles(snapshot_id);
create index publication_bundles_brief_idx on public.content_publication_bundles(brief_id);
create index publication_bundles_set_idx on public.content_publication_bundles(asset_set_id);
create index publication_bundles_based_idx on public.content_publication_bundles(based_on_id);
create index publication_receipts_work_idx on private.content_publication_receipts(work_item_id);
alter table public.content_publication_bundles enable row level security;
alter table private.content_publication_receipts enable row level security;
create policy publication_bundles_read on public.content_publication_bundles for select to authenticated using(private.can_read_content_work_item(work_item_id));
revoke all on public.content_publication_bundles,private.content_publication_receipts from public,anon,authenticated,service_role;
grant select on public.content_publication_bundles to authenticated;
create trigger publication_bundles_immutable before update or delete on public.content_publication_bundles for each row execute function private.content_immutable_history();
create trigger publication_receipts_immutable before update or delete on private.content_publication_receipts for each row execute function private.content_immutable_history();

-- SQL verifies immutable registry/reservation metadata and current Storage
-- availability. Actual bytes are checked by the authenticated server preview.
create function private.content_publication_assets_ready(p_asset_set_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare aset public.content_asset_sets%rowtype; brief public.visual_brief_versions%rowtype;
  slot jsonb; asset public.assets%rowtype; manual public.content_manual_assets%rowtype; upload private.content_visual_uploads%rowtype;
begin
  select * into aset from public.content_asset_sets where id=p_asset_set_id;
  if not found then return false; end if;
  select * into brief from public.visual_brief_versions where id=aset.brief_id and work_item_id=aset.work_item_id;
  if not found then return false; end if;
  perform private.content_visual_validate_brief(brief.brief,true);
  perform private.content_visual_validate_slots(aset.work_item_id,brief.id,aset.slots,true);
  if not exists(select 1 from storage.buckets where id='content-working' and not public) then return false; end if;
  for slot in select value from jsonb_array_elements(aset.slots) loop
    select * into manual from public.content_manual_assets where work_item_id=aset.work_item_id and brief_id=brief.id and asset_id=(slot->>'asset_id')::uuid;
    if not found then return false; end if;
    select * into asset from public.assets where id=manual.asset_id;
    select * into upload from private.content_visual_uploads where id=manual.upload_id and work_item_id=aset.work_item_id and brief_id=brief.id;
    if not found then return false; end if;
    perform private.content_visual_validate_file(jsonb_build_object('original_file_name',asset.original_file_name,'mime_type',asset.mime_type,'size_bytes',asset.size_bytes,
      'width',asset.width,'height',asset.height,'sha256',asset.sha256,'uploaded_sha256',asset.uploaded_sha256,'transform','visual-raster-v1'));
    perform private.content_visual_validate_provenance(aset.work_item_id,jsonb_build_object('source_kind',asset.source_kind,'rights_basis',asset.rights_basis,'rights_note',asset.rights_note,
      'attribution',asset.attribution,'origin_url',asset.origin_url,'parent_asset_id',manual.parent_asset_id));
    if asset.is_public or asset.storage_bucket<>'content-working' or asset.storage_path<>upload.storage_path
      or upload.file->>'sha256'<>asset.sha256 or upload.file->>'uploaded_sha256'<>asset.uploaded_sha256
      or upload.file->>'mime_type'<>asset.mime_type or upload.file->>'size_bytes'<>asset.size_bytes::text
      or upload.file->>'width'<>asset.width::text or upload.file->>'height'<>asset.height::text
      or asset.storage_path !~ ('^work-items/'||aset.work_item_id::text||'/[0-9a-f-]{36}\.(png|jpg|webp)$')
      or not exists(select 1 from storage.objects o where o.bucket_id=asset.storage_bucket and o.name=asset.storage_path
        and o.metadata->>'mimetype'=asset.mime_type
        and case when o.metadata->>'size' ~ '^[0-9]{1,10}$' then (o.metadata->>'size')::bigint=asset.size_bytes else false end)
      then return false; end if;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range or sqlstate '22023' then return false;
end;
$$;
revoke all on function private.content_publication_assets_ready(uuid) from public,anon,authenticated,service_role;

create function private.content_publication_issues(p_asset_set_id uuid)
returns text[] language sql stable security definer set search_path='' as $$
  select array_remove(array[
    case when private.content_version_state(b.content_version_id) is distinct from 'approved' then 'CONTENT_NOT_APPROVED' end,
    case when private.content_visual_brief_state(b.id) is distinct from 'approved' then 'BRIEF_NOT_APPROVED' end,
    case when private.content_visual_set_state(s.id) is distinct from 'approved' then 'ASSET_SET_NOT_APPROVED' end,
    case when not private.content_publication_assets_ready(s.id) then 'ASSET_NOT_READY' end
  ],null) from public.content_asset_sets s join public.visual_brief_versions b on b.id=s.brief_id where s.id=p_asset_set_id;
$$;
revoke all on function private.content_publication_issues(uuid) from public,anon,authenticated,service_role;

create function public.content_publication_execute(p_command jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); request_key text:=p_command->>'idempotency_key'; request_digest text;
  work public.content_work_items%rowtype; receipt private.content_publication_receipts%rowtype;
  aset public.content_asset_sets%rowtype; brief public.visual_brief_versions%rowtype;
  version public.content_versions%rowtype; snapshot public.content_snapshots%rowtype;
  existing public.content_publication_bundles%rowtype; issues text[]; payload jsonb; pinned jsonb; result jsonb;
  previous_id uuid; number integer; new_id uuid; locale_name text; locales jsonb:='{}';
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform 1 from public.profiles where id=actor and active for share;
  if not found then raise exception 'PROFILE_INACTIVE' using errcode='42501'; end if;
  perform 1 from private.user_roles where user_id=actor for share;
  perform 1 from private.module_permissions where user_id=actor for share;
  perform private.content_assert_keys(p_command,array['op','work_item_id','expected_revision','idempotency_key','asset_set_id']);
  if length(p_command::text)>120000 or p_command->>'op' is distinct from 'freeze_bundle'
    or coalesce(request_key,'')!~'^[A-Za-z0-9:_-]{8,200}$'
    or jsonb_typeof(p_command->'expected_revision') is distinct from 'number'
    or coalesce(p_command->>'expected_revision','')!~'^[1-9][0-9]{0,8}$'
    or not(p_command ?& array['work_item_id','asset_set_id']) then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
  select * into work from public.content_work_items where id=(p_command->>'work_item_id')::uuid;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if not private.content_visual_actor_allowed(actor,work.id,'publish') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||request_key,721400));
  request_digest:=private.content_digest(p_command);
  select * into receipt from private.content_publication_receipts where actor_id=actor and idempotency_key=request_key;
  if found then
    if receipt.command_digest<>request_digest then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return receipt.result;
  end if;
  select * into work from public.content_work_items where id=work.id for update;
  if work.row_version<>(p_command->>'expected_revision')::integer then raise exception 'STALE_REVISION' using errcode='PT409'; end if;
  select * into aset from public.content_asset_sets where id=(p_command->>'asset_set_id')::uuid and work_item_id=work.id;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  issues:=private.content_publication_issues(aset.id);
  if cardinality(issues)>0 then raise exception '%',issues[1] using errcode='22023'; end if;
  select * into existing from public.content_publication_bundles where work_item_id=work.id and asset_set_id=aset.id;
  if found then
    result:=jsonb_build_object('work_item_id',work.id,'row_version',work.row_version,'bundle_id',existing.id,'reused',true);
  else
    if(select count(*) from public.content_publication_bundles where work_item_id=work.id)>=100 then raise exception 'POLICY_VIOLATION' using errcode='22023'; end if;
    select * into brief from public.visual_brief_versions where id=aset.brief_id and work_item_id=work.id;
    select * into version from public.content_versions where id=brief.content_version_id and work_item_id=work.id;
    select * into snapshot from public.content_snapshots where id=version.snapshot_id and work_item_id=work.id;
    -- Positive projection, never a copy of an internal draft/brief or source.
    foreach locale_name in array array['th','en'] loop
      locales:=locales||jsonb_build_object(locale_name,jsonb_build_object('title',version.locales->locale_name->'title','summary',version.locales->locale_name->'summary',
        'body',version.locales->locale_name->'body','coverage',version.locales->locale_name->'coverage'));
    end loop;
    payload:=jsonb_build_object('schema_version',1,'kind',work.kind,'channel',version.channel,'locales',locales,'images',(
      select jsonb_agg(jsonb_build_object('asset_id',a.id,'panel_key',slot.value->>'panel_key','label',panel.value->>'label','order',slot.ordinality,
        'width',a.width,'height',a.height,'mime_type',a.mime_type,'sha256',a.sha256,'alt_text_th',slot.value->>'alt_text_th','alt_text_en',slot.value->>'alt_text_en','attribution',a.attribution) order by slot.ordinality)
      from jsonb_array_elements(aset.slots) with ordinality slot(value,ordinality)
      join public.assets a on a.id=(slot.value->>'asset_id')::uuid
      join jsonb_array_elements(brief.brief->'panels') panel on panel.value->>'key'=slot.value->>'panel_key'));
    pinned:=jsonb_build_object('schema_version',1,'hash_algorithm','sha256','canonicalization','postgres-jsonb-text-v1','work_item_id',work.id,
      'snapshot_id',snapshot.id,'snapshot_digest',snapshot.digest,'content_version_id',version.id,'content_digest',version.digest,
      'brief_id',brief.id,'brief_digest',brief.digest,'asset_set_id',aset.id,'asset_set_digest',aset.digest,'payload',payload);
    select id,version_number into previous_id,number from public.content_publication_bundles where work_item_id=work.id and channel=version.channel order by version_number desc limit 1;
    insert into public.content_publication_bundles(work_item_id,channel,version_number,based_on_id,content_version_id,snapshot_id,brief_id,asset_set_id,
      snapshot_digest,content_digest,brief_digest,asset_set_digest,payload,digest,revision,created_by)
    values(work.id,version.channel,coalesce(number,0)+1,previous_id,version.id,snapshot.id,brief.id,aset.id,
      snapshot.digest,version.digest,brief.digest,aset.digest,payload,private.content_digest(pinned),work.row_version+1,actor) returning id into new_id;
    update public.content_work_items set row_version=row_version+1,updated_by=actor,updated_at=clock_timestamp() where id=work.id;
    result:=jsonb_build_object('work_item_id',work.id,'row_version',work.row_version+1,'bundle_id',new_id,'reused',false);
  end if;
  insert into private.content_publication_receipts(actor_id,idempotency_key,command_digest,work_item_id,result) values(actor,request_key,request_digest,work.id,result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'POLICY_VIOLATION' using errcode='22023';
end;
$$;
revoke all on function public.content_publication_execute(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.content_publication_execute(jsonb) to authenticated;

create function public.content_publication_inspect(p_work_item_id uuid,p_bundle_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare work public.content_work_items%rowtype; result jsonb; selected_id uuid; summaries jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into work from public.content_work_items where id=p_work_item_id;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if not private.content_visual_actor_allowed(auth.uid(),work.id,'view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_bundle_id is not null and not exists(select 1 from public.content_publication_bundles where id=p_bundle_id and work_item_id=work.id) then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  select coalesce(p_bundle_id,(select id from public.content_publication_bundles where work_item_id=work.id order by revision desc limit 1)) into selected_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'version_number',b.version_number,'channel',b.channel,'content_version_id',b.content_version_id,
    'content_version_number',v.version_number,'asset_set_id',b.asset_set_id,'asset_set_version_number',s.version_number,'based_on_id',b.based_on_id,
    'revision',b.revision,'digest',b.digest,'state',case when cardinality(status.issues)=0 then 'current' else 'stale' end,'issues',to_jsonb(status.issues),'created_at',b.created_at) order by b.revision desc),'[]'::jsonb)
    into summaries from public.content_publication_bundles b join public.content_versions v on v.id=b.content_version_id join public.content_asset_sets s on s.id=b.asset_set_id
    cross join lateral(select private.content_publication_issues(b.asset_set_id) as issues) status where b.work_item_id=work.id;
  result:=jsonb_build_object('work_item',jsonb_build_object('id',work.id,'row_version',work.row_version,'kind',work.kind,'record_id',coalesce(work.news_id,work.scholarship_id)),
    'candidates',coalesce((select jsonb_agg(jsonb_build_object('asset_set_id',s.id,'brief_id',b.id,'content_version_id',v.id,'channel',v.channel,
      'content_version_number',v.version_number,'brief_title',b.brief->>'title','asset_set_version_number',s.version_number,'image_count',jsonb_array_length(s.slots)) order by s.revision desc)
      from public.content_asset_sets s join public.visual_brief_versions b on b.id=s.brief_id join public.content_versions v on v.id=b.content_version_id
      where s.work_item_id=work.id and cardinality(private.content_publication_issues(s.id))=0),'[]'::jsonb),
    'bundles',summaries,'selected',(select summary.value||jsonb_build_object('payload',b.payload,'snapshot_id',b.snapshot_id,'snapshot_digest',b.snapshot_digest,
      'content_digest',b.content_digest,'brief_id',b.brief_id,'brief_digest',b.brief_digest,'asset_set_digest',b.asset_set_digest)
      from public.content_publication_bundles b join jsonb_array_elements(summaries) summary on summary.value->>'id'=b.id::text where b.id=selected_id));
  return result;
end;
$$;
revoke all on function public.content_publication_inspect(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.content_publication_inspect(uuid,uuid) to authenticated;
