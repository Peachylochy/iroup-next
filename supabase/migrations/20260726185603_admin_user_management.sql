-- System-administrator API for the internal user and permission workspace.
-- Authorization is checked inside each SECURITY DEFINER function because
-- private role tables are intentionally unavailable through the Data API.

create function public.admin_user_directory()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select private.has_role('system_admin')) then
    raise exception using
      errcode = '42501',
      message = 'Only a system administrator can view user access.';
  end if;

  return jsonb_build_object(
      'users',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'email', p.email,
              'display_name', p.display_name,
              'active', p.active,
              'created_at', p.created_at,
              'role', r.role,
              'modules',
              (
                select jsonb_object_agg(
                  m.module_name::text,
                  jsonb_build_object(
                    'view', coalesce(mp.can_view, false),
                    'create', coalesce(mp.can_create, false),
                    'update', coalesce(mp.can_update, false),
                    'publish', coalesce(mp.can_publish, false),
                    'delete', coalesce(mp.can_delete, false),
                    'import', coalesce(mp.can_import, false)
                  )
                  order by m.module_name::text
                )
                from unnest(enum_range(null::public.module_key)) m(module_name)
                left join private.module_permissions mp
                  on mp.user_id = p.id
                 and mp.module = m.module_name
              )
            )
            order by p.display_name, p.email
          )
          from public.profiles p
          left join lateral (
            select ur.role
            from private.user_roles ur
            where ur.user_id = p.id
            order by
              case ur.role
                when 'system_admin' then 1
                when 'office_admin' then 2
                when 'editor' then 3
                when 'viewer' then 4
              end
            limit 1
          ) r on true
        ),
        '[]'::jsonb
      )
  );
end;
$$;

create function public.admin_set_user_access(
  p_target_user_id uuid,
  p_target_role public.app_role,
  p_active boolean,
  p_permissions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  module_name public.module_key;
  module_permissions jsonb;
  unknown_key text;
  target_is_system_admin boolean;
begin
  if actor_id is null
    or not (select private.has_role('system_admin')) then
    raise exception using
      errcode = '42501',
      message = 'Only a system administrator can change user access.';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_target_user_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'User profile was not found.';
  end if;

  if p_active is null then
    raise exception using
      errcode = '22004',
      message = 'Account status is required.';
  end if;

  if jsonb_typeof(coalesce(p_permissions, '{}'::jsonb)) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Permissions must be a JSON object.';
  end if;

  select key into unknown_key
  from jsonb_object_keys(coalesce(p_permissions, '{}'::jsonb)) key
  where key <> all(enum_range(null::public.module_key)::text[])
  limit 1;

  if unknown_key is not null then
    raise exception using
      errcode = '22023',
      message = format('Unknown module: %s', unknown_key);
  end if;

  select exists (
    select 1
    from private.user_roles
    where user_id = p_target_user_id
      and role = 'system_admin'
  ) into target_is_system_admin;

  if p_target_user_id = actor_id
    and (p_target_role is distinct from 'system_admin'::public.app_role
      or not p_active) then
    raise exception using
      errcode = '42501',
      message = 'You cannot remove your own system administrator access.';
  end if;

  if target_is_system_admin
    and (p_target_role is distinct from 'system_admin'::public.app_role
      or not p_active)
    and (
      select count(*)
      from private.user_roles ur
      join public.profiles p on p.id = ur.user_id
      where ur.role = 'system_admin'
        and p.active
    ) <= 1 then
    raise exception using
      errcode = '42501',
      message = 'At least one active system administrator is required.';
  end if;

  update public.profiles
  set active = p_active
  where id = p_target_user_id;

  delete from private.user_roles
  where user_id = p_target_user_id;

  if p_target_role is not null then
    insert into private.user_roles (user_id, role, granted_by)
    values (p_target_user_id, p_target_role, actor_id);
  end if;

  delete from private.module_permissions
  where user_id = p_target_user_id;

  if p_target_role in ('viewer', 'editor') then
    foreach module_name in array enum_range(null::public.module_key)
    loop
      module_permissions :=
        coalesce(p_permissions, '{}'::jsonb) -> module_name::text;

      if module_permissions is not null then
        if jsonb_typeof(module_permissions) <> 'object' then
          raise exception using
            errcode = '22023',
            message = format(
              'Permissions for module %s must be an object.',
              module_name
            );
        end if;

        select key into unknown_key
        from jsonb_object_keys(module_permissions) key
        where key <> all(
          array['view', 'create', 'update', 'publish', 'delete', 'import']
        )
        limit 1;

        if unknown_key is not null then
          raise exception using
            errcode = '22023',
            message = format(
              'Unknown permission action for %s: %s',
              module_name,
              unknown_key
            );
        end if;

        insert into private.module_permissions (
          user_id,
          module,
          can_view,
          can_create,
          can_update,
          can_publish,
          can_delete,
          can_import,
          granted_by
        )
        values (
          p_target_user_id,
          module_name,
          coalesce((module_permissions ->> 'view')::boolean, false),
          case when p_target_role = 'editor'
            then coalesce((module_permissions ->> 'create')::boolean, false)
            else false end,
          case when p_target_role = 'editor'
            then coalesce((module_permissions ->> 'update')::boolean, false)
            else false end,
          case when p_target_role = 'editor'
            then coalesce((module_permissions ->> 'publish')::boolean, false)
            else false end,
          case when p_target_role = 'editor'
            then coalesce((module_permissions ->> 'delete')::boolean, false)
            else false end,
          case when p_target_role = 'editor'
            then coalesce((module_permissions ->> 'import')::boolean, false)
            else false end,
          actor_id
        );
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'role', p_target_role,
    'active', p_active
  );
end;
$$;

comment on function public.admin_user_directory() is
  'Lists profiles and stored access assignments for system administrators.';

comment on function public.admin_set_user_access(
  uuid,
  public.app_role,
  boolean,
  jsonb
) is
  'Atomically replaces one user role, account status, and module permissions.';

revoke execute on function public.admin_user_directory()
  from public, anon, service_role;
revoke execute on function public.admin_set_user_access(
  uuid,
  public.app_role,
  boolean,
  jsonb
) from public, anon, service_role;

grant execute on function public.admin_user_directory()
  to authenticated;
grant execute on function public.admin_set_user_access(
  uuid,
  public.app_role,
  boolean,
  jsonb
) to authenticated;
