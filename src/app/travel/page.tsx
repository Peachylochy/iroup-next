import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel, type CurrentUserAccess } from "@/lib/auth/access";
import { getTravelList } from "@/features/travel/travel-list-query";
import { parseTravelListState, travelListHref, type TravelListState, type TravelSearchParams } from "@/features/travel/travel-list-state";
import { TravelWorkspace } from "@/features/travel/travel-workspace";
import TravelLoading from "./loading";

export const dynamic = "force-dynamic";

function viewerFor(access: CurrentUserAccess) {
  return { displayName: access.profile.display_name, email: access.profile.email, role: roleLabel(access.roles) };
}

async function TravelResults({ access, state }: { access: CurrentUserAccess; state: TravelListState }) {
  const result = await getTravelList(state);
  if (state.page !== result.page) redirect(travelListHref(state, { page: result.page }));
  return <TravelWorkspace access={access} viewer={viewerFor(access)} state={state} result={result} />;
}

export default async function TravelPage({ searchParams }: { searchParams: Promise<TravelSearchParams> }) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login?next=%2Ftravel");
  if (!hasWorkspaceAccess(access) || !access.modules.travel?.view) {
    return (
      <WorkspaceChrome access={access} viewer={viewerFor(access)} title="เดินทางไปปฏิบัติงาน" activePath="/travel" hidePlaceholderControls>
        <main className="module-main">
          <section className="module-list-card p-6" aria-labelledby="travel-permission-title">
            <h1 id="travel-permission-title" className="text-xl font-semibold">ยังไม่มีสิทธิ์ดูข้อมูลการเดินทาง</h1>
            <p className="my-3 text-muted-foreground">โปรดติดต่อผู้ดูแลระบบเพื่อตรวจสอบสิทธิ์ของบัญชีนี้</p>
            <Link href="/" className="underline underline-offset-4">กลับหน้าหลัก</Link>
          </section>
        </main>
      </WorkspaceChrome>
    );
  }
  const state = parseTravelListState(await searchParams);
  return <Suspense key={travelListHref(state)} fallback={<TravelLoading />}><TravelResults access={access} state={state} /></Suspense>;
}
