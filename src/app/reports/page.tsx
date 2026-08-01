import { redirect } from "next/navigation";

import { getPortalReportData } from "@/features/reports/reports-query";
import { ReportsWorkspace } from "@/features/reports/reports-workspace";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

export default async function ReportsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.reports?.view) redirect("/");
  return (
    <ReportsWorkspace
      access={access}
      data={await getPortalReportData()}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}
