"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Loader2, Upload, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentMobilityImportPreview } from "./student-mobility-import-preview";

const label = { ready: "พร้อมตรวจ", warning: "ต้องตรวจ", error: "แก้ไขก่อน" } as const;

export function MobilityImportPreviewWorkspace() {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<StudentMobilityImportPreview>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  async function buildPreview() {
    if (!file) { setError("เลือกไฟล์ .xlsx ก่อนสร้าง preview"); return; }
    setError(undefined); setLoading(true); setPreview(undefined);
    const body = new FormData(); body.set("file", file);
    const response = await fetch("/api/mobility/import-preview", { method: "POST", body });
    const data = await response.json() as StudentMobilityImportPreview & { error?: string };
    setLoading(false);
    if (!response.ok) { setError(data.error || "สร้าง preview ไม่สำเร็จ"); return; }
    setPreview(data);
  }
  return <main className="module-main"><div className="module-page-heading"><div><Link className="back-link" href="/mobility"><ArrowLeft />กลับไปรายการ Mobility</Link><h1>ตรวจข้อมูลนำเข้า Mobility นิสิต</h1><p>อ่านไฟล์และตรวจ mapping เท่านั้น — ยังไม่มีการเขียนข้อมูลจริงลง Supabase</p></div></div>
    <section className="module-list-card p-6 space-y-5"><div className="flex items-start gap-3"><span className="mou-row-icon"><FileSpreadsheet /></span><div><h2 className="text-lg font-semibold">เลือกไฟล์ฐานข้อมูลเดิม</h2><p className="text-sm text-muted-foreground">รองรับไฟล์ Excel ที่มีชีต MOBILITY_PROJECT, MOBILITY_PARTICIPANT, COUNTRY_MASTER และ UP_UNIT_MASTER</p></div></div>
      <div className="flex flex-wrap gap-3 items-center"><input aria-label="ไฟล์ Excel สำหรับตรวจข้อมูล" type="file" accept=".xlsx" onChange={(event) => setFile(event.target.files?.[0])} /><Button type="button" disabled={loading} onClick={buildPreview}>{loading ? <Loader2 className="animate-spin" /> : <Upload />}{loading ? "กำลังตรวจข้อมูล..." : "สร้าง preview"}</Button></div>
      {file ? <p className="text-sm text-muted-foreground">ไฟล์ที่เลือก: {file.name} ({Math.ceil(file.size / 1024 / 1024)} MB)</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
    {preview ? <section className="space-y-6 mt-6"><div className="module-stat-strip"><div><span className="module-stat-icon"><FileSpreadsheet /></span><span><strong>{preview.totalProjects}</strong><small>โครงการจากไฟล์</small></span></div><div><span><strong>{preview.studentParticipants}</strong><small>ผู้เข้าร่วมนิสิต</small></span></div><div><span><strong>{preview.excludedStaffParticipants}</strong><small>บุคลากรที่แยกออก</small></span></div><div><span><strong>{preview.errorProjects}</strong><small>ต้องแก้ก่อนนำเข้า</small></span></div></div>
      <section className="module-list-card"><div className="module-list-toolbar"><div><h2>ผลการตรวจ: {preview.sourceFile}</h2><p>พร้อมตรวจ {preview.readyProjects} · ต้องตรวจ {preview.warningProjects} · แก้ไขก่อน {preview.errorProjects}</p></div><Badge variant="outline">ยังไม่ commit</Badge></div><div className="mou-list">{preview.rows.map((row) => <article className="mou-row" key={row.legacyProjectId}><span className="mou-row-icon"><UsersRound /></span><div className="mou-row-main"><div className="mou-row-title"><strong>{row.projectName || "ไม่มีชื่อโครงการ"}</strong><small>{row.legacyProjectId} · {row.institutionName || "ไม่ระบุองค์กร"}</small></div><p>{row.startDate || "ไม่ระบุวันเริ่ม"}{row.endDate ? ` – ${row.endDate}` : ""} · นิสิต {row.studentParticipants} คน</p>{row.messages.length ? <p className="text-xs text-muted-foreground mt-1">{row.messages.join(" · ")}</p> : null}</div><Badge className={row.result === "error" ? "bg-destructive" : row.result === "warning" ? "bg-amber-600" : "bg-emerald-600"}>{label[row.result]}</Badge></article>)}</div></section>
      <p className="text-sm text-muted-foreground">ขั้นต่อไปคือเลือกเฉพาะรายการที่ผ่านการตรวจ แล้วจึงสร้าง staging batch สำหรับ review และอนุมัติ commit แยกอีกครั้ง</p>
    </section> : null}
  </main>;
}
