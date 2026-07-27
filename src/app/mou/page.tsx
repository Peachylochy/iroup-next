import { redirect } from "next/navigation";

import { MouWorkspace } from "@/features/mou/mou-workspace";
import { getMouAgreements } from "@/features/mou/mou-query";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

export default async function MouPage() {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");
  if (!access.modules.mou?.view) redirect("/");

  const agreements = await getMouAgreements();

  return (
    <MouWorkspace
      access={access}
      agreements={agreements}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}
