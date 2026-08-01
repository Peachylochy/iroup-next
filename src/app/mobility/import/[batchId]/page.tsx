import { redirect } from "next/navigation";

import { MobilityImportReviewWorkspace } from "@/features/mobility/mobility-import-review-workspace";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function MobilityImportReviewPage({ params }: { params: Promise<{ batchId: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mobility?.import) redirect("/mobility");
  const { batchId } = await params;
  return <MobilityImportReviewWorkspace batchId={batchId} />;
}
