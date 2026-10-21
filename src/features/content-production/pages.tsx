import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel, type CurrentUserAccess } from "@/lib/auth/access";
import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { ContentProduction } from "./content-production";
import { ContentEditor } from "./content-editor";
import { ContentProductionWorkspace } from "./content-production-workspace";
import type { ContentKind } from "./types";

export function parseContentKind(value: string): ContentKind {
  if (value !== "scholarship" && value !== "news") notFound();
  return value;
}
function viewerFor(access: CurrentUserAccess) {
  return { displayName: access.profile.display_name, email: access.profile.email, role: roleLabel(access.roles) };
}
export function ContentPermissionDenied({ access }: { access: CurrentUserAccess }) {
  return <WorkspaceChrome access={access} viewer={viewerFor(access)} title="จัดทำเนื้อหา" activePath="/content-production" hidePlaceholderControls>
    <main className="module-main"><section className="module-list-card p-6">
      <h1 className="text-xl font-semibold">ยังไม่มีสิทธิ์จัดทำเนื้อหาส่วนนี้</h1>
      <p className="my-3">โปรดติดต่อผู้ดูแลระบบเพื่อตรวจสอบสิทธิ์ของบัญชีนี้</p>
      <Link href="/" className="underline">กลับหน้าหลัก</Link>
    </section></main>
  </WorkspaceChrome>;
}
export async function ContentProductionListPage({ kind, page }: { kind: ContentKind; page: number }) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login?next=%2Fcontent-production");
  if (!hasWorkspaceAccess(access) || !access.modules[kind]?.view) return <ContentPermissionDenied access={access} />;
  const result = await ContentProduction.list({ kind, page });
  if (result.page !== page) redirect(`/content-production?kind=${kind}&page=${result.page}`);
  return <ContentProductionWorkspace kind={kind} access={access} viewer={viewerFor(access)} result={result} />;
}
export async function ContentProductionEditorPage({ kind, recordId }: { kind: ContentKind; recordId?: string }) {
  if (recordId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) notFound();
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login?next=%2Fcontent-production");
  if (!hasWorkspaceAccess(access) || !access.modules[kind]?.view || (!recordId && !access.modules[kind]?.create)) return <ContentPermissionDenied access={access} />;
  const detail = recordId ? await ContentProduction.inspect({ kind, record_id: recordId }) : null;
  if (recordId && !detail) notFound();
  return <ContentEditor kind={kind} access={access} viewer={viewerFor(access)} detail={detail} />;
}
