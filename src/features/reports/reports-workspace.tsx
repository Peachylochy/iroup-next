"use client";

import { BarChart3, Download, FileText, Globe2, UsersRound } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import type { CurrentUserAccess } from "@/lib/auth/access";

import type { PortalReportData } from "./reports-query";

const workflowLabel: Record<string, string> = {
  draft: "ร่าง",
  under_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  active: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  archived: "เก็บถาวร",
};

export function ReportsWorkspace({
  access,
  data,
  viewer,
}: {
  access: CurrentUserAccess;
  data: PortalReportData;
  viewer: { displayName: string; email: string; role: string };
}) {
  const totalMovement =
    data.totals.studentMobility +
    data.totals.staffMobility +
    data.totals.travel;
  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title="รายงาน"
      activePath="/reports"
      searchPlaceholder="ค้นหาข้อมูล"
    >
      <main className="module-main">
        <div className="module-page-heading">
          <div>
            <p className="module-eyebrow">รายงานและการส่งออก</p>
            <h1>รายงานภาพรวม iROUP Portal</h1>
            <p>
              สรุปจากข้อมูลจริงใน Supabase ณ{" "}
              {new Intl.DateTimeFormat("th-TH", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(data.generatedAt))}
            </p>
          </div>
        </div>

        <div className="module-stat-strip">
          <div>
            <span className="module-stat-icon">
              <FileText />
            </span>
            <span>
              <strong>{data.totals.mou}</strong>
              <small>MOU ทั้งหมด</small>
            </span>
          </div>
          <div>
            <span className="module-stat-icon">
              <Globe2 />
            </span>
            <span>
              <strong>{totalMovement}</strong>
              <small>Mobility และการเดินทาง</small>
            </span>
          </div>
          <div>
            <span className="module-stat-icon">
              <UsersRound />
            </span>
            <span>
              <strong>{data.totals.contacts}</strong>
              <small>ผู้ติดต่อภายใน</small>
            </span>
          </div>
        </div>

        <section className="module-list-card">
          <div className="module-list-toolbar">
            <div>
              <h2>ข้อมูลตามโมดูล</h2>
              <p>จำนวนรายการที่ยังไม่ถูกลบในแต่ละโมดูล</p>
            </div>
          </div>
          <div className="mou-detail-grid">
            <div><small>Mobility นิสิต</small><strong>{data.totals.studentMobility}</strong></div>
            <div><small>Mobility บุคลากร</small><strong>{data.totals.staffMobility}</strong></div>
            <div><small>เดินทางไปปฏิบัติงาน</small><strong>{data.totals.travel}</strong></div>
            <div><small>ทุนการศึกษา</small><strong>{data.totals.scholarships}</strong></div>
            <div><small>กิจกรรม</small><strong>{data.totals.events}</strong></div>
            <div><small>ข่าวประชาสัมพันธ์</small><strong>{data.totals.news}</strong></div>
            <div><small>คลังความรู้</small><strong>{data.totals.knowledge}</strong></div>
          </div>
        </section>

        <div className="dashboard-grid-two">
          <section className="module-list-card">
            <div className="module-list-toolbar">
              <div>
                <h2><Globe2 /> ประเทศปลายทางสูงสุด</h2>
                <p>รวม Mobility และการเดินทางทุกประเภท</p>
              </div>
            </div>
            <div className="mou-list">
              {data.movementByCountry.map((item) => (
                <article className="mou-row" key={item.country}>
                  <div className="mou-row-main"><strong>{item.country}</strong></div>
                  <Badge variant="outline">{item.count} รายการ</Badge>
                </article>
              ))}
            </div>
          </section>
          <section className="module-list-card">
            <div className="module-list-toolbar">
              <div>
                <h2><BarChart3 /> สถานะ workflow</h2>
                <p>สถานะรายการ Mobility และการเดินทาง</p>
              </div>
            </div>
            <div className="mou-list">
              {data.workflow.map((item) => (
                <article className="mou-row" key={item.status}>
                  <div className="mou-row-main"><strong>{workflowLabel[item.status] || item.status}</strong></div>
                  <Badge variant="outline">{item.count} รายการ</Badge>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="module-list-card">
          <div className="module-list-toolbar">
            <div>
              <h2><Download /> ส่งออกข้อมูล</h2>
              <p>ใช้ปุ่ม CSV / Excel ในหน้ารายการ MOU และตัวกรองของแต่ละโมดูล</p>
            </div>
          </div>
          <p className="p-5 text-sm text-muted-foreground">
            รายงานนี้ไม่เปิดเผยข้อมูลส่วนบุคคลของผู้เข้าร่วมหรือผู้ติดต่อ
          </p>
        </section>
      </main>
    </WorkspaceChrome>
  );
}
