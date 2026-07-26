drop policy budget_types_admin_all on public.budget_types;

create policy budget_types_admin_insert
on public.budget_types for insert
to authenticated
with check (
  private.is_admin()
  or private.can_access_module('settings', 'update')
);

create policy budget_types_admin_update
on public.budget_types for update
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'update')
)
with check (
  private.is_admin()
  or private.can_access_module('settings', 'update')
);

create policy budget_types_admin_delete
on public.budget_types for delete
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'delete')
);

drop policy file_roles_admin_all on public.file_roles;

create policy file_roles_admin_insert
on public.file_roles for insert
to authenticated
with check (
  private.is_admin()
  or private.can_access_module('settings', 'update')
);

create policy file_roles_admin_update
on public.file_roles for update
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'update')
)
with check (
  private.is_admin()
  or private.can_access_module('settings', 'update')
);

create policy file_roles_admin_delete
on public.file_roles for delete
to authenticated
using (
  private.is_admin()
  or private.can_access_module('settings', 'delete')
);
