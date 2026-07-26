import { redirect } from "next/navigation";

import { DashboardWorkspace } from "@/features/dashboard/dashboard-workspace";
import { getDashboardSnapshot } from "@/features/dashboard/dashboard-query";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

export default async function Home() {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");

  const snapshot = await getDashboardSnapshot(access);

  return (
    <DashboardWorkspace
      access={access}
      snapshot={snapshot}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}
