-- MOU private attachment storage and RPCs

-- 1. Ensure private storage bucket 'mou-attachments' exists
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mou-attachments',
  'mou-attachments',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Storage object policies for mou-attachments
drop policy if exists mou_attachments_select on storage.objects;
create policy mou_attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mou-attachments'
    and exists (
      select 1
      from public.assets
      join public.record_assets on record_assets.asset_id = assets.id
      where assets.storage_bucket = storage.objects.bucket_id
        and assets.storage_path = storage.objects.name
        and record_assets.agreement_id is not null
        and private.can_access_record_asset(
          record_assets.agreement_id,
          record_assets.movement_id,
          record_assets.scholarship_id,
          record_assets.event_id,
          record_assets.news_id,
          record_assets.knowledge_id,
          'view'
        )
    )
  );

drop policy if exists mou_attachments_insert on storage.objects;
create policy mou_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mou-attachments'
    and (
      private.can_access_module('mou', 'create')
      or private.can_access_module('mou', 'update')
    )
    and name ~ '^agreements/[0-9a-fA-F-]{36}/[^/]+$'
  );

drop policy if exists mou_attachments_update on storage.objects;
drop policy if exists mou_attachments_delete on storage.objects;

-- Assets are always fetched through their linked record. The original generic
-- authenticated policy exposed metadata for every linked asset to every user.
drop policy if exists assets_authenticated_select on public.assets;
create policy assets_authenticated_select
on public.assets for select
to authenticated
using (
  exists (
    select 1
    from public.record_assets
    where record_assets.asset_id = assets.id
      and private.can_access_record_asset(
        record_assets.agreement_id,
        record_assets.movement_id,
        record_assets.scholarship_id,
        record_assets.event_id,
        record_assets.news_id,
        record_assets.knowledge_id,
        'view'
      )
  )
);

-- 3. Public RPC: Attach file to MOU
create function public.mou_attach_file(
  p_agreement_id uuid,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_file_role_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_asset_id uuid;
  v_record_asset_id uuid;
  v_deleted_at timestamptz;
  v_mime_type text;
  v_size_bytes bigint;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not (private.can_access_module('mou', 'create') or private.can_access_module('mou', 'update')) then
    raise exception 'MOU_FORBIDDEN'
      using errcode = '42501', detail = 'Missing MOU create/update permission.';
  end if;

  select deleted_at
  into v_deleted_at
  from public.agreements
  where id = p_agreement_id;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is not null then
    raise exception 'AGREEMENT_IS_DELETED' using errcode = '55000';
  end if;

  if p_original_file_name is null or btrim(p_original_file_name) = '' then
    raise exception 'MOU_INVALID_FILE_NAME' using errcode = '22023';
  end if;

  if p_storage_path !~ ('^agreements/' || p_agreement_id::text || '/[^/]+$') then
    raise exception 'MOU_INVALID_STORAGE_PATH' using errcode = '22023';
  end if;

  select
    coalesce(nullif(metadata ->> 'mimetype', ''), p_mime_type),
    coalesce(nullif(metadata ->> 'size', '')::bigint, p_size_bytes)
  into v_mime_type, v_size_bytes
  from storage.objects
  where bucket_id = 'mou-attachments'
    and name = p_storage_path
    and owner_id = v_user_id::text;

  if not found then
    raise exception 'MOU_UPLOAD_NOT_FOUND'
      using errcode = 'P0002', detail = 'The uploaded object must belong to the current user.';
  end if;

  if exists (
    select 1
    from public.assets
    where storage_bucket = 'mou-attachments'
      and storage_path = p_storage_path
  ) then
    raise exception 'MOU_UPLOAD_ALREADY_ATTACHED' using errcode = '23505';
  end if;

  -- Create asset record (private)
  insert into public.assets (
    storage_bucket,
    storage_path,
    original_file_name,
    mime_type,
    size_bytes,
    file_role_id,
    is_public,
    created_by
  ) values (
    'mou-attachments',
    p_storage_path,
    p_original_file_name,
    v_mime_type,
    v_size_bytes,
    p_file_role_id,
    false,
    v_user_id
  )
  returning id into v_asset_id;

  -- Link asset to agreement
  insert into public.record_assets (
    asset_id,
    agreement_id,
    created_by
  ) values (
    v_asset_id,
    p_agreement_id,
    v_user_id
  )
  returning id into v_record_asset_id;

  return jsonb_build_object(
    'asset_id', v_asset_id,
    'record_asset_id', v_record_asset_id,
    'agreement_id', p_agreement_id,
    'storage_bucket', 'mou-attachments',
    'storage_path', p_storage_path,
    'original_file_name', p_original_file_name,
    'mime_type', v_mime_type,
    'size_bytes', v_size_bytes
  );
end;
$$;

-- 4. Public RPC: Detach file from MOU
create function public.mou_detach_file(
  p_agreement_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_deleted_at timestamptz;
  v_storage_path text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not (private.can_access_module('mou', 'create') or private.can_access_module('mou', 'update')) then
    raise exception 'MOU_FORBIDDEN'
      using errcode = '42501', detail = 'Missing MOU create/update permission.';
  end if;

  select deleted_at
  into v_deleted_at
  from public.agreements
  where id = p_agreement_id;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is not null then
    raise exception 'AGREEMENT_IS_DELETED' using errcode = '55000';
  end if;

  select assets.storage_path
  into v_storage_path
  from public.record_assets
  join public.assets on assets.id = record_assets.asset_id
  where record_assets.agreement_id = p_agreement_id
    and record_assets.asset_id = p_asset_id;

  if not found then
    raise exception 'MOU_ATTACHMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Remove the relation and metadata. The physical object is intentionally
  -- retained in private storage because automatic file destruction is not an
  -- approved retention policy for iROUP.
  delete from public.record_assets
  where agreement_id = p_agreement_id and asset_id = p_asset_id;

  -- A reused asset remains available to its other linked records.
  delete from public.assets
  where id = p_asset_id
    and not exists (
      select 1 from public.record_assets where asset_id = p_asset_id
    );

  return jsonb_build_object(
    'success', true,
    'agreement_id', p_agreement_id,
    'asset_id', p_asset_id,
    'storage_path', v_storage_path
  );
end;
$$;

revoke all on function public.mou_attach_file(uuid, text, text, text, bigint, uuid) from public, anon;
grant execute on function public.mou_attach_file(uuid, text, text, text, bigint, uuid) to authenticated;

revoke all on function public.mou_detach_file(uuid, uuid) from public, anon;
grant execute on function public.mou_detach_file(uuid, uuid) to authenticated;
