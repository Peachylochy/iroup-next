import { redirect } from "next/navigation";
import { PartnerWorkspace } from "@/features/partners/partner-workspace";
import { getPartnerOrganizations } from "@/features/partners/partner-query";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";

export default async function PartnerOrganizationsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.view) redirect("/");
  const partners = await getPartnerOrganizations();
  return <PartnerWorkspace access={access} partners={partners} viewer={{ displayName: access.profile.display_name, email: access.profile.email, role: roleLabel(access.roles) }} />;
}
