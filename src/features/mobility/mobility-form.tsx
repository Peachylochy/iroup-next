"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileCheck2, Plus, Save, Trash2, UsersRound, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitMobilityForm, type MobilityFormState } from "./actions";
import type { MobilityFormOptions, MobilityFormRecord } from "./mobility-query";

type Props = { mobility: MobilityFormRecord | null; options: MobilityFormOptions };
type Participant = { full_name_snapshot: string; student_id_snapshot: string; faculty_snapshot: string; study_program_snapshot: string; study_level_snapshot: string; participant_role: string };
type Funding = { budget_type: string; source_name: string; amount: string; currency: string };
const initialState: MobilityFormState = {};

function thaiFiscalYear(value: string) {
  if (!value) return "";
  const [year, month] = value.split("-").map(Number);
  return year && month ? String(year + 543 + (month >= 10 ? 1 : 0)) : "";
}

export function MobilityForm({ mobility, options }: Props) {
  const [state, action, pending] = useActionState(submitMobilityForm, initialState);
  const [participants, setParticipants] = useState<Participant[]>(() => mobility?.movement_participants.map((item) => ({ full_name_snapshot: item.full_name_snapshot, student_id_snapshot: item.student_id_snapshot ?? "", faculty_snapshot: item.faculty_snapshot ?? "", study_program_snapshot: item.study_program_snapshot ?? "", study_level_snapshot: item.study_level_snapshot ?? "", participant_role: item.participant_role ?? "นิสิต" })) ?? []);
  const [funding, setFunding] = useState<Funding[]>(() => mobility?.movement_funding.map((item) => ({ budget_type: item.budget_type, source_name: item.source_name ?? "", amount: item.amount?.toString() ?? "", currency: item.currency })) ?? []);
  const [startDate, setStartDate] = useState(mobility?.start_date ?? "");
  const isLocked = mobility?.workflow_status !== undefined && mobility.workflow_status !== "draft";
  const currentYear = useMemo(() => thaiFiscalYear(startDate), [startDate]);

  useEffect(() => {
    if (state.id && !mobility) window.location.assign(`/mobility/${state.id}?created=1`);
  }, [mobility, state.id]);

  const addParticipant = () => setParticipants((items) => [...items, { full_name_snapshot: "", student_id_snapshot: "", faculty_snapshot: "", study_program_snapshot: "", study_level_snapshot: "", participant_role: "นิสิต" }]);
  const addFunding = () => setFunding((items) => [...items, { budget_type: "", source_name: "", amount: "", currency: "THB" }]);

  return <main className="module-main mou-form-page">
    <div className="module-page-heading">
      <div>
        <Link className="back-link" href="/mobility"><ArrowLeft /> กลับไปรายการ Mobility</Link>
        <p className="module-eyebrow">การเดินทางและ Mobility</p>
        <h1>{mobility ? "แก้ไข Mobility นิสิต" : "เพิ่ม Mobility นิสิต"}</h1>
        <p>บันทึกข้อมูลเป็นร่างก่อน แล้วส่งตรวจเมื่อข้อมูลโครงการ ผู้เข้าร่วม และหน่วยงานเจ้าของครบถ้วน</p>
      </div>
      <span className="workflow-state"><FileCheck2 /> {mobility?.workflow_status === "under_review" ? "รอตรวจสอบ" : mobility ? "ฉบับร่าง" : "กำลังสร้างร่างใหม่"}</span>
    </div>

    <form action={action} className="mou-editor-form">
      <input type="hidden" name="mobility_id" value={mobility?.id ?? ""} />
      <input type="hidden" name="updated_at" value={mobility?.updated_at ?? ""} />
      <input type="hidden" name="participants_json" value={JSON.stringify(participants)} />
      <input type="hidden" name="funding_json" value={JSON.stringify(funding.map((item) => ({ ...item, amount: item.amount ? Number(item.amount) : null })))} />

      <section className="mou-form-section"><div className="mou-form-section-heading"><span>1</span><div><h2>ข้อมูลโครงการ</h2><p>ข้อมูลพื้นฐานของการแลกเปลี่ยนหรือกิจกรรม Mobility</p></div></div>
        <div className="mou-form-grid">
          <label className="mou-field mou-field-wide">ชื่อโครงการ *<Input name="project_name" defaultValue={mobility?.project_name ?? ""} required disabled={isLocked} /></label>
          <label className="mou-field mou-field-wide">ชื่อภาษาอังกฤษ<Input name="title_en" defaultValue={mobility?.title_en ?? ""} disabled={isLocked} /></label>
          <label className="mou-field">ทิศทาง *<select name="direction" defaultValue={mobility?.direction ?? "outbound"} disabled={isLocked}><option value="outbound">Outbound — ไปต่างประเทศ</option><option value="inbound">Inbound — มา ม.พะเยา</option><option value="bilateral">Bilateral — สองทาง</option></select></label>
          <label className="mou-field">รูปแบบ Mobility<Input name="mobility_mode" placeholder="เช่น Exchange, Short course" defaultValue={mobility?.mobility_mode ?? ""} disabled={isLocked} /></label>
          <label className="mou-field mou-field-wide">วัตถุประสงค์ *<textarea name="purpose" defaultValue={mobility?.purpose ?? ""} disabled={isLocked} rows={3} /></label>
          <label className="mou-field">ประเภทกิจกรรม<Input name="activity_type" defaultValue={mobility?.activity_type ?? ""} disabled={isLocked} /></label>
          <label className="mou-field">กลุ่มผู้เข้าร่วม<Input name="participant_group" defaultValue={mobility?.participant_group ?? "นิสิต"} disabled={isLocked} /></label>
        </div>
      </section>

      <section className="mou-form-section"><div className="mou-form-section-heading"><span>2</span><div><h2>ปลายทางและหน่วยงาน</h2><p>เลือกข้อมูลจากคลังกลาง เพื่อเก็บประวัติและรายงานได้ถูกต้อง</p></div></div>
        <div className="mou-form-grid">
          <label className="mou-field">ประเทศ *<select name="country_id" defaultValue={mobility?.country_id ?? ""} disabled={isLocked}><option value="">เลือกประเทศ</option>{options.countries.map((country) => <option key={country.id} value={country.id}>{country.name_th} ({country.name_en})</option>)}</select></label>
          <label className="mou-field">เมือง<Input name="city" defaultValue={mobility?.city ?? ""} disabled={isLocked} /></label>
          <label className="mou-field mou-field-wide">องค์กร/สถาบันคู่ความร่วมมือ<select name="partner_organization_id" defaultValue={mobility?.partner_organization_id ?? ""} disabled={isLocked}><option value="">ยังไม่ระบุ</option>{options.partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name_th || partner.name_en}</option>)}</select></label>
          <label className="mou-field mou-field-wide">หน่วยงานเจ้าของ ม.พะเยา *<select name="owner_unit_id" defaultValue={mobility?.owner_unit_id ?? ""} disabled={isLocked}><option value="">เลือกหน่วยงาน</option>{options.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name_th}</option>)}</select></label>
        </div>
      </section>

      <section className="mou-form-section"><div className="mou-form-section-heading"><span>3</span><div><h2>วันเวลาและการอนุมัติ</h2><p>วันกลับยังว่างได้ในร่าง แต่ระบบตรวจลำดับเวลาทันทีเมื่อระบุ</p></div></div>
        <div className="mou-form-grid">
          <label className="mou-field">วันเริ่มเดินทาง *<Input type="date" name="start_date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} disabled={isLocked} /></label>
          <label className="mou-field">วันกลับ<Input type="date" name="end_date" defaultValue={mobility?.end_date ?? ""} disabled={isLocked} /></label>
          <label className="mou-field">เวลาออกเดินทาง<Input type="datetime-local" name="departure_at" defaultValue={mobility?.departure_at?.slice(0, 16) ?? ""} disabled={isLocked} /></label>
          <label className="mou-field">เวลากลับ<Input type="datetime-local" name="return_at" defaultValue={mobility?.return_at?.slice(0, 16) ?? ""} disabled={isLocked} /></label>
          <label className="mou-field">ปีงบประมาณ<OutputYear value={currentYear || String(mobility?.fiscal_year ?? "")} /></label>
          <input type="hidden" name="fiscal_year" value={currentYear || String(mobility?.fiscal_year ?? "")} />
          <label className="mou-field">เลขอ้างอิงอนุมัติ<Input name="approval_reference" defaultValue={mobility?.approval_reference ?? ""} disabled={isLocked} /></label>
        </div>
      </section>

      <section className="mou-form-section"><div className="mou-form-section-heading"><span>4</span><div><h2><UsersRound /> ผู้เข้าร่วม</h2><p>เพิ่มเป็นรายบุคคลในรอบนี้; การนำเข้าแบบ batch จะทำเป็น preview แยกต่างหาก</p></div></div>
        <div className="space-y-3">{participants.map((participant, index) => <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-border p-3" key={index}>
          <Input placeholder="ชื่อ-นามสกุล *" value={participant.full_name_snapshot} disabled={isLocked} onChange={(e) => setParticipants((items) => items.map((item, i) => i === index ? { ...item, full_name_snapshot: e.target.value } : item))} />
          <Input placeholder="รหัสนิสิต" value={participant.student_id_snapshot} disabled={isLocked} onChange={(e) => setParticipants((items) => items.map((item, i) => i === index ? { ...item, student_id_snapshot: e.target.value } : item))} />
          <Input placeholder="คณะ" value={participant.faculty_snapshot} disabled={isLocked} onChange={(e) => setParticipants((items) => items.map((item, i) => i === index ? { ...item, faculty_snapshot: e.target.value } : item))} />
          <Input placeholder="หลักสูตร" value={participant.study_program_snapshot} disabled={isLocked} onChange={(e) => setParticipants((items) => items.map((item, i) => i === index ? { ...item, study_program_snapshot: e.target.value } : item))} />
          <Input placeholder="ระดับการศึกษา" value={participant.study_level_snapshot} disabled={isLocked} onChange={(e) => setParticipants((items) => items.map((item, i) => i === index ? { ...item, study_level_snapshot: e.target.value } : item))} />
          <Button type="button" variant="ghost" disabled={isLocked} onClick={() => setParticipants((items) => items.filter((_, i) => i !== index))}><Trash2 /> ลบผู้เข้าร่วม</Button>
        </div>)}{!isLocked ? <Button type="button" variant="outline" onClick={addParticipant}><Plus /> เพิ่มผู้เข้าร่วม</Button> : null}</div>
      </section>

      <section className="mou-form-section"><div className="mou-form-section-heading"><span>5</span><div><h2><WalletCards /> งบประมาณ</h2><p>เพิ่มได้หลายแหล่งงบประมาณภายในรายการเดียว</p></div></div>
        <div className="space-y-3">{funding.map((item, index) => <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-border p-3" key={index}>
          <Input placeholder="ประเภทงบ" value={item.budget_type} disabled={isLocked} onChange={(e) => setFunding((items) => items.map((value, i) => i === index ? { ...value, budget_type: e.target.value } : value))} />
          <Input placeholder="แหล่งงบประมาณ" value={item.source_name} disabled={isLocked} onChange={(e) => setFunding((items) => items.map((value, i) => i === index ? { ...value, source_name: e.target.value } : value))} />
          <Input type="number" min="0" placeholder="จำนวนเงิน" value={item.amount} disabled={isLocked} onChange={(e) => setFunding((items) => items.map((value, i) => i === index ? { ...value, amount: e.target.value } : value))} />
          <Button type="button" variant="ghost" disabled={isLocked} onClick={() => setFunding((items) => items.filter((_, i) => i !== index))}><Trash2 /> ลบ</Button>
        </div>)}{!isLocked ? <Button type="button" variant="outline" onClick={addFunding}><Plus /> เพิ่มแหล่งงบ</Button> : null}</div>
      </section>

      <section className="mou-form-section"><div className="mou-form-section-heading"><span>6</span><div><h2>หมายเหตุภายใน</h2><p>ข้อมูลส่วนนี้ไม่แสดงใน Public Portal</p></div></div><textarea name="internal_note" defaultValue={mobility?.internal_note ?? ""} disabled={isLocked} rows={4} /></section>
      {state.error ? <p className="mou-form-message is-error">{state.error}</p> : null}
      {state.success ? <p className="mou-form-message is-success"><CheckCircle2 /> บันทึกข้อมูลเรียบร้อย</p> : null}
      {!isLocked ? <div className="mou-form-actions"><Button name="intent" value="draft" type="submit" disabled={pending} variant="outline"><Save /> บันทึกร่าง</Button><Button name="intent" value="review" type="submit" disabled={pending}><FileCheck2 /> บันทึกและส่งตรวจ</Button></div> : null}
    </form>
  </main>;
}

function OutputYear({ value }: { value: string }) { return <Input readOnly value={value} placeholder="คำนวณจากวันเริ่มเดินทาง" />; }
