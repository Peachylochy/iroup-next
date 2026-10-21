import { notFound, redirect } from "next/navigation";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";
import { ContentProduction } from "@/features/content-production/content-production";
import { ContentPermissionDenied, parseContentKind } from "@/features/content-production/pages";
import { BundleWorkspace } from "@/features/content-publication/bundle-workspace";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({ params, searchParams }: {
  params: Promise<{ kind: string; recordId: string }>;
  searchParams: Promise<{ bundle?: string | string[] }>;
}) {
  const values = await params;
  const query = await searchParams;
  const kind = parseContentKind(values.kind);
  if (!uuid.test(values.recordId)) notFound();
  if (query.bundle !== undefined && (typeof query.bundle !== "string" || !uuid.test(query.bundle))) notFound();
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login?next=%2Fcontent-production");
  if (!hasWorkspaceAccess(access) || !access.modules[kind]?.view) return <ContentPermissionDenied access={access} />;
  const core = await ContentProduction.inspect({ kind, record_id: values.recordId });
  if (!core) notFound();
  if (!core.work_item) redirect(`/content-production/${kind}/${values.recordId}`);
  const detail = await ContentProduction.publication.inspect(core.work_item.id, query.bundle ?? null);
  return <BundleWorkspace detail={detail} access={access} viewer={{ displayName: access.profile.display_name, email: access.profile.email, role: roleLabel(access.roles) }} />;
}
