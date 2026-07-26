-- Expose only the caller's effective access context to the authenticated app.
create function public.current_user_access()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    else jsonb_build_object(
      'user_id',
      (select auth.uid()),
      'profile',
      (
        select jsonb_build_object(
          'email', profiles.email,
          'display_name', profiles.display_name,
          'preferred_locale', profiles.preferred_locale,
          'active', profiles.active
        )
        from public.profiles
        where profiles.id = (select auth.uid())
      ),
      'roles',
      coalesce(
        (
          select jsonb_agg(role_name order by role_name)
          from unnest(enum_range(null::public.app_role)) as role_name
          where (select private.has_role(role_name))
        ),
        '[]'::jsonb
      ),
      'modules',
      coalesce(
        (
          select jsonb_object_agg(
            module_name::text,
            jsonb_build_object(
              'view', (select private.can_access_module(module_name, 'view')),
              'create', (select private.can_access_module(module_name, 'create')),
              'update', (select private.can_access_module(module_name, 'update')),
              'publish', (select private.can_access_module(module_name, 'publish')),
              'delete', (select private.can_access_module(module_name, 'delete')),
              'import', (select private.can_access_module(module_name, 'import'))
            )
          )
          from unnest(enum_range(null::public.module_key)) as module_name
        ),
        '{}'::jsonb
      )
    )
  end;
$$;

comment on function public.current_user_access() is
  'Returns only the current authenticated user profile, roles, and effective module permissions.';

revoke execute on function public.current_user_access()
  from public, anon, service_role;
grant execute on function public.current_user_access()
  to authenticated;
