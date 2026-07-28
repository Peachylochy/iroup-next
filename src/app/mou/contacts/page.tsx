import { redirect } from "next/navigation";

import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";
import { getPartnerContacts } from "@/features/partners/partner-query";
import { PartnerContactsWorkspace } from "@/features/partners/partner-contacts-workspace";

export default async function PartnerContactsPage() {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");
  if (!access.modules.mou?.view) redirect("/");

  const contacts = await getPartnerContacts();

  const viewer = {
    displayName: access.profile.display_name,
    email: access.profile.email,
    role: roleLabel(access.roles),
  };

  return <PartnerContactsWorkspace access={access} contacts={contacts} viewer={viewer} />;
}
