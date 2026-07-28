"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, FileSpreadsheet, Loader2, Plus, School, Upload, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import type { StudentMobilityImportPreview, StudentMobilityImportRow } from "./student-mobility-import-preview";

type Result = "ready" | "warning" | "error";
type Filter = "attention" | "all" | "warning" | "error" | "resolved";
type Mapping = { countryId?: string; unitId?: string; partnerId?: string; partnerUnknown?: boolean; partnerFollowUp?: string };
type MappingDialog = { kind: "partner" | "unit"; row: StudentMobilityImportRow } | null;

const labels: Record<Result, string> = { ready: "พร้อมตรวจ", warning: "ต้องตรวจ", error: "แก้ไขก่อน" };
const mappingMessages = {
  country: "ยังจับคู่ประเทศกับฐานใหม่ไม่ได้",
  unit: "ยังจับคู่หน่วยงาน ม.พะเยากับฐานใหม่ไม่ได้",
  partner: "ยังไม่พบองค์กรคู่ความร่วมมือในฐานใหม่",
} as const;

function rowResult(row: StudentMobilityImportRow, mapping: Mapping): Result {
  if ((row.needsCountryMapping && !mapping.countryId) || (row.needsUnitMapping && !mapping.unitId)) return "error";
  if (row.needsPartnerMapping && !mapping.partnerId) return "warning";
  return row.messages.some((message) => !Object.values(mappingMessages).includes(message as never)) ? "warning" : "ready";
}

function remainingMessages(row: StudentMobilityImportRow, mapping: Mapping) {
  return row.messages.filter((message) =>
    !((message === mappingMessages.country && mapping.countryId) ||
      (message === mappingMessages.unit && mapping.unitId) ||
      (message === mappingMessages.partner && (mapping.partnerId || mapping.partnerUnknown))),
  );
}

