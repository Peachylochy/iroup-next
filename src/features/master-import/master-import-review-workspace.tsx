"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CircleAlert, FileSpreadsheet, Loader2, SkipForward } from "lucide-react";
import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CurrentUserAccess } from "@/lib/auth/access";

type ReviewRow = {
  id: string; row_number: number; status: "valid" | "warning" | "invalid" | "duplicate";
  master_entity: string; source_key: string; change_action: string;
  review_status: "pending" | "approved" | "skipped" | "needs_fix";
  review_note: string | null; source_data: Record<string, string>;
  normalized_data: Record<string, unknown> | null; validation_messages: string[];
};
type Batch = {
  id: string; source_file_name: string; status: string; total_rows: number;
  valid_rows: number; warning_rows: number; invalid_rows: number; committed_at: string | null; created_at: string;
};
type Response = { batch: Batch; rows: ReviewRow[]; total: number; page: number; pageSize: number; filter: string; error?: string };

const filters = [
  { key: "issues", label: "ต้องแก้" },
  { key: "warning", label: "จะอัปเดต" },
  { key: "approved", label: "ประวัติอนุมัติ" },
  { key: "skipped", label: "ประวัติข้าม" },
  { key: "all", label: "ทั้งหมด" },
];

function getNames(row: ReviewRow) {
  const data = row.normalized_data || {};
  return {
    nameTh: String(data.name_th || data.full_name_th || ""),
    nameEn: String(data.name_en || data.full_name_en || ""),
  };
}

function rowDisplayName(row: ReviewRow) {
  return row.source_data.full_name_th || row.source_data.org_name_en || row.source_data.country_name_th || row.source_data.unit_name_th || "ไม่มีชื่อในแถวต้นทาง";
}

