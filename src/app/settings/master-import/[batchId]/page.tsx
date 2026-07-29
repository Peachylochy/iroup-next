import { redirect } from "next/navigation";
import { MasterImportReviewWorkspace } from "@/features/master-import/master-import-review-workspace";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";

export default async function MasterImportReviewPage({ params }: { params: Promise<{ batchId: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.roles.includes("system_admin")) redirect("/");
  const { batchId } = await params;
  return <MasterImportReviewWorkspace batchId={batchId} access={access} viewer={{ displayName: access.profile.display_name, email: access.profile.email, role: roleLabel(access.roles) }} />;
}
