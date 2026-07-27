"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileCheck2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";

import { submitMouForm, type MouFormState } from "./actions";
import type { MouFormAgreement, MouFormOptions } from "./mou-query";

type Props = {
  access: CurrentUserAccess;
  agreement: MouFormAgreement | null;
  options: MouFormOptions;
};

const initialState: MouFormState = {};

function formStatus(agreement: MouFormAgreement | null) {
  if (!agreement) return "กำลังสร้างร่างใหม่";
  if (agreement.workflow_status === "under_review") return "รอตรวจสอบ";
  if (agreement.workflow_status === "active") return "เผยแพร่แล้ว";
  return "ฉบับร่าง";
}

export function MouForm({ access, agreement, options }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitMouForm, initialState);
  const isLocked = agreement?.workflow_status === "under_review" || agreement?.workflow_status === "active";
  const selectedPartner = agreement?.agreement_partners.find((item) => item.is_lead)?.partner_organization_id;
  const selectedUnit = agreement?.agreement_units.find((item) => item.is_owner)?.organization_unit_id;

  useEffect(() => {
    if (state.id && !agreement) {
      router.replace(`/mou/${state.id}/edit`);
      return;
    }
    if (state.success) router.refresh();
  }, [agreement, router, state.id, state.success]);

  return (
    <main className="module-main mou-form-page">
      <div className="module-page-heading">
        <div>
          <Link className="back-link" href="/mou"><ArrowLeft /> กลับไปรายการ MOU</Link>
          <p className="module-eyebrow">ความร่วมมือและ MOU</p>
          <h1>{agreement ? "แก้ไข MOU" : "เพิ่ม MOU"}</h1>
          <p>บันทึกเป็นร่างก่อน แล้วส่งตรวจเมื่อข้อมูลและคู่ความร่วมมือครบถ้วน</p>
        </div>
        <span className="workflow-state"><FileCheck2 /> {formStatus(agreement)}</span>
      </div>

      <form action={formAction} className="mou-editor-form">
        <input type="hidden" name="agreement_id" value={agreement?.id ?? ""} />
        <input type="hidden" name="updated_at" value={agreement?.updated_at ?? ""} />

        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>1</span><div><h2>ข้อมูลหลัก</h2><p>ข้อมูลขั้นต่ำสำหรับบันทึกร่างคือชื่อ MOU ภาษาไทย</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field mou-field-wide">ชื่อ MOU ภาษาไทย *
              <Input name="title_th" defaultValue={agreement?.title_th ?? ""} required disabled={isLocked} />
            </label>
            <label className="mou-field mou-field-wide">ชื่อ MOU ภาษาอังกฤษ
              <Input name="title_en" defaultValue={agreement?.title_en ?? ""} disabled={isLocked} />
            </label>
            <label className="mou-field">เลขที่ MOU
              <Input name="agreement_number" defaultValue={agreement?.agreement_number ?? ""} disabled={isLocked} />
            </label>
            <label className="mou-field">ประเภทข้อตกลง
              <Input name="agreement_type" placeholder="เช่น MOU, MOA" defaultValue={agreement?.agreement_type ?? ""} disabled={isLocked} />
            </label>
            <label className="mou-field">ปีงบประมาณ
              <Input name="fiscal_year" inputMode="numeric" placeholder="2569" defaultValue={agreement?.fiscal_year ?? ""} disabled={isLocked} />
            </label>
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>2</span><div><h2>องค์กรและหน่วยงาน</h2><p>ต้องเลือกองค์กรหลักและหน่วยงานเจ้าของก่อนส่งตรวจ</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field mou-field-wide">องค์กรคู่ความร่วมมือหลัก
              <select name="partner_id" defaultValue={selectedPartner ?? ""} disabled={isLocked}>
                <option value="">เลือกองค์กรคู่ความร่วมมือ</option>
                {options.partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name_th || partner.name_en}</option>)}
              </select>
            </label>
            <label className="mou-field mou-field-wide">หน่วยงานเจ้าของ
              <select name="owner_unit_id" defaultValue={selectedUnit ?? ""} disabled={isLocked}>
                <option value="">เลือกหน่วยงานเจ้าของ</option>
                {options.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name_th}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>3</span><div><h2>วันสำคัญและหมายเหตุ</h2><p>วันลงนามจำเป็นเมื่ออนุมัติและเผยแพร่</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field">วันลงนาม<Input type="date" name="signed_date" defaultValue={agreement?.signed_date ?? ""} disabled={isLocked} /></label>
            <label className="mou-field">วันเริ่มมีผล<Input type="date" name="start_date" defaultValue={agreement?.start_date ?? ""} disabled={isLocked} /></label>
            <label className="mou-field">วันสิ้นสุด<Input type="date" name="end_date" defaultValue={agreement?.end_date ?? ""} disabled={isLocked} /></label>
            <label className="mou-field mou-field-wide">หมายเหตุภายใน<textarea name="internal_note" defaultValue={agreement?.internal_note ?? ""} disabled={isLocked} rows={4} /></label>
          </div>
        </section>

        {state.error ? <p className="mou-form-message is-error">{state.error}</p> : null}
        {state.success ? <p className="mou-form-message is-success"><CheckCircle2 /> บันทึกข้อมูลเรียบร้อย</p> : null}

        <div className="mou-form-actions">
          {!isLocked ? <>
            <Button name="intent" value="draft" type="submit" disabled={isPending} variant="outline"><Save /> บันทึกร่าง</Button>
            <Button name="intent" value="review" type="submit" disabled={isPending}><FileCheck2 /> บันทึกและส่งตรวจ</Button>
          </> : null}
          {agreement?.workflow_status === "under_review" && access.modules.mou?.publish ? (
            <Button name="intent" value="publish" type="submit" disabled={isPending}><CheckCircle2 /> อนุมัติและเผยแพร่</Button>
          ) : null}
        </div>
      </form>
    </main>
  );
}
