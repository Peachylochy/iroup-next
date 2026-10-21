import { notFound, redirect } from "next/navigation";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";
import { ContentProduction } from "@/features/content-production/content-production";
import { ContentPermissionDenied, parseContentKind } from "@/features/content-production/pages";
import { VisualWorkspace } from "@/features/content-visual/visual-workspace";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ kind: string; recordId: string }> }) {
  const values = await params;
  const kind = parseContentKind(values.kind);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values.recordId)) notFound();
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login?next=%2Fcontent-production");
  if (!hasWorkspaceAccess(access) || !access.modules[kind]?.view) return <ContentPermissionDenied access={access} />;
  const core = await ContentProduction.inspect({ kind, record_id: values.recordId });
  if (!core) notFound();
  if (!core.work_item) redirect(`/content-production/${kind}/${values.recordId}`);
  const detail = await ContentProduction.visual.inspect(core.work_item.id);
  return <VisualWorkspace detail={detail} access={access} viewer={{ displayName: access.profile.display_name, email: access.profile.email, role: roleLabel(access.roles) }} />;
}
