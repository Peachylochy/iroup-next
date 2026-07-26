import { Clock3, LogOut, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function PendingAccessPage() {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (hasWorkspaceAccess(access)) redirect("/");

  return (
    <main className="pending-page">
      <section className="pending-card">
        <span className="pending-icon" aria-hidden="true">
          <Clock3 />
        </span>
        <p className="pending-eyebrow">บัญชีสร้างเรียบร้อยแล้ว</p>
        <h1>รอผู้ดูแลอนุมัติสิทธิ์</h1>
        <p>
          บัญชี <strong>{access.profile.email}</strong> ยืนยันตัวตนแล้ว
          แต่ยังไม่มีสิทธิ์เข้าถึงโมดูลภายใน
        </p>
        <div className="pending-rule">
          <ShieldCheck aria-hidden="true" />
          <span>
            ระบบจะไม่แสดง MOU, Mobility, การเดินทาง หรือข้อมูลผู้ติดต่อ
            จนกว่าจะได้รับสิทธิ์
          </span>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="lg">
            <LogOut data-icon="inline-start" />
            ออกจากระบบ
          </Button>
        </form>
      </section>
    </main>
  );
}
