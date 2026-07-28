import { redirect } from "next/navigation";
import { MobilityWorkspace } from "@/features/mobility/mobility-workspace";
import { getStudentMobilities } from "@/features/mobility/mobility-query";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";

export default async function MobilityPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mobility?.view) redirect("/");
  const items = await getStudentMobilities();
  return <MobilityWorkspace access={access} items={items} viewer={{ displayName: access.profile.display_name, email: access.profile.email, role: roleLabel(access.roles) }} />;
}
