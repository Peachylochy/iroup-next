"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileSpreadsheet, Loader2, SkipForward, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NormalizedMobility = {
  legacyId: string;
  projectName: string;
  partnerNameSnapshot: string | null;
  countryNameSnapshot: string | null;
  startDate: string | null;
  endDate: string | null;
  internalImportNote?: string | null;
  participants: Array<{ fullNameSnapshot: string; sourceIdentifier: string }>;
};
type ReviewRow = {
  id: string;
  row_number: number;
  status: "valid" | "warning" | "invalid" | "imported";
  source_key: string;
  change_action: "insert" | "update" | "skip";
  review_status: "pending" | "approved" | "skipped" | "needs_fix";
  review_note: string | null;
  normalized_data: NormalizedMobility;
  validation_messages: string[];
  target_record_id: string | null;
};
type ReviewResponse = {
  batch: {
    id: string;
    source_file_name: string;
    status: string;
    total_rows: number;
    valid_rows: number;
    warning_rows: number;
    invalid_rows: number;
    committed_at: string | null;
  };
  rows: ReviewRow[];
  error?: string;
};

export function MobilityImportReviewWorkspace({ batchId }: { batchId: string }) {
  const [data, setData] = useState<ReviewResponse>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "skipped" | "all">("pending");

  const load = useCallback(async () => {
    const response = await fetch(`/api/mobility/import/${batchId}`);
    const payload = await response.json() as ReviewResponse;
    if (!response.ok) {
      setError(payload.error || "อ่าน staging ไม่สำเร็จ");
      return;
    }
    setError(undefined);
    setData(payload);
  }, [batchId]);

  useEffect(() => {
    // Fetch and synchronize the staging review after the batch changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data synchronization
    void load();
  }, [load]);

  const rows = useMemo(() => data?.rows.filter((row) => filter === "all" || row.review_status === filter) ?? [], [data, filter]);
  const pending = data?.rows.filter((row) => row.review_status === "pending" || row.review_status === "needs_fix").length ?? 0;

  async function review(payload: { rowId?: string; all?: boolean; decision: "approved" | "skipped" }) {
    setSaving(true);
    const response = await fetch(`/api/mobility/import/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(body.error || "บันทึกผลตรวจไม่สำเร็จ");
      return;
    }
    await load();
  }

  async function commit() {
    setSaving(true);
    const response = await fetch(`/api/mobility/import/${batchId}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const body = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(body.error || "นำเข้าข้อมูลไม่สำเร็จ");
      return;
    }
    setConfirmation("");
    await load();
  }

  return (
    <main className="module-main">
      <Link className="back-link" href="/mobility/import"><ArrowLeft />กลับไปตรวจไฟล์ Mobility</Link>
      <div className="module-page-heading">
        <div><p className="module-eyebrow">Mobility นิสิต · staging</p><h1>ตรวจทานก่อนนำเข้าข้อมูลจริง</h1><p>ขั้นนี้อ่านเฉพาะ staging; movement และผู้เข้าร่วมจะยังไม่เปลี่ยนจนกดยืนยันนำเข้า</p></div>
      </div>
      {error ? <p className="mou-form-message is-error">{error}</p> : null}
      {!data ? <div className="mt-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" />กำลังอ่าน staging...</div> : (
        <>
          <section className="module-stat-strip mt-6">
            <div><span className="module-stat-icon"><FileSpreadsheet /></span><span><strong>{data.batch.total_rows}</strong><small>โครงการทั้งหมด</small></span></div>
            <div><span><strong>{pending}</strong><small>ยังไม่ตรวจ</small></span></div>
            <div><span><strong>{data.rows.reduce((sum, row) => sum + row.normalized_data.participants.length, 0)}</strong><small>นิสิตในชุดนี้</small></span></div>
            <div><span><strong>{data.batch.status === "completed" ? "เสร็จ" : "Staging"}</strong><small>สถานะชุดข้อมูล</small></span></div>
          </section>

          <section className="mt-6 border border-primary/25 bg-primary/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h2 className="font-semibold">{data.batch.status === "completed" ? "นำเข้าข้อมูลแล้ว" : "ยืนยันการนำเข้าทั้งชุด"}</h2><p className="text-sm text-muted-foreground">ใช้ transaction เดียวและอัปเดตรายการเดิมด้วย legacy ID โดยไม่สร้างข้อมูลซ้ำ</p></div>
              {data.batch.status !== "completed" ? <div className="flex flex-wrap items-center gap-2"><Input className="w-56 bg-background" onChange={(event) => setConfirmation(event.target.value)} placeholder="พิมพ์ IMPORT MOBILITY" value={confirmation} /><Button disabled={pending > 0 || confirmation !== "IMPORT MOBILITY" || saving} onClick={() => void commit()}>{saving ? <Loader2 className="animate-spin" /> : <Check />}นำเข้าข้อมูลจริง</Button></div> : <Badge className="bg-emerald-600">นำเข้าแล้ว</Badge>}
            </div>
          </section>

          <section className="module-list-card mt-6">
            <div className="module-list-toolbar"><div><h2>{data.batch.source_file_name}</h2><p>ตรวจชื่อโครงการ ประเทศ องค์กร ช่วงเวลา และจำนวนผู้เข้าร่วม</p></div>{data.batch.status !== "completed" ? <Button disabled={saving || pending === 0} onClick={() => void review({ all: true, decision: "approved" })}><Check />อนุมัติรายการที่ผ่านทั้งหมด</Button> : null}</div>
            <div className="module-filter-row">
              {(["pending", "approved", "skipped", "all"] as const).map((value) => <Button key={value} onClick={() => setFilter(value)} size="sm" variant={filter === value ? "default" : "ghost"}>{value === "pending" ? `รอตรวจ (${pending})` : value === "approved" ? "อนุมัติแล้ว" : value === "skipped" ? "ข้าม" : "ทั้งหมด"}</Button>)}
            </div>
            <div className="mou-list">
              {rows.map((row) => <article className="mobility-import-row" key={row.id}>
                <header className="mobility-import-row-header">
                  <span className="mou-row-icon"><UsersRound /></span>
                  <div className="mobility-import-summary">
                    <strong>{row.normalized_data.projectName}</strong>
                    <p>{[row.normalized_data.partnerNameSnapshot, row.normalized_data.countryNameSnapshot].filter(Boolean).join(" · ") || "ยังไม่ระบุปลายทาง"}</p>
                    <small>{row.normalized_data.startDate || "ไม่ระบุวันเริ่ม"}{row.normalized_data.endDate ? ` – ${row.normalized_data.endDate}` : ""} · นิสิต {row.normalized_data.participants.length} คน · {row.change_action === "update" ? "อัปเดตรายการเดิม" : "เพิ่มรายการใหม่"}</small>
                  </div>
                  <Badge className={row.review_status === "approved" ? "bg-emerald-600" : row.review_status === "skipped" ? "bg-muted text-foreground" : "bg-amber-600"}>{row.review_status === "approved" ? "อนุมัติแล้ว" : row.review_status === "skipped" ? "ข้าม" : "รอตรวจ"}</Badge>
                </header>
                {row.validation_messages.length ? <p className="mobility-import-issues">{row.validation_messages.join(" · ")}</p> : null}
                {row.normalized_data.internalImportNote ? <p className="mobility-import-follow-up">{row.normalized_data.internalImportNote}</p> : null}
                {data.batch.status !== "completed" && row.review_status !== "approved" ? <div className="mt-3 flex gap-2"><Button disabled={saving} onClick={() => void review({ rowId: row.id, decision: "approved" })} size="sm"><Check />อนุมัติ</Button><Button disabled={saving} onClick={() => void review({ rowId: row.id, decision: "skipped" })} size="sm" variant="outline"><SkipForward />ไม่นำเข้า</Button></div> : null}
              </article>)}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
