"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Filter, GraduationCap, MapPin, Plus, UsersRound } from "lucide-react";
import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";
import type { StudentMobility, WorkflowStatus } from "./mobility-query";

type Props = { access: CurrentUserAccess; items: StudentMobility[]; viewer: { displayName: string; email: string; role: string } };
const statuses: Array<["all" | WorkflowStatus, string]> = [["all", "ทั้งหมด"], ["draft", "ร่าง"], ["under_review", "รอตรวจสอบ"], ["approved", "อนุมัติแล้ว"], ["active", "กำลังดำเนินการ"], ["completed", "เสร็จสิ้น"]];
const statusLabel: Record<WorkflowStatus, string> = { draft: "ร่าง", under_review: "รอตรวจสอบ", approved: "อนุมัติแล้ว", active: "กำลังดำเนินการ", completed: "เสร็จสิ้น", cancelled: "ยกเลิก", archived: "เก็บถาวร" };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "ยังไม่ระบุ";

export function MobilityWorkspace({ access, items, viewer }: Props) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState<"all" | WorkflowStatus>("all"); const [direction, setDirection] = useState("all"); const [page, setPage] = useState(1);
  const filtered = useMemo(() => items.filter((item) => {
    const text = [item.project_name, item.title_en, item.partner_name_snapshot, item.country_name_snapshot, item.city, item.organization_units?.name_th].filter(Boolean).join(" ").toLocaleLowerCase("th");
    return (!query.trim() || text.includes(query.trim().toLocaleLowerCase("th"))) && (status === "all" || item.workflow_status === status) && (direction === "all" || item.direction === direction);
  }), [direction, items, query, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 10)); const current = Math.min(page, pages); const shown = filtered.slice((current - 1) * 10, current * 10);
  return <WorkspaceChrome access={access} viewer={viewer} title="การเดินทางและ Mobility" activePath="/mobility" query={query} onQueryChange={setQuery} searchPlaceholder="ค้นหาชื่อโครงการ องค์กร ประเทศ หรือหน่วยงาน">
    <main className="module-main"><div className="module-page-heading"><div><p className="module-eyebrow">การเดินทางและ Mobility</p><h1>Mobility นิสิต</h1><p>จัดการโครงการแลกเปลี่ยน ตั้งแต่ร่าง ส่งตรวจ ติดตามการเดินทาง และสรุปผู้เข้าร่วม</p></div>{access.modules.mobility?.create ? <Link className={cn(buttonVariants({ size: "lg" }))} href="/mobility/new"><Plus data-icon="inline-start" /> เพิ่ม Mobility</Link> : null}</div>
      <div className="module-stat-strip"><div><span className="module-stat-icon"><GraduationCap /></span><span><strong>{items.length}</strong><small>โครงการทั้งหมด</small></span></div><div><span><strong>{items.filter((item) => item.workflow_status === "active").length}</strong><small>กำลังดำเนินการ</small></span></div><div><span><strong>{items.filter((item) => item.workflow_status === "under_review").length}</strong><small>รอตรวจสอบ</small></span></div></div>
      <section className="module-list-card"><div className="module-list-toolbar"><div><h2>รายการ Mobility นิสิต</h2><p>ข้อมูลภายในจาก Supabase · ไม่แสดงข้อมูลผู้เข้าร่วมใน Public Portal</p></div></div>
        <div className="module-filter-row"><Filter />{statuses.map(([value, label]) => <button className={cn("filter-pill", status === value && "is-selected")} key={value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div>
        <div className="mou-advanced-filters"><label>ทิศทาง<select value={direction} onChange={(event) => { setDirection(event.target.value); setPage(1); }}><option value="all">ทุกทิศทาง</option><option value="outbound">Outbound</option><option value="inbound">Inbound</option><option value="bilateral">Bilateral</option></select></label><Button type="button" variant="ghost" size="sm" onClick={() => { setQuery(""); setStatus("all"); setDirection("all"); }}>ล้างตัวกรอง</Button></div>
        <div className="mou-list-summary"><span>พบ {filtered.length} รายการ</span></div>
        {shown.length ? <><div className="mou-list">{shown.map((item) => <article className="mou-row" key={item.id}><span className="mou-row-icon"><GraduationCap /></span><div className="mou-row-main"><div className="mou-row-title"><strong>{item.project_name}</strong><small>{item.partner_name_snapshot || "ยังไม่ระบุองค์กร"}</small></div><p><MapPin /> {item.country_name_snapshot || "ยังไม่ระบุประเทศ"}{item.city ? ` · ${item.city}` : ""} · <UsersRound /> {item.participant_count} คน</p></div><div className="mou-row-period"><small>วันเดินทาง</small><strong>{date(item.start_date)} – {date(item.end_date)}</strong></div><Badge className={cn("mou-status", `mou-status-${item.workflow_status}`)}>{statusLabel[item.workflow_status]}</Badge><Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/mobility/${item.id}`}>ดูรายละเอียด</Link></article>)}</div><div className="mou-pagination"><span>หน้า {current} จาก {pages}</span><span><Button variant="outline" size="sm" disabled={current === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft /> ก่อนหน้า</Button><Button variant="outline" size="sm" disabled={current === pages} onClick={() => setPage((value) => value + 1)}>ถัดไป <ArrowRight /></Button></span></div></> : <div className="module-empty-state"><span><GraduationCap /></span><h3>{items.length ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มี Mobility นิสิต"}</h3><p>{items.length ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เริ่มบันทึกโครงการแรก แล้วระบบจะติดตาม workflow ให้"}</p>{access.modules.mobility?.create ? <Link className="panel-link" href="/mobility/new">เพิ่ม Mobility นิสิต</Link> : null}</div>}
      </section></main>
  </WorkspaceChrome>;
}
