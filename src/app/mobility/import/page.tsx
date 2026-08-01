import { redirect } from "next/navigation";
import { MobilityImportPreviewWorkspace } from "@/features/mobility/mobility-import-preview-workspace";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function StudentMobilityImportPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mobility?.import) redirect("/mobility");
  return <MobilityImportPreviewWorkspace access={access} />;
}
