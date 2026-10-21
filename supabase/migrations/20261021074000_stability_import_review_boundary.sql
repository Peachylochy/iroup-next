-- Staging review must stop when commit begins. A route's separate ready check
-- cannot protect an UPDATE that waits for a concurrent commit's row locks.
-- These SECURITY INVOKER triggers inspect current_user, not JWT/config values:
-- authenticated direct writes are checked; existing SECURITY DEFINER commit
-- RPCs run as their trusted owner and can write their own commit result fields.

create function private.guard_import_batch_direct_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- UPDATE/DELETE already hold the parent row lock before this trigger runs.
  if tg_op <> 'INSERT' then
    if old.committed_at is not null
      or old.status not in ('uploaded', 'validating', 'ready') then
      raise exception 'IMPORT_BATCH_NOT_EDITABLE' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if new.committed_at is not null or new.status in ('importing', 'completed') then
    raise exception 'IMPORT_COMMIT_FIELDS_FORBIDDEN' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.module is distinct from old.module
    or new.import_kind is distinct from old.import_kind
    or new.created_by is distinct from old.created_by
    or new.source_file_path is distinct from old.source_file_path
  ) then
    raise exception 'IMPORT_BATCH_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.guard_import_row_direct_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_batch_id uuid;
  batch_status public.import_status;
  batch_committed_at timestamptz;
begin
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.batch_id is distinct from old.batch_id
  ) then
    raise exception 'IMPORT_ROW_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;
  target_batch_id := case when tg_op = 'DELETE' then old.batch_id else new.batch_id end;

  -- A locking read rechecks the latest parent after waiting for commit. All
  -- direct row mutations, including inserts/deletes, share this boundary.
  -- A reviewer already holding a child row can deadlock with a commit holding
  -- the parent first; PostgreSQL aborts one transaction instead of accepting a
  -- post-commit review. The caller can reload/retry an aborted request.
  select status, committed_at into batch_status, batch_committed_at
  from public.import_batches
  where id = target_batch_id
  for update;

  if not found then
    -- Preserve existing RLS errors for invisible parents; its WITH CHECK
    -- rejects new rows. This also permits FK cleanup after an editable parent
    -- was deleted (the parent trigger already checked that deletion).
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if batch_committed_at is not null
    or batch_status not in ('uploaded', 'validating', 'ready') then
    raise exception 'IMPORT_BATCH_NOT_EDITABLE' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if new.status = 'imported' or new.target_record_id is not null then
    raise exception 'IMPORT_COMMIT_FIELDS_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_import_batch_direct_write() from public, anon, authenticated;
revoke all on function private.guard_import_row_direct_write() from public, anon, authenticated;

create trigger import_batches_direct_write_guard
before insert or update or delete on public.import_batches
for each row execute function private.guard_import_batch_direct_write();

create trigger import_rows_direct_write_guard
before insert or update or delete on public.import_rows
for each row execute function private.guard_import_row_direct_write();