function InvalidRowCard({ batchId, row, onSaved }: { batchId: string; row: ReviewRow; onSaved: () => void }) {
  const names = getNames(row);
  const [nameTh, setNameTh] = useState(names.nameTh);
  const [nameEn, setNameEn] = useState(names.nameEn);
  const [note, setNote] = useState(row.review_note || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  async function save(decision: "approved" | "skipped" | "needs_fix") {
    setSaving(true); setMessage(undefined);
    const response = await fetch(`/api/settings/master-import/${batchId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowId: row.id, decision, nameTh, nameEn, reviewNote: note }),
    });
    const body = await response.json() as { error?: string; message?: string };
    setSaving(false);
    if (!response.ok) return setMessage(body.error || "บันทึกไม่สำเร็จ");
    setMessage(body.message || "บันทึกแล้ว"); onSaved();
  }

  return <article className="border-b p-5 last:border-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><span className="mou-row-icon"><FileSpreadsheet /></span><strong>{row.source_key}</strong><Badge className="bg-destructive">แก้ไขก่อน</Badge></div>
        <p className="mt-2 text-sm text-muted-foreground">แถว staging {row.row_number} · {rowDisplayName(row)}</p>
      </div>
      <Badge variant="outline">{row.review_status === "needs_fix" ? "ยังต้องแก้" : "รอตรวจ"}</Badge>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">ชื่อภาษาไทย<Input className="mt-1" value={nameTh} onChange={(event) => setNameTh(event.target.value)} /></label>
      <label className="text-sm font-medium">ชื่อภาษาอังกฤษ<Input className="mt-1" value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></label>
    </div>
    <label className="mt-3 block text-sm font-medium">บันทึกการตรวจทาน<Textarea className="mt-1" value={note} onChange={(event) => setNote(event.target.value)} /></label>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={saving} onClick={() => void save("approved")}>{saving ? <Loader2 className="animate-spin" /> : <Check />}ยืนยันว่าแก้ไขแล้ว</Button>
      <Button size="sm" variant="outline" disabled={saving} onClick={() => void save("needs_fix")}><CircleAlert />ยังต้องแก้</Button>
      <Button size="sm" variant="outline" disabled={saving} onClick={() => void save("skipped")}><SkipForward />ไม่นำเข้าแถวนี้</Button>
      {message ? <span className="text-sm text-primary">{message}</span> : null}
    </div>
  </article>;
}

function ReadonlyRow({ row }: { row: ReviewRow }) {
  const tone = row.status === "warning" ? "bg-amber-600" : row.status === "invalid" ? "bg-destructive" : "bg-emerald-600";
  const label = row.status === "warning" ? "จะอัปเดต" : row.status === "invalid" ? "ต้องแก้" : "ผ่านตรวจ";
  return <article className="flex flex-wrap items-center justify-between gap-3 border-b p-5 last:border-0">
    <div><div className="flex items-center gap-2"><span className="mou-row-icon"><FileSpreadsheet /></span><strong>{row.source_key}</strong><Badge className={tone}>{label}</Badge></div><p className="mt-2 text-sm text-muted-foreground">แถว staging {row.row_number} · {rowDisplayName(row)}</p></div>
    <p className="text-sm text-muted-foreground">{row.status === "warning" ? "พบรหัสเดิม จึงจะอัปเดตอัตโนมัติ" : row.review_status === "skipped" ? "ข้ามแล้ว" : "พร้อมนำเข้า"}</p>
  </article>;
}

export function MasterImportReviewWorkspace({ batchId, access, viewer }: { batchId: string; access: CurrentUserAccess; viewer: { displayName: string; email: string; role: string } }) {
  const [filter, setFilter] = useState("issues");
  const [data, setData] = useState<Response>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [confirmation, setConfirmation] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string>();

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const response = await fetch(`/api/settings/master-import/${batchId}?filter=${filter}&page=${page}`);
    const body = await response.json() as Response;
    setLoading(false);
    if (!response.ok) return setError(body.error || "อ่าน staging ไม่สำเร็จ");
    setError(undefined); setData(body);
  }, [batchId, filter]);

  useEffect(() => { void load(); }, [load]);

  async function commitMaster() {
    setCommitting(true); setCommitMessage(undefined);
    const response = await fetch(`/api/settings/master-import/${batchId}/commit`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }),
    });
    const body = await response.json() as { error?: string; result?: { total_rows: number } };
    setCommitting(false);
    if (!response.ok) return setCommitMessage(body.error || "นำเข้า master ไม่สำเร็จ");
    setCommitMessage(`นำเข้า master สำเร็จ ${body.result?.total_rows.toLocaleString() || ""} แถว`);
    setConfirmation(""); void load();
  }

  return <WorkspaceChrome access={access} viewer={viewer} title="ตรวจทาน Master Import" activePath="/settings/master-import">
    <main className="module-main">
      <Link className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary" href="/settings/master-import"><ArrowLeft size={16} />กลับไปนำเข้า master</Link>
      <div className="module-page-heading"><div><p className="text-xs font-semibold text-primary">ตั้งค่าระบบ · staging batch</p><h1>ตรวจทาน Master Import</h1><p>ตรวจเฉพาะแถวที่ผิดรูปแบบ ส่วนรหัสเดิมจะอัปเดตอัตโนมัติเมื่อยืนยันนำเข้าทั้งชุด</p></div></div>
      {error ? <p className="mt-6 text-destructive">{error}</p> : null}
      {data ? <>
        <section className="mt-6 grid gap-px border bg-border md:grid-cols-4">
          <div className="bg-background p-4"><p className="text-sm text-muted-foreground">ชื่อไฟล์</p><strong className="mt-1 block break-all">{data.batch.source_file_name}</strong></div>
          <div className="bg-background p-4"><strong className="text-2xl text-primary">{data.batch.total_rows.toLocaleString()}</strong><p className="text-sm text-muted-foreground">แถวทั้งหมด</p></div>
          <div className="bg-background p-4"><strong className="text-2xl text-amber-600">{data.batch.warning_rows}</strong><p className="text-sm text-muted-foreground">จะอัปเดตจากรหัสเดิม</p></div>
          <div className="bg-background p-4"><strong className="text-2xl text-destructive">{data.batch.invalid_rows}</strong><p className="text-sm text-muted-foreground">ต้องแก้ก่อนนำเข้า</p></div>
        </section>
        <section className="mt-6 border border-primary/25 bg-primary/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="font-semibold">{data.batch.status === "completed" ? "นำเข้า Master แล้ว" : "นำเข้า Master ทั้งชุด"}</h2><p className="mt-1 text-sm text-muted-foreground">{data.batch.status === "completed" ? `บันทึกเมื่อ ${data.batch.committed_at ? new Date(data.batch.committed_at).toLocaleString("th-TH") : ""}` : "ใช้ transaction เดียว หากพบข้อผิดพลาด ข้อมูลจะไม่ถูกบันทึกค้างครึ่งทาง"}</p></div>
            {data.batch.status !== "completed" ? <div className="flex flex-wrap items-center gap-2"><Input aria-label="ยืนยันการนำเข้า master" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="พิมพ์ IMPORT MASTER" className="w-52 bg-background" /><Button disabled={data.batch.invalid_rows > 0 || confirmation !== "IMPORT MASTER" || committing} onClick={() => void commitMaster()}>{committing ? <Loader2 className="animate-spin" /> : <Check />}นำเข้า master</Button></div> : <Badge className="bg-emerald-600">เสร็จสิ้น</Badge>}
          </div>
          {commitMessage ? <p className="mt-3 text-sm text-primary">{commitMessage}</p> : null}
        </section>
        <section className="module-list-card mt-6">
          <div className="module-list-toolbar"><div><h2>รายการใน staging</h2><p>ถ้า “ต้องแก้” เป็น 0 ชุดข้อมูลพร้อมสำหรับขั้นนำเข้า master ทั้งชุด</p></div><Badge variant="outline">{data.total.toLocaleString()} รายการ</Badge></div>
          <div className="flex flex-wrap gap-2 border-b p-4">{filters.map((item) => <Button key={item.key} variant={filter === item.key ? "default" : "ghost"} size="sm" onClick={() => setFilter(item.key)}>{item.label}</Button>)}</div>
          {loading ? <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="animate-spin" />กำลังอ่าน staging…</div> : data.rows.length ? data.rows.map((row) => row.status === "invalid" && filter !== "all" ? <InvalidRowCard batchId={batchId} key={row.id} row={row} onSaved={() => void load(data.page)} /> : <ReadonlyRow key={row.id} row={row} />) : <p className="p-8 text-muted-foreground">ไม่มีแถวที่ต้องแก้ ชุดข้อมูลนี้พร้อมสำหรับขั้นนำเข้า master</p>}
          <div className="flex items-center justify-between border-t p-4"><span className="text-sm text-muted-foreground">หน้า {data.page} จาก {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={data.page <= 1 || loading} onClick={() => void load(data.page - 1)}><ChevronLeft />ก่อนหน้า</Button><Button variant="outline" size="sm" disabled={data.page >= Math.ceil(data.total / data.pageSize) || loading} onClick={() => void load(data.page + 1)}>ถัดไป<ChevronRight /></Button></div></div>
        </section>
      </> : <div className="mt-10 flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" />กำลังเตรียมข้อมูล…</div>}
    </main>
  </WorkspaceChrome>;
}
