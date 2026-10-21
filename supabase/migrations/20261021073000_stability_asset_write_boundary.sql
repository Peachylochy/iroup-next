-- The current application writes asset metadata and links only through the
-- permission-checked SECURITY DEFINER MOU attach/detach RPCs. Generic direct
-- table writes are unused and authorize mutations across module boundaries.
-- Seal those paths until each future content workflow has a scoped write RPC.
revoke insert, update, delete on public.assets, public.record_assets
  from authenticated;

-- A table-level REVOKE does not remove independently granted column rights.
-- Remove those too without changing SELECT, RPC execution, or service_role.
do $$
declare
  target_table text;
  column_names text;
begin
  foreach target_table in array array['assets', 'record_assets'] loop
    select string_agg(quote_ident(attribute.attname), ', ' order by attribute.attnum)
    into column_names
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = format('public.%I', target_table)::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped;

    execute format(
      'revoke insert (%s), update (%s) on public.%I from authenticated',
      column_names, column_names, target_table
    );
  end loop;
end;
$$;

-- Existing public/private read policies and the MOU RPC/storage contracts are
-- unchanged. Their callers retain the same SELECT and EXECUTE privileges.
