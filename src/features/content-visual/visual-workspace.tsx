"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Eye, ImagePlus, Info, Plus, Save, Trash2 } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { buttonVariants } from "@/components/ui/button";
import { contentStateLabels } from "@/features/content-production/types";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { executeVisualCommand, uploadVisualImage } from "./actions";
import type { VisualActionState, VisualAsset, VisualBrief, VisualBriefInput, VisualCommand, VisualDetail, VisualSlot, VisualUploadInput } from "./types";
import styles from "./visual-workspace.module.css";

type Viewer = { displayName: string; email: string; role: string };
type CommandInput = VisualCommand | VisualUploadInput;
const channelLabels = { website: "เว็บไซต์", facebook: "Facebook" };
const rightsLabels = { owned: "เป็นเจ้าของผลงาน", licensed: "มีใบอนุญาตใช้งาน", permission: "ได้รับอนุญาตจากเจ้าของ", public_domain: "สาธารณสมบัติ" };
const value = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const buttonClass = (secondary = false) => cn(buttonVariants({ variant: secondary ? "outline" : "default", size: "lg" }));
const initialState: VisualActionState = {};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(date);
}

function StateBadge({ state }: { state: VisualBrief["state"] }) {
  return <span className={cn(styles.badge, state === "approved" ? styles.approved : state === "stale" ? styles.warning : undefined)}>{state === "approved" ? "อนุมัติแล้ว" : contentStateLabels[state]}</span>;
}

