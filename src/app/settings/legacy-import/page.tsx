import { redirect } from "next/navigation";

import { LegacyImportWorkspace } from "@/features/legacy-import/legacy-import-workspace";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

export default async function LegacyImportPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.roles.includes("system_admin")) redirect("/");
  return (
    <LegacyImportWorkspace
      access={access}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}
