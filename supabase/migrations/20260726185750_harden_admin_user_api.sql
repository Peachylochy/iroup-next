-- Keep privilege-elevating implementations outside the exposed API schema.
-- Public wrappers execute with the caller's role and remain the only RPC surface.

alter function public.admin_user_directory()
  set schema private;

alter function public.admin_set_user_access(
  uuid,
  public.app_role,
  boolean,
  jsonb
) set schema private;

revoke execute on function private.admin_user_directory()
  from public, anon, service_role;
revoke execute on function private.admin_set_user_access(
  uuid,
  public.app_role,
  boolean,
  jsonb
) from public, anon, service_role;

grant execute on function private.admin_user_directory()
  to authenticated;
grant execute on function private.admin_set_user_access(
  uuid,
  public.app_role,
  boolean,
  jsonb
) to authenticated;

create function public.admin_user_directory()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_user_directory();
$$;

create function public.admin_set_user_access(
  p_target_user_id uuid,
  p_target_role public.app_role,
  p_active boolean,
  p_permissions jsonb default '{}'::jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.admin_set_user_access(
    p_target_user_id,
    p_target_role,
    p_active,
    p_permissions
  );
$$;

comment on function public.admin_user_directory() is
  'Security-invoker RPC for the private system-administrator directory API.';

comment on function public.admin_set_user_access(
  uuid,
  public.app_role,
  boolean,
  jsonb
) is
  'Security-invoker RPC for the private atomic access mutation API.';

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