function CommandForm({ testId, makeCommand, children, upload = false, onSuccess }: {
  testId: string; makeCommand: (data: FormData) => CommandInput; children: ReactNode;
  upload?: boolean; onSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(upload ? uploadVisualImage : executeVisualCommand, initialState);
  const [transitionPending, startTransition] = useTransition();
  const request = useRef<{ signature: string; key: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const successHandler = useRef(onSuccess);
  const busy = pending || transitionPending;
  const conflict = state.code === "CONTENT_CONFLICT" || state.code === "VISUAL_CONFLICT" || state.code === "STALE_REVISION";

  useEffect(() => { successHandler.current = onSuccess; }, [onSuccess]);
  useEffect(() => {
    if (!state.success || !state.result) return;
    request.current = null;
    if (upload) form.current?.reset();
    successHandler.current?.();
    router.refresh();
  }, [router, state.result, state.success, upload]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    const candidate = makeCommand(data);
    const file = data.get("image");
    const signature = JSON.stringify({ ...candidate, file: file instanceof File ? [file.name, file.size, file.type, file.lastModified] : null });
    if (!request.current || request.current.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    data.set("command", JSON.stringify({ ...candidate, idempotency_key: request.current.key }));
    startTransition(() => dispatch(data));
  }

  return <form ref={form} onSubmit={submit} onChange={(event) => { if (event.target instanceof HTMLInputElement && event.target.type === "file") request.current = null; }} className={styles.form} data-testid={testId} aria-busy={busy}>
    <input type="hidden" name="command" value="" />
    <fieldset disabled={busy} className={styles.stack}>{children}</fieldset>
    {busy ? <p role="status" className={styles.hint}>กำลังบันทึก กรุณารอสักครู่</p> : null}
    {state.error ? <div role="alert" className={styles.error} data-testid="visual-command-error"><div>{state.error}{conflict ? <p>ข้อมูลที่กรอกยังอยู่ในหน้านี้ คัดลอกข้อความที่ยังไม่ได้บันทึกไว้ก่อนโหลดข้อมูลล่าสุด</p> : null}</div></div> : null}
    {conflict ? <button type="button" className={buttonClass(true)} onClick={() => router.refresh()}>โหลดข้อมูลล่าสุด</button> : null}
    {state.success ? <p role="status" className={styles.success}><CheckCircle2 aria-hidden="true" /> บันทึกเรียบร้อย</p> : null}
  </form>;
}

function ReviewForm({ detail, targetKind, targetId, state, isLatest, canEdit, canApprove }: {
  detail: VisualDetail; targetKind: "brief" | "asset_set"; targetId: string; state: VisualBrief["state"];
  isLatest: boolean; canEdit: boolean; canApprove: boolean;
}) {
  const canSubmit = isLatest && canEdit && (state === "draft" || state === "returned");
  const canDecide = isLatest && canApprove && state === "under_review";
  if (!canSubmit && !canDecide) return null;
  return <CommandForm testId={`visual-review-${targetId}`} makeCommand={(data) => {
    const base = { work_item_id: detail.work_item.id, expected_revision: detail.work_item.row_version, idempotency_key: "", decision: value(data, "decision") as "submit" | "approve" | "return", note: value(data, "note") };
    return targetKind === "brief" ? { ...base, op: "review_brief", brief_id: targetId } : { ...base, op: "review_set", asset_set_id: targetId };
  }}>
    <label className={styles.field}>หมายเหตุการตรวจ<textarea name="note" rows={2} maxLength={4000} placeholder="ระบุสิ่งที่ต้องแก้ไขเมื่อส่งกลับ" /></label>
    <div className={styles.actions}>
      {canSubmit ? <button type="submit" name="decision" value="submit" className={buttonClass()}>ส่งตรวจ{targetKind === "brief" ? "บรีฟภาพ" : "ชุดภาพ"}</button> : null}
      {canDecide ? <><button type="submit" name="decision" value="return" className={buttonClass(true)}>ส่งกลับแก้ไข</button><button type="submit" name="decision" value="approve" className={buttonClass()}>อนุมัติ{targetKind === "brief" ? "บรีฟภาพ" : "ชุดภาพ"}</button></> : null}
    </div>
  </CommandForm>;
}

function ReviewNotes({ detail, targetId }: { detail: VisualDetail; targetId: string }) {
  return <>{detail.reviews.filter((review) => review.target_id === targetId).map((review) => <p className={styles.meta} key={review.id}>{review.decision === "submitted" ? "ส่งตรวจ" : review.decision === "approved" ? "อนุมัติ" : "ส่งกลับแก้ไข"} · {formatDate(review.created_at)}{review.note ? ` — ${review.note}` : ""}</p>)}</>;
}

function BriefForm({ detail, contentVersionId }: { detail: VisualDetail; contentVersionId: string }) {
  const previous = detail.briefs.find((brief) => brief.content_version_id === contentVersionId && brief.is_latest);
  const source = previous?.brief;
  const [panels, setPanels] = useState<VisualBriefInput["panels"]>(source?.panels ?? [{ key: "cover", label: "ภาพปก", notes: "" }]);
  const updatePanel = (index: number, field: keyof VisualBriefInput["panels"][number], nextValue: string) => setPanels((current) => current.map((panel, position) => position === index ? { ...panel, [field]: nextValue } : panel));
  function addPanel() {
    setPanels((current) => {
      let number = 2;
      while (current.some((panel) => panel.key.trim() === `panel_${number}`)) number += 1;
      return [...current, { key: `panel_${number}`, label: "", notes: "" }];
    });
  }

  return <CommandForm testId="visual-brief-form" makeCommand={(data) => ({
    op: "save_brief", work_item_id: detail.work_item.id, expected_revision: detail.work_item.row_version, idempotency_key: "", content_version_id: contentVersionId,
    brief: { title: value(data, "title"), objective: value(data, "objective"), audience: value(data, "audience"), key_message: value(data, "key_message"), design_notes: value(data, "design_notes"), brand_notes: value(data, "brand_notes"), prompt: value(data, "prompt"), negative_prompt: value(data, "negative_prompt"), width: Number(value(data, "width")), height: Number(value(data, "height")), panels: panels.map((panel) => ({ key: panel.key.trim(), label: panel.label.trim(), notes: panel.notes.trim() })) },
  })}>
    <input type="hidden" name="content_version_id" value={contentVersionId} />
    <div className={styles.grid}>
      <label className={cn(styles.field, styles.wide)}>ชื่อบรีฟภาพ<input name="title" defaultValue={source?.title ?? ""} required maxLength={200} /></label>
      <label className={styles.field}>เป้าหมายของภาพ<textarea name="objective" defaultValue={source?.objective ?? ""} required rows={3} maxLength={2000} /></label>
      <label className={styles.field}>กลุ่มผู้อ่าน<textarea name="audience" defaultValue={source?.audience ?? ""} required rows={3} maxLength={2000} /></label>
      <label className={cn(styles.field, styles.wide)}>ข้อความสำคัญที่ภาพต้องสื่อ<textarea name="key_message" defaultValue={source?.key_message ?? ""} required rows={3} maxLength={2000} /></label>
      <label className={styles.field}>แนวทางภาพและการจัดวาง<textarea name="design_notes" defaultValue={source?.design_notes ?? ""} rows={4} maxLength={8000} /></label>
      <label className={styles.field}>แนวทางแบรนด์สำหรับงานนี้<textarea name="brand_notes" defaultValue={source?.brand_notes ?? ""} rows={4} maxLength={8000} /><small className={styles.hint}>ระบุสี ตัวอักษร และข้อจำกัดให้ผู้ตรวจพิจารณาก่อนอนุมัติบรีฟ ยังไม่ได้เชื่อมไฟล์แม่แบบแบรนด์</small></label>
      <label className={styles.field}>ความกว้างภาพ (พิกเซล)<input name="width" defaultValue={source?.width ?? 1080} type="number" min={64} max={4096} step={1} required /></label>
      <label className={styles.field}>ความสูงภาพ (พิกเซล)<input name="height" defaultValue={source?.height ?? 1080} type="number" min={64} max={4096} step={1} required /><small className={styles.hint}>ทุกภาพในบรีฟต้องมีขนาดตรงกัน และพื้นที่ภาพไม่เกิน 16 ล้านพิกเซล</small></label>
    </div>
    <fieldset className={styles.stack}><legend>แผงภาพและหน้าที่ของแต่ละภาพ</legend><p className={styles.hint}>กำหนดได้ 1–6 แผง เช่น ภาพปก คุณสมบัติ หรือกำหนดเวลา ใช้รหัสแผงเดิมเพื่อเชื่อมภาพกับบรีฟ</p>
      {panels.map((panel, index) => <div className={styles.panelFields} key={index}>
        <div className={styles.rowHeading}><h3>แผงที่ {index + 1}</h3>{panels.length > 1 ? <button type="button" className={buttonClass(true)} onClick={() => setPanels((current) => current.filter((_, position) => position !== index))} aria-label={`ลบแผงที่ ${index + 1}`}><Trash2 aria-hidden="true" /> ลบแผง</button> : null}</div>
        <div className={styles.grid}><label className={styles.field}>รหัสแผง<input name={`panel_${index}_key`} value={panel.key} onChange={(event) => updatePanel(index, "key", event.target.value)} pattern="[a-z][a-z0-9_-]*" maxLength={40} required /><small className={styles.hint}>ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข ขีดกลาง หรือขีดล่าง</small></label><label className={styles.field}>ชื่อแผง<input name={`panel_${index}_label`} value={panel.label} onChange={(event) => updatePanel(index, "label", event.target.value)} maxLength={200} required /></label><label className={cn(styles.field, styles.wide)}>เนื้อหาและข้อสังเกตของแผง<textarea name={`panel_${index}_notes`} value={panel.notes} onChange={(event) => updatePanel(index, "notes", event.target.value)} rows={2} maxLength={2000} /></label></div>
      </div>)}
      {panels.length < 6 ? <div><button type="button" className={buttonClass(true)} onClick={addPanel}><Plus aria-hidden="true" /> เพิ่มแผงภาพ</button></div> : null}
    </fieldset>
    <details className={styles.details}><summary>ข้อความคำสั่งสำหรับจัดทำภาพด้วยตนเอง (ถ้ามี)</summary><div className={styles.grid}><label className={styles.field}>คำสั่งภาพ / Prompt<textarea name="prompt" defaultValue={source?.prompt ?? ""} rows={5} maxLength={8000} /></label><label className={styles.field}>สิ่งที่ไม่ต้องการในภาพ<textarea name="negative_prompt" defaultValue={source?.negative_prompt ?? ""} rows={5} maxLength={8000} /></label></div><p className={styles.hint}>เก็บข้อความไว้ประกอบการทำงาน ไม่ส่งคำสั่งไปสร้างภาพอัตโนมัติ</p></details>
    <p className={styles.hint}>การแก้ไขจะบันทึกเป็นบรีฟฉบับใหม่ และต้องตรวจอนุมัติอีกครั้งก่อนเพิ่มภาพ</p>
    <div className={styles.actions}><button type="submit" className={buttonClass()}><Save aria-hidden="true" /> บันทึกบรีฟฉบับใหม่</button></div>
  </CommandForm>;
}

function BriefSection({ detail, canEdit, canApprove }: { detail: VisualDetail; canEdit: boolean; canApprove: boolean }) {
  const approvedContent = detail.content_versions.filter((version) => version.state === "approved");
  const [selectedId, setSelectedId] = useState(approvedContent[0]?.id ?? "");
  const currentId = approvedContent.some((version) => version.id === selectedId) ? selectedId : approvedContent[0]?.id ?? "";
  const latestBrief = detail.briefs.find((brief) => brief.content_version_id === currentId && brief.is_latest);
  return <section className={styles.panel} aria-labelledby="visual-brief-heading">
    <div className={styles.sectionHeading}><div><h2 id="visual-brief-heading">1. บรีฟภาพ</h2><p>เริ่มจากฉบับเนื้อหาที่อนุมัติแล้ว กำหนดสิ่งที่ภาพต้องสื่อ ขนาด และหน้าที่ของแต่ละแผง</p></div></div>
    {canEdit && currentId ? <div className={styles.stack}><label className={styles.field}>ฉบับเนื้อหาที่ใช้ทำภาพ<select name="brief_content_version" value={currentId} onChange={(event) => setSelectedId(event.target.value)}>{approvedContent.map((version) => <option key={version.id} value={version.id}>{channelLabels[version.channel]} · เนื้อหาฉบับที่ {version.version_number}</option>)}</select></label><BriefForm key={`${currentId}:${latestBrief?.id ?? "new"}`} detail={detail} contentVersionId={currentId} /></div> : !currentId ? <p className={styles.notice}>ต้องมีฉบับเนื้อหาที่อนุมัติและยังเป็นปัจจุบันก่อนเริ่มบรีฟภาพ กลับไปตรวจเนื้อหาและแหล่งข้อมูลให้ครบก่อน</p> : null}
    <div className={styles.separator} />
    <h3 className={styles.subheading}>ประวัติบรีฟและผลตรวจ</h3>
    {detail.briefs.length ? <ol className={styles.history}>{detail.briefs.map((brief) => {
      const content = detail.content_versions.find((version) => version.id === brief.content_version_id);
      return <li className={styles.historyItem} key={brief.id} data-testid={`visual-brief-${brief.id}`}><div className={styles.rowHeading}><div><h3>{brief.brief.title} · ฉบับที่ {brief.version_number}</h3><p className={styles.meta}>{content ? `${channelLabels[content.channel]} · เนื้อหาฉบับที่ ${content.version_number} · ` : ""}{brief.brief.width} × {brief.brief.height} พิกเซล · {brief.brief.panels.length} แผง · {formatDate(brief.created_at)}</p></div><StateBadge state={brief.state} /></div>
        {brief.state === "stale" || !brief.is_latest ? <p className={styles.hint}>เก็บเป็นประวัติ บรีฟนี้ใช้เพิ่มภาพหรืออนุมัติชุดภาพต่อไม่ได้ ให้จัดทำจากเนื้อหาฉบับปัจจุบัน</p> : null}
        <details className={styles.details}><summary>อ่านรายละเอียดบรีฟ</summary><dl className={styles.definition}>{([["เป้าหมาย", brief.brief.objective], ["กลุ่มผู้อ่าน", brief.brief.audience], ["ข้อความสำคัญ", brief.brief.key_message], ["แนวทางภาพ", brief.brief.design_notes], ["แนวทางแบรนด์", brief.brief.brand_notes], ["คำสั่งภาพ", brief.brief.prompt], ["สิ่งที่ไม่ต้องการ", brief.brief.negative_prompt]]).map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text || "ยังไม่ได้ระบุ"}</dd></div>)}</dl><ol className={styles.panelList}>{brief.brief.panels.map((panel) => <li key={panel.key}><strong>{panel.label}</strong> <span className={styles.meta}>({panel.key})</span>{panel.notes ? <p className={styles.copy}>{panel.notes}</p> : null}</li>)}</ol></details>
        <ReviewNotes detail={detail} targetId={brief.id} /><ReviewForm detail={detail} targetKind="brief" targetId={brief.id} state={brief.state} isLatest={brief.is_latest} canEdit={canEdit} canApprove={canApprove} />
      </li>;
    })}</ol> : <p className={styles.hint}>ยังไม่มีบรีฟภาพที่บันทึก</p>}
  </section>;
}

function UploadForm({ detail, brief }: { detail: VisualDetail; brief: VisualBrief }) {
  return <CommandForm testId="visual-upload-form" upload makeCommand={(data) => ({
    work_item_id: detail.work_item.id, expected_revision: detail.work_item.row_version, idempotency_key: "", brief_id: brief.id,
    provenance: { source_kind: value(data, "source_kind") as VisualUploadInput["provenance"]["source_kind"], rights_basis: value(data, "rights_basis") as VisualUploadInput["provenance"]["rights_basis"], rights_note: value(data, "rights_note"), attribution: value(data, "attribution"), origin_url: value(data, "origin_url"), parent_asset_id: value(data, "parent_asset_id") || null },
  })}>
    <input type="hidden" name="brief_id" value={brief.id} />
    <div className={styles.grid}>
      <label className={cn(styles.field, styles.wide)}>ไฟล์ภาพ<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /><small className={styles.hint}>PNG, JPEG หรือ WebP ไม่เกิน 8 MB ขนาด {brief.brief.width} × {brief.brief.height} พิกเซล ระบบจัดทิศทางภาพตามไฟล์และลบข้อมูลแฝงก่อนเก็บ</small></label>
      <label className={styles.field}>ที่มาของไฟล์<select name="source_kind" defaultValue="manual_upload"><option value="manual_upload">ไฟล์ที่จัดทำด้วยตนเอง</option><option value="canva_export">ไฟล์ที่ส่งออกจาก Canva</option></select></label>
      <label className={styles.field}>สิทธิ์ใช้งาน<select name="rights_basis" defaultValue="owned">{Object.entries(rightsLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label className={cn(styles.field, styles.wide)}>หลักฐานหรือรายละเอียดสิทธิ์ใช้งาน<textarea name="rights_note" required rows={3} maxLength={4000} placeholder="ระบุเจ้าของผลงาน ขอบเขตการอนุญาต หรือชื่อใบอนุญาตที่ตรวจแล้ว" /></label>
      <label className={styles.field}>เครดิตที่ต้องระบุ<textarea name="attribution" rows={2} maxLength={2000} /></label>
      <label className={styles.field}>ลิงก์ต้นทาง / งาน Canva (ถ้ามี)<input name="origin_url" type="url" maxLength={2000} placeholder="https://…" /><small className={styles.hint}>เก็บเป็นข้อมูลอ้างอิง ไม่เปิดอ่านหรือดึงไฟล์จากลิงก์นี้</small></label>
      <label className={cn(styles.field, styles.wide)}>ปรับมาจากภาพเดิมของเรื่องนี้ (ถ้ามี)<select name="parent_asset_id" defaultValue=""><option value="">ภาพใหม่ ไม่มีภาพต้นฉบับในรายการนี้</option>{detail.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_file_name} · {formatDate(asset.created_at)}</option>)}</select></label>
    </div>
    <p className={styles.hint}>ทุกไฟล์เก็บเป็นภาพใหม่ในพื้นที่ส่วนตัว ภาพที่อัปโหลดแล้วต้องเลือกเข้าชุดภาพและผ่านการตรวจอีกครั้ง</p>
    <div className={styles.actions}><button type="submit" className={buttonClass()}><ImagePlus aria-hidden="true" /> อัปโหลดภาพส่วนตัว</button></div>
  </CommandForm>;
}

function AssetCard({ asset }: { asset: VisualAsset }) {
  return <li className={styles.assetCard} data-testid={`visual-asset-${asset.id}`}><div className={styles.imageFrame}><Image src={`/api/content-visual/assets/${asset.id}`} alt={`ภาพสำหรับตรวจ: ${asset.original_file_name}`} width={asset.width} height={asset.height} unoptimized data-testid={`visual-preview-${asset.id}`} /></div><div className={styles.assetBody}><h3>{asset.original_file_name}</h3><p className={styles.meta}>{asset.width} × {asset.height} พิกเซล · {(asset.size_bytes / 1024).toFixed(1)} KB · {asset.mime_type}</p><p className={styles.meta}>{asset.source_kind === "canva_export" ? "ส่งออกจาก Canva" : "อัปโหลดด้วยตนเอง"} · {formatDate(asset.created_at)}</p><details className={styles.details}><summary>ที่มาและสิทธิ์ใช้งาน</summary><p className={styles.copy}>{rightsLabels[asset.rights_basis]} — {asset.rights_note}</p>{asset.attribution ? <p className={styles.copy}>เครดิต: {asset.attribution}</p> : null}{asset.origin_url ? <a href={asset.origin_url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>เปิดแหล่งอ้างอิง</a> : null}{asset.parent_asset_id ? <p className={styles.meta}>มีภาพต้นฉบับที่บันทึกไว้ในเรื่องนี้</p> : null}</details></div></li>;
}

function AssetSetForm({ detail, brief, assets }: { detail: VisualDetail; brief: VisualBrief; assets: VisualAsset[] }) {
  const previous = detail.asset_sets.find((set) => set.brief_id === brief.id && set.is_latest);
  const initial = previous?.slots ?? [];
  const [slots, setSlots] = useState<VisualSlot[]>([...initial, ...brief.brief.panels.filter((panel) => !initial.some((slot) => slot.panel_key === panel.key)).map((panel) => ({ panel_key: panel.key, asset_id: "", alt_text_th: "", alt_text_en: "" }))]);
  const setSlot = (index: number, field: keyof VisualSlot, nextValue: string) => setSlots((current) => current.map((slot, position) => position === index ? { ...slot, [field]: nextValue } : slot));
  function move(index: number, direction: -1 | 1) {
    setSlots((current) => { const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  return <CommandForm testId="visual-asset-set-form" makeCommand={() => ({ op: "save_set", work_item_id: detail.work_item.id, expected_revision: detail.work_item.row_version, idempotency_key: "", brief_id: brief.id, slots: slots.filter((slot) => slot.asset_id).map((slot) => ({ ...slot, alt_text_th: slot.alt_text_th.trim(), alt_text_en: slot.alt_text_en.trim() })) })}>
    <input type="hidden" name="brief_id" value={brief.id} />
    <p className={styles.hint}>เลือกภาพและเรียงลำดับชุดภาพ ก่อนส่งตรวจต้องครบทุกแผงและมีคำอธิบายภาพทั้งสองภาษา บันทึกร่างบางส่วนได้</p>
    <ol className={styles.slotList}>{slots.map((slot, index) => <li className={styles.panelFields} key={slot.panel_key} data-testid={`visual-slot-${slot.panel_key}`}><div className={styles.rowHeading}><h3>{index + 1}. {brief.brief.panels.find((panel) => panel.key === slot.panel_key)?.label ?? slot.panel_key}</h3><div className={styles.reorder}><button type="button" className={buttonClass(true)} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`เลื่อน ${slot.panel_key} ขึ้น`} data-testid={`visual-slot-up-${slot.panel_key}`}><ArrowUp aria-hidden="true" /></button><button type="button" className={buttonClass(true)} disabled={index === slots.length - 1} onClick={() => move(index, 1)} aria-label={`เลื่อน ${slot.panel_key} ลง`} data-testid={`visual-slot-down-${slot.panel_key}`}><ArrowDown aria-hidden="true" /></button></div></div><input type="hidden" name={`slot_${index}_panel_key`} value={slot.panel_key} /><div className={styles.grid}><label className={cn(styles.field, styles.wide)}>ภาพที่ใช้<select name={`slot_${index}_asset_id`} value={slot.asset_id} onChange={(event) => setSlot(index, "asset_id", event.target.value)}><option value="">ยังไม่เลือกภาพ</option>{assets.map((asset) => <option key={asset.id} value={asset.id} disabled={slots.some((other, position) => position !== index && other.asset_id === asset.id)}>{asset.original_file_name}</option>)}</select></label><label className={styles.field}>คำอธิบายภาพภาษาไทย<textarea name={`slot_${index}_alt_text_th`} value={slot.alt_text_th} onChange={(event) => setSlot(index, "alt_text_th", event.target.value)} rows={3} maxLength={1000} /></label><label className={styles.field}>Image description in English<textarea name={`slot_${index}_alt_text_en`} value={slot.alt_text_en} onChange={(event) => setSlot(index, "alt_text_en", event.target.value)} rows={3} maxLength={1000} lang="en" /></label></div></li>)}</ol>
    <div className={styles.actions}><button type="submit" className={buttonClass()} disabled={!slots.some((slot) => slot.asset_id)}><Save aria-hidden="true" /> บันทึกชุดภาพฉบับใหม่</button></div>
  </CommandForm>;
}

function ImagesSection({ detail, canEdit, canApprove }: { detail: VisualDetail; canEdit: boolean; canApprove: boolean }) {
  const [selectedId, setSelectedId] = useState(detail.briefs.find((brief) => brief.is_latest && brief.state === "approved")?.id ?? detail.briefs[0]?.id ?? "");
  const brief = detail.briefs.find((item) => item.id === selectedId) ?? detail.briefs[0];
  const assets = detail.assets.filter((asset) => asset.brief_id === brief?.id);
  const sets = detail.asset_sets.filter((set) => set.brief_id === brief?.id);
  const currentSet = sets.find((set) => set.is_latest);
  const canManage = canEdit && brief?.is_latest && brief.state === "approved";
  return <section className={styles.panel} aria-labelledby="visual-images-heading">
    <div className={styles.sectionHeading}><div><h2 id="visual-images-heading">2. ภาพส่วนตัวและชุดภาพสำหรับตรวจ</h2><p>เพิ่มไฟล์ภาพให้บรีฟที่อนุมัติ เลือกภาพตามแผง แล้วส่งตรวจทั้งชุด</p></div></div>
    {brief ? <div className={styles.stack}><label className={styles.field}>บรีฟภาพที่ต้องการดู<select name="asset_brief_id" value={brief.id} onChange={(event) => setSelectedId(event.target.value)}>{detail.briefs.map((item) => <option key={item.id} value={item.id}>{item.brief.title} · ฉบับที่ {item.version_number} · {item.state === "approved" ? "อนุมัติแล้ว" : contentStateLabels[item.state]}</option>)}</select></label>
      <div className={styles.rowHeading}><p className={styles.hint}>{brief.brief.width} × {brief.brief.height} พิกเซล · {brief.brief.panels.length} แผงภาพ</p><StateBadge state={brief.state} /></div>
      {canManage ? <UploadForm key={brief.id} detail={detail} brief={brief} /> : <p className={styles.notice}>{brief.state !== "approved" || !brief.is_latest ? "บรีฟนี้ยังใช้เพิ่มภาพไม่ได้ ต้องเป็นบรีฟปัจจุบันที่ผ่านการอนุมัติก่อน ภาพเดิมยังเปิดตรวจจากประวัติได้" : "คุณเปิดดูภาพและที่มาได้ ผู้มีสิทธิ์แก้ไขสามารถเพิ่มภาพและจัดชุดภาพ"}</p>}
      {assets.length ? <ul className={styles.assetGrid}>{assets.map((asset) => <AssetCard key={asset.id} asset={asset} />)}</ul> : <div className={styles.empty}><ImagePlus aria-hidden="true" /><p>ยังไม่มีไฟล์ภาพสำหรับบรีฟนี้</p></div>}
      <div className={styles.separator} /><h3 className={styles.subheading}>เลือกภาพและลำดับในชุด</h3>
      {canManage && assets.length ? <AssetSetForm key={`${brief.id}:${currentSet?.id ?? "new"}`} detail={detail} brief={brief} assets={assets} /> : <p className={styles.hint}>เพิ่มภาพในบรีฟที่อนุมัติแล้วเพื่อเริ่มเลือกชุดภาพ</p>}
      <h3 className={styles.subheading}>ประวัติชุดภาพและผลตรวจ</h3>
      {sets.length ? <ol className={styles.history}>{sets.map((set) => <li className={styles.historyItem} key={set.id} data-testid={`visual-set-${set.id}`}><div className={styles.rowHeading}><div><h3>ชุดภาพฉบับที่ {set.version_number}</h3><p className={styles.meta}>{set.slots.length} ภาพ · {formatDate(set.created_at)}</p></div><StateBadge state={set.state} /></div>{set.state === "stale" || !set.is_latest ? <p className={styles.hint}>ชุดภาพนี้เก็บเป็นประวัติ ต้องจัดทำจากบรีฟและเนื้อหาปัจจุบันก่อนตรวจใหม่</p> : null}<ol className={styles.setPreview}>{set.slots.map((slot, index) => {
        const asset = detail.assets.find((image) => image.id === slot.asset_id);
        return <li key={slot.panel_key}><strong>{index + 1}. {brief.brief.panels.find((panel) => panel.key === slot.panel_key)?.label ?? slot.panel_key}</strong>{asset ? <><Image src={`/api/content-visual/assets/${asset.id}`} alt={slot.alt_text_th || `ภาพสำหรับตรวจ: ${asset.original_file_name}`} width={asset.width} height={asset.height} unoptimized /><p className={styles.meta}>{asset.original_file_name}</p></> : <p className={styles.hint}>ไม่พบภาพในรายการที่เปิดดู</p>}<p className={styles.copy}>ไทย: {slot.alt_text_th || "ยังไม่ได้ระบุ"}</p><p className={styles.copy} lang="en">English: {slot.alt_text_en || "Not yet provided"}</p></li>;
      })}</ol><ReviewNotes detail={detail} targetId={set.id} /><ReviewForm detail={detail} targetKind="asset_set" targetId={set.id} state={set.state} isLatest={set.is_latest} canEdit={canEdit} canApprove={canApprove} /></li>)}</ol> : <p className={styles.hint}>ยังไม่มีชุดภาพที่บันทึก</p>}
    </div> : <p className={styles.hint}>เริ่มจากบันทึกบรีฟภาพในส่วนที่ 1 แล้วส่งตรวจเพื่อเปิดขั้นเพิ่มภาพ</p>}
  </section>;
}

export function VisualWorkspace({ detail, access, viewer }: { detail: VisualDetail; access: CurrentUserAccess; viewer: Viewer }) {
  const canEdit = access.modules[detail.work_item.kind].update;
  const canApprove = access.modules[detail.work_item.kind].publish;
  return <WorkspaceChrome access={access} viewer={viewer} title="บรีฟและจัดการภาพ" activePath="/content-production" hidePlaceholderControls><main className={styles.main} data-testid="visual-workspace" data-revision={detail.work_item.row_version}>
    <header className={styles.heading}><Link href={`/content-production/${detail.work_item.kind}/${detail.work_item.record_id}`} className={styles.backLink}><ArrowLeft aria-hidden="true" /> กลับไปจัดทำเนื้อหา</Link><p className={styles.eyebrow}>จัดทำเนื้อหา · {detail.work_item.kind === "scholarship" ? "ทุนการศึกษา" : "ข่าวประชาสัมพันธ์"}</p><h1>บรีฟภาพและจัดการภาพ</h1><p className={styles.description}>เตรียมแนวทางภาพ เก็บไฟล์ที่ทำด้วยตนเอง และตรวจชุดภาพพร้อมคำอธิบายสองภาษา</p></header>
    <p className={styles.notice}><Info aria-hidden="true" /><span>ภาพในพื้นที่นี้เป็นส่วนตัว การอนุมัติบรีฟและชุดภาพยังไม่เผยแพร่ไปเว็บไซต์หรือ Facebook</span></p>
    {!canEdit ? <p className={styles.notice} data-testid="visual-readonly"><Eye aria-hidden="true" /><span>{canApprove ? "คุณดูข้อมูลและตรวจอนุมัติบรีฟหรือชุดภาพที่ส่งตรวจได้" : "สิทธิ์อ่านอย่างเดียว คุณเปิดดูบรีฟ ภาพ ที่มา และประวัติการตรวจได้"}</span></p> : null}
    <BriefSection detail={detail} canEdit={canEdit} canApprove={canApprove} /><ImagesSection detail={detail} canEdit={canEdit} canApprove={canApprove} />
  </main></WorkspaceChrome>;
}
