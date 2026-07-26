import { redirect } from "next/navigation";

import { UserManagementWorkspace } from "@/features/settings/users/user-management-workspace";
import { getUserDirectory } from "@/features/settings/users/user-directory-query";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

export default async function UserManagementPage() {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");
  if (!access.roles.includes("system_admin")) redirect("/");

  const directory = await getUserDirectory();

  return (
    <UserManagementWorkspace
      access={access}
      currentUserId={access.user_id}
      users={directory.users}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}