function OptionLabel({ children }: { children: string }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

type MappingEditorDialogProps = {
  dialog: MappingDialog;
  countries: StudentMobilityImportPreview["referenceOptions"]["countries"];
  onClose: () => void;
  onCreated: (kind: "partner" | "unit", option: { id: string; nameTh: string | null; nameEn: string | null; code?: string | null }) => void;
};

function MappingEditor({ dialog, countries, onClose, onCreated }: MappingEditorDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  if (!dialog) return null;
  const activeDialog = dialog;
  const isPartner = activeDialog.kind === "partner";
  const defaultName = isPartner ? activeDialog.row.institutionName : activeDialog.row.sourceUnit?.name || "";
  const defaultCode = activeDialog.row.sourceUnit?.code || "";

  async function create(formData: FormData) {
    setSaving(true); setError(undefined);
    const payload = isPartner
      ? { kind: "partner", nameTh: String(formData.get("nameTh") || ""), nameEn: String(formData.get("nameEn") || ""), countryId: String(formData.get("countryId") || "") || null }
      : { kind: "unit", code: String(formData.get("code") || ""), nameTh: String(formData.get("nameTh") || ""), nameEn: String(formData.get("nameEn") || "") };
    const response = await fetch("/api/mobility/import-mapping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json() as { id?: string; nameTh?: string | null; nameEn?: string | null; code?: string | null; error?: string };
    setSaving(false);
    if (!response.ok || !data.id) { setError(data.error || "สร้างข้อมูลอ้างอิงไม่สำเร็จ"); return; }
    onCreated(activeDialog.kind, { id: data.id, nameTh: data.nameTh || null, nameEn: data.nameEn || null, code: data.code });
  }

  return <section className="mobility-import-create"><div className="mb-3"><h3>{isPartner ? "เพิ่มองค์กรคู่ความร่วมมือ" : "เพิ่มหน่วยงาน ม.พะเยา"}</h3><p>{isPartner ? "องค์กรใหม่จะอยู่สถานะรอตรวจสอบ และถูกเลือกให้รายการนี้ทันที" : "ใช้เมื่อยืนยันแล้วว่าไม่มีหน่วยงานนี้ในรายการอ้างอิง"}</p></div><form action={create} className="mobility-import-create-form"><label>ชื่อภาษาไทย<Input name="nameTh" defaultValue={isPartner ? "" : defaultName} required={!isPartner} /></label><label>ชื่อภาษาอังกฤษ<Input name="nameEn" defaultValue={isPartner ? defaultName : ""} /></label>{isPartner ? <label className="is-wide">ประเทศ<select name="countryId" defaultValue=""><option value="">ยังไม่ระบุ</option>{countries.map((country) => <option key={country.id} value={country.id}>{country.name_th} ({country.name_en})</option>)}</select></label> : <label className="is-wide">รหัสหน่วยงาน (ถ้ามี)<Input name="code" defaultValue={defaultCode} /></label>}{error ? <p className="is-wide text-sm text-destructive">{error}</p> : null}<div className="mobility-import-create-actions is-wide"><Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus />}{saving ? "กำลังบันทึก" : "สร้างและเลือก"}</Button></div></form></section>;
}

function Input({ name, defaultValue, required }: { name: string; defaultValue?: string; required?: boolean }) {
  return <input className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" name={name} defaultValue={defaultValue} required={required} />;
}

export function MobilityImportPreviewWorkspace({ access }: { access: CurrentUserAccess }) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<StudentMobilityImportPreview>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("attention");
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [dialog, setDialog] = useState<MappingDialog>(null);
  const [extraPartners, setExtraPartners] = useState<Array<{ id: string; name_th: string | null; name_en: string | null }>>([]);
  const [extraUnits, setExtraUnits] = useState<Array<{ id: string; code: string | null; name_th: string; name_en: string | null }>>([]);

  async function buildPreview() {
    if (!file) { setError("เลือกไฟล์ .xlsx ก่อนสร้าง preview"); return; }
    setError(undefined); setLoading(true); setPreview(undefined); setMappings({}); setExtraPartners([]); setExtraUnits([]); setFilter("attention");
    const body = new FormData(); body.set("file", file);
    const response = await fetch("/api/mobility/import-preview", { method: "POST", body });
    const data = await response.json() as StudentMobilityImportPreview & { error?: string };
    setLoading(false);
    if (!response.ok) { setError(data.error || "สร้าง preview ไม่สำเร็จ"); return; }
    setPreview(data);
  }

  const derivedRows = useMemo(() => preview?.rows.map((row) => ({ row, mapping: mappings[row.legacyProjectId] || {}, result: rowResult(row, mappings[row.legacyProjectId] || {}) })) || [], [mappings, preview]);
  const shownRows = useMemo(() => derivedRows.filter(({ result }) => filter === "all" || (filter === "attention" && result !== "ready") || result === filter || (filter === "resolved" && result === "ready")), [derivedRows, filter]);
  const remainingErrors = derivedRows.filter(({ result }) => result === "error").length;
  const remainingWarnings = derivedRows.filter(({ result }) => result === "warning").length;
  const allPartners = preview ? [...preview.referenceOptions.partners, ...extraPartners] : [];
  const allUnits = preview ? [...preview.referenceOptions.units, ...extraUnits] : [];

  function setMapping(projectId: string, change: Mapping) { setMappings((current) => ({ ...current, [projectId]: { ...current[projectId], ...change } })); }

  function created(kind: "partner" | "unit", option: { id: string; nameTh: string | null; nameEn: string | null; code?: string | null }) {
    if (!dialog) return;
    if (kind === "partner") { setExtraPartners((current) => [...current, { id: option.id, name_th: option.nameTh, name_en: option.nameEn }]); setMapping(dialog.row.legacyProjectId, { partnerId: option.id }); }
    else { setExtraUnits((current) => [...current, { id: option.id, code: option.code || null, name_th: option.nameTh || "", name_en: option.nameEn }]); setMapping(dialog.row.legacyProjectId, { unitId: option.id }); }
    setDialog(null);
  }

  return <main className="module-main"><div className="module-page-heading"><div><Link className="back-link" href="/mobility"><ArrowLeft />กลับไปรายการ Mobility</Link><h1>ตรวจและแก้ Mapping ข้อมูล Mobility นิสิต</h1><p>เลือกข้อมูลอ้างอิงที่ถูกต้องก่อนสร้าง staging batch — การเลือกในหน้านี้ยังไม่เขียนข้อมูลโครงการหรือผู้เข้าร่วมลง Supabase</p></div></div>
    <section className="module-list-card p-6 space-y-5"><div className="flex items-start gap-3"><span className="mou-row-icon"><FileSpreadsheet /></span><div><h2 className="text-lg font-semibold">เลือกไฟล์ฐานข้อมูลเดิม</h2><p className="text-sm text-muted-foreground">รองรับ Excel ที่มีชีต MOBILITY_PROJECT, MOBILITY_PARTICIPANT, COUNTRY_MASTER และ UP_UNIT_MASTER</p></div></div><div className="flex flex-wrap gap-3 items-center"><input aria-label="ไฟล์ Excel สำหรับตรวจข้อมูล" type="file" accept=".xlsx" onChange={(event) => setFile(event.target.files?.[0])} /><Button type="button" disabled={loading} onClick={buildPreview}>{loading ? <Loader2 className="animate-spin" /> : <Upload />}{loading ? "กำลังตรวจข้อมูล..." : "สร้าง preview"}</Button></div>{file ? <p className="text-sm text-muted-foreground">ไฟล์ที่เลือก: {file.name} ({Math.ceil(file.size / 1024 / 1024)} MB)</p> : null}{error ? <p className="text-sm text-destructive">{error}</p> : null}</section>
    {preview ? <section className="space-y-6 mt-6"><div className="module-stat-strip"><div><span className="module-stat-icon"><FileSpreadsheet /></span><span><strong>{preview.totalProjects}</strong><small>โครงการจากไฟล์</small></span></div><div><span><strong>{preview.studentParticipants}</strong><small>ผู้เข้าร่วมนิสิต</small></span></div><div><span><strong>{remainingWarnings}</strong><small>ต้องตรวจ</small></span></div><div><span><strong>{remainingErrors}</strong><small>แก้ไขก่อน</small></span></div></div>
      <section className="module-list-card"><div className="module-list-toolbar"><div><h2>ตรวจ Mapping: {preview.sourceFile}</h2><p>เริ่มต้นด้วยรายการสีส้มและสีแดง เลือกข้อมูลที่มีอยู่หรือสร้าง master data ที่ขาดได้</p></div><Badge variant="outline">ยังไม่สร้าง staging</Badge></div><div className="module-filter-row"><Button type="button" variant={filter === "attention" ? "default" : "ghost"} size="sm" onClick={() => setFilter("attention")}>สีส้ม/แดง ({remainingWarnings + remainingErrors})</Button><Button type="button" variant={filter === "error" ? "default" : "ghost"} size="sm" onClick={() => setFilter("error")}>สีแดง ({remainingErrors})</Button><Button type="button" variant={filter === "warning" ? "default" : "ghost"} size="sm" onClick={() => setFilter("warning")}>สีส้ม ({remainingWarnings})</Button><Button type="button" variant={filter === "resolved" ? "default" : "ghost"} size="sm" onClick={() => setFilter("resolved")}>ครบแล้ว</Button><Button type="button" variant={filter === "all" ? "default" : "ghost"} size="sm" onClick={() => setFilter("all")}>ทั้งหมด ({preview.totalProjects})</Button></div><div className="mou-list">{shownRows.map(({ row, mapping, result }) => <article className="mobility-import-row" key={row.legacyProjectId}><header className="mobility-import-row-header"><span className="mou-row-icon"><UsersRound /></span><div className="mobility-import-summary"><strong>{row.projectName || "ไม่มีชื่อโครงการ"}</strong><p>{row.legacyProjectId} · {row.institutionName || "ไม่ระบุองค์กร"}</p><small>{row.startDate || "ไม่ระบุวันเริ่ม"}{row.endDate ? ` – ${row.endDate}` : ""} · นิสิต {row.studentParticipants} คน</small></div><Badge className={result === "error" ? "bg-destructive" : result === "warning" ? "bg-amber-600" : "bg-emerald-600"}>{labels[result]}</Badge></header>{mapping.partnerUnknown ? <p className="mobility-import-follow-up">ยังระบุองค์กรไม่ได้ — {mapping.partnerFollowUp || "รอตามข้อมูล"}</p> : remainingMessages(row, mapping).length ? <p className="mobility-import-issues">{remainingMessages(row, mapping).join(" · ")}</p> : <p className="mobility-import-resolved">Mapping ครบแล้ว — จะยังไม่ถูกบันทึกจนกว่าสร้าง staging batch</p>}
          {(row.needsCountryMapping || row.needsUnitMapping || row.needsPartnerMapping) ? <div className="mobility-import-fields">{row.needsCountryMapping ? <label><strong>ประเทศ</strong><OptionLabel>{row.sourceCountry?.name || "ไม่พบจากไฟล์เดิม"}</OptionLabel><select value={mapping.countryId || ""} onChange={(event) => setMapping(row.legacyProjectId, { countryId: event.target.value || undefined })}><option value="">เลือกประเทศในระบบ</option>{preview.referenceOptions.countries.map((country) => <option key={country.id} value={country.id}>{country.name_th} ({country.name_en})</option>)}</select></label> : null}{row.needsUnitMapping ? <label><strong>หน่วยงาน ม.พะเยา</strong><OptionLabel>{row.sourceUnit?.name || "ไม่พบจากไฟล์เดิม"}</OptionLabel><div className="mobility-import-control"><select value={mapping.unitId || ""} onChange={(event) => setMapping(row.legacyProjectId, { unitId: event.target.value || undefined })}><option value="">เลือกหน่วยงานในระบบ</option>{allUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name_th}{unit.code ? ` (${unit.code})` : ""}</option>)}</select>{access.roles.includes("system_admin") ? <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ kind: "unit", row })}><Plus /> เพิ่มหน่วยงาน</Button> : null}</div></label> : null}{row.needsPartnerMapping ? <label><strong>องค์กรคู่ความร่วมมือ</strong><OptionLabel>{row.institutionName || "ไม่พบจากไฟล์เดิม"}</OptionLabel><div className="mobility-import-control"><select value={mapping.partnerId || ""} onChange={(event) => setMapping(row.legacyProjectId, { partnerId: event.target.value || undefined, partnerUnknown: false, partnerFollowUp: "" })}><option value="">เลือกองค์กรในระบบ</option>{allPartners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name_th || partner.name_en || "องค์กรไม่มีชื่อ"}</option>)}</select>{access.modules.mou?.create ? <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ kind: "partner", row })}><Building2 /> เพิ่มองค์กร</Button> : null}</div><Button type="button" variant={mapping.partnerUnknown ? "secondary" : "ghost"} size="sm" onClick={() => setMapping(row.legacyProjectId, { partnerId: undefined, partnerUnknown: !mapping.partnerUnknown, partnerFollowUp: mapping.partnerUnknown ? "" : "ข้อมูลต้นทางยังไม่ระบุองค์กร" })}>{mapping.partnerUnknown ? "กำลังติดตามองค์กร" : "ยังระบุองค์กรไม่ได้"}</Button>{mapping.partnerUnknown ? <input aria-label="หมายเหตุติดตามองค์กร" value={mapping.partnerFollowUp || ""} placeholder="หมายเหตุติดตาม เช่น รอหนังสือ/สอบถามคณะ" onChange={(event) => setMapping(row.legacyProjectId, { partnerFollowUp: event.target.value })} /> : null}</label> : null}{dialog?.row.legacyProjectId === row.legacyProjectId ? <MappingEditor dialog={dialog} countries={preview.referenceOptions.countries} onClose={() => setDialog(null)} onCreated={created} /> : null}</div> : null}</article>)}</div>{shownRows.length === 0 ? <div className="module-empty-state"><span><School /></span><h3>ไม่มีรายการในตัวกรองนี้</h3><p>เปลี่ยนตัวกรองเพื่อดูรายการอื่น</p></div> : null}</section><p className="text-sm text-muted-foreground">ขั้นต่อไป: เมื่อตรวจครบทุกแถวแล้ว จึงค่อยสร้าง staging batch สำหรับตรวจซ้ำและอนุมัติ commit แยกต่างหาก</p></section> : null}
  </main>;
}
