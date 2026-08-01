"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { MasterSearchSelect } from "@/components/forms/master-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { saveContentRecord, type ContentFormState } from "./actions";
import { contentModules, type ContentModule } from "./config";
import type { ContentFormOptions, ContentRecord } from "./content-query";

const initialState: ContentFormState = {};
const localDateTime = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";

export function ContentForm({ module, record, options }: { module: ContentModule; record: ContentRecord | null; options: ContentFormOptions }) {
  const router = useRouter();
  const config = contentModules[module];
  const [state, formAction, pending] = useActionState(saveContentRecord, initialState);
  useEffect(() => {
    if (!state.success || !state.id) return;
    if (!record) router.replace(`${config.route}/${state.id}/edit`);
    else router.refresh();
  }, [config.route, record, router, state.id, state.success]);
  const partnerOptions = options.partners.map((item) => ({ value: item.id, label: item.name_th || item.name_en || "องค์กรไม่มีชื่อ" }));
  const countryOptions = options.countries.map((item) => ({ value: item.id, label: item.name_th, description: item.name_en }));
  const unitOptions = options.units.map((item) => ({ value: item.id, label: item.name_th, description: item.code }));

  return <main className="module-main mou-form-page">
    <div className="module-page-heading"><div><Link className="back-link" href={config.route}><ArrowLeft /> กลับไปรายการ{config.title}</Link><p className="module-eyebrow">การเผยแพร่และข้อมูลบริการ</p><h1>{record ? `แก้ไข${config.itemLabel}` : `เพิ่ม${config.itemLabel}`}</h1><p>{config.description}</p></div></div>
    <form action={formAction} className="mou-editor-form">
      <input type="hidden" name="content_module" value={module} /><input type="hidden" name="record_id" value={record?.id || ""} />
      <section className="mou-form-section"><div className="mou-form-section-heading"><span>1</span><div><h2>ข้อมูลหลัก</h2><p>ชื่อภาษาไทยเป็นข้อมูลบังคับ</p></div></div><div className="mou-form-grid">
        <label className="mou-field mou-field-wide">ชื่อภาษาไทย<Input name="title_th" defaultValue={record?.title_th || ""} required /></label>
        <label className="mou-field mou-field-wide">ชื่อภาษาอังกฤษ<Input name="title_en" defaultValue={record?.title_en || ""} /></label>
        {module === "scholarship" ? <><label className="mou-field">ประเภททุน<Input name="scholarship_type" defaultValue={record?.scholarship_type || ""} /></label><label className="mou-field">กลุ่มเป้าหมาย<select name="audience" defaultValue={record?.audience || "student"}><option value="student">นิสิต</option><option value="staff">บุคลากร</option><option value="both">นิสิตและบุคลากร</option><option value="external">บุคคลภายนอก</option></select></label><label className="mou-field">ประเภทเงินทุน<Input name="funding_type" defaultValue={record?.funding_type || ""} /></label><label className="mou-field">ระดับการศึกษา<Input name="study_level" defaultValue={record?.study_level || ""} /></label></> : null}
        {module === "events" ? <><label className="mou-field">ประเภทกิจกรรม<Input name="event_type" defaultValue={record?.event_type || ""} required /></label><label className="mou-field">รูปแบบ<select name="mode" defaultValue={record?.mode || "onsite"}><option value="onsite">On-site</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></label></> : null}
        {(module === "news" || module === "knowledge") ? <label className="mou-field">หมวดหมู่<Input name="category" defaultValue={record?.category || ""} /></label> : null}
        {module === "knowledge" ? <label className="mou-field">ประเภทแหล่งความรู้<Input name="resource_type" defaultValue={record?.resource_type || "article"} /></label> : null}
      </div></section>
      {(module === "scholarship" || module === "events") ? <section className="mou-form-section"><div className="mou-form-section-heading"><span>2</span><div><h2>ข้อมูลอ้างอิงและช่วงเวลา</h2><p>ค้นหาจาก Data Master กลางของระบบ</p></div></div><div className="mou-form-grid">
        <label className="mou-field">องค์กร<MasterSearchSelect name="partner_organization_id" value={record?.partner_organization_id || ""} options={partnerOptions} placeholder="ค้นหาองค์กร" /></label>
        <label className="mou-field">ประเทศ<MasterSearchSelect name="country_id" value={record?.country_id || ""} options={countryOptions} placeholder="ค้นหาประเทศ" /></label>
        {module === "events" ? <><label className="mou-field">หน่วยงานผู้จัด<MasterSearchSelect name="organizer_unit_id" value={record?.organizer_unit_id || ""} options={unitOptions} placeholder="ค้นหาหน่วยงาน" /></label><label className="mou-field">สถานที่<Input name="location_th" defaultValue={record?.location_th || ""} /></label><label className="mou-field">เริ่มต้น<Input name="starts_at" type="datetime-local" defaultValue={localDateTime(record?.starts_at)} required /></label><label className="mou-field">สิ้นสุด<Input name="ends_at" type="datetime-local" defaultValue={localDateTime(record?.ends_at)} required /></label><label className="mou-field">จำนวนผู้เข้าร่วม<Input name="participant_count" type="number" min="0" defaultValue={record?.participant_count || 0} /></label><label className="mou-field">ลิงก์ลงทะเบียน<Input name="registration_url" type="url" defaultValue={record?.registration_url || ""} /></label></> : <><label className="mou-field">วันประกาศ<Input name="publish_date" type="date" defaultValue={record?.publish_date || ""} /></label><label className="mou-field">เปิดรับสมัคร<Input name="open_date" type="date" defaultValue={record?.open_date || ""} /></label><label className="mou-field">ปิดรับสมัคร<Input name="close_date" type="date" defaultValue={record?.close_date || ""} /></label><label className="mou-field">ลิงก์รายละเอียด<Input name="detail_url" type="url" defaultValue={record?.detail_url || ""} /></label><label className="mou-field">ลิงก์สมัคร<Input name="apply_url" type="url" defaultValue={record?.apply_url || ""} /></label></>}
      </div></section> : null}
      <section className="mou-form-section"><div className="mou-form-section-heading"><span>{module === "scholarship" || module === "events" ? "3" : "2"}</span><div><h2>เนื้อหาและการเผยแพร่</h2><p>เก็บเป็นร่างได้ก่อน และเผยแพร่เมื่อข้อมูลพร้อม</p></div></div><div className="mou-form-grid">
        <label className="mou-field mou-field-wide">คำอธิบายย่อ<textarea name="summary_th" rows={3} defaultValue={record?.summary_th || ""} /></label>
        <label className="mou-field mou-field-wide">รายละเอียด<textarea name="content_th" rows={8} defaultValue={record?.content_th || ""} /></label>
        {module === "knowledge" ? <label className="mou-field mou-field-wide">ลิงก์ภายนอก<Input name="external_url" type="url" defaultValue={record?.external_url || ""} /></label> : null}
        {(module === "news" || module === "knowledge") ? <label className="mou-field">วันที่เผยแพร่<Input name="published_at" type="datetime-local" defaultValue={localDateTime(record?.published_at)} /></label> : null}
        <label className="mou-field">สถานะ<select name="publication_status" defaultValue={record?.publication_status || "draft"}><option value="draft">ร่าง</option><option value="published">เผยแพร่</option><option value="archived">เก็บถาวร</option></select></label>
        <label className="mou-field"><span className="flex items-center gap-2"><input name="public_visible" type="checkbox" defaultChecked={record?.public_visible || false} /> แสดงใน Public Portal</span></label>
        <label className="mou-field"><span className="flex items-center gap-2"><input name="pinned" type="checkbox" defaultChecked={record?.pinned || false} /> ปักหมุด</span></label>
        <label className="mou-field mou-field-wide">หมายเหตุภายใน<textarea name="internal_note" rows={3} defaultValue={record?.internal_note || ""} /></label>
      </div></section>
      {state.error ? <p className="mou-form-message is-error">{state.error}</p> : null}{state.success ? <p className="mou-form-message is-success"><CheckCircle2 /> บันทึกข้อมูลเรียบร้อย</p> : null}
      <div className="mou-form-actions"><Button type="submit" disabled={pending}><Save /> {pending ? "กำลังบันทึก" : `บันทึก${config.itemLabel}`}</Button></div>
    </form>
  </main>;
}
