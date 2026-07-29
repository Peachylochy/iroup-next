import { redirect } from "next/navigation";

import { AccountPasswordWorkspace } from "@/features/settings/account/account-password-workspace";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

export default async function AccountSettingsPage() {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");

  return (
    <AccountPasswordWorkspace
      access={access}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}
