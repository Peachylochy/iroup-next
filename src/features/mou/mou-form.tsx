"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileCheck2, Plus, Save, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";

import { submitMouForm, type MouFormState } from "./actions";
import type { MouFormAgreement, MouFormOptions } from "./mou-query";

type Props = {
  access: CurrentUserAccess;
  agreement: MouFormAgreement | null;
  options: MouFormOptions;
  preselectedPartnerId?: string;
};

type PartnerSelection = { id: string; isLead: boolean };
type UnitSelection = { id: string; isOwner: boolean };

const initialState: MouFormState = {};

function thaiFiscalYear(value: string) {
  if (!value) return "";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return "";
  return String(year + 543 + (month >= 10 ? 1 : 0));
}

function formStatus(agreement: MouFormAgreement | null) {
  if (!agreement) return "กำลังสร้างร่างใหม่";
  if (agreement.workflow_status === "under_review") return "รอตรวจสอบ";
  if (agreement.workflow_status === "active") return "เผยแพร่แล้ว";
  return "ฉบับร่าง";
}

function partnerLabel(partner: MouFormOptions["partners"][number]) {
  return partner.name_th || partner.name_en || "องค์กรที่ยังไม่มีชื่อ";
}

function PartnerSelections({
  options, selections, onChange, disabled,
}: {
  options: MouFormOptions["partners"];
  selections: PartnerSelection[];
  onChange: (next: PartnerSelection[]) => void;
  disabled: boolean;
}) {
  const selectedIds = new Set(selections.map((item) => item.id));
  const available = options.filter((item) => !selectedIds.has(item.id));
  const selected = selections.flatMap((selection) => {
    const partner = options.find((option) => option.id === selection.id);
    return partner ? [{ selection, partner }] : [];
  });

  return <div className="mou-relation-control">
    <select
      aria-label="เพิ่มองค์กรคู่ความร่วมมือ"
      defaultValue=""
      disabled={disabled || available.length === 0}
      onChange={(event) => {
        const id = event.target.value;
        if (!id) return;
        onChange([...selections, { id, isLead: selections.length === 0 }]);
        event.currentTarget.value = "";
      }}
    >
      <option value="">{available.length ? "เลือกองค์กรเพื่อเพิ่ม" : "เพิ่มองค์กรครบตามที่เลือกแล้ว"}</option>
      {available.map((partner) => <option key={partner.id} value={partner.id}>{partnerLabel(partner)}</option>)}
    </select>
    <div className="mou-relation-list" aria-live="polite">
      {selected.length ? selected.map(({ selection, partner }) => <div className="mou-relation-card" key={partner.id}>
        <div>
          <strong>{partnerLabel(partner)}</strong>
          <span>{partner.countries ? `${partner.countries.name_th} (${partner.countries.name_en})` : "ยังไม่ระบุประเทศ — ส่งตรวจไม่ได้"}</span>
        </div>
        <div className="mou-relation-actions">
          <Button type="button" variant={selection.isLead ? "default" : "outline"} size="sm" disabled={disabled} onClick={() => onChange(selections.map((item) => ({ ...item, isLead: item.id === partner.id })))}>
            <Star /> {selection.isLead ? "องค์กรหลัก" : "ตั้งเป็นหลัก"}
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`ลบ ${partnerLabel(partner)}`} onClick={() => onChange(selections.filter((item) => item.id !== partner.id))}>
            <Trash2 />
          </Button>
        </div>
      </div>) : <p className="mou-relation-empty">ยังไม่ได้เลือกองค์กรคู่ความร่วมมือ</p>}
    </div>
  </div>;
}

function UnitSelections({
  options, selections, onChange, disabled,
}: {
  options: MouFormOptions["units"];
  selections: UnitSelection[];
  onChange: (next: UnitSelection[]) => void;
  disabled: boolean;
}) {
  const selectedIds = new Set(selections.map((item) => item.id));
  const available = options.filter((item) => !selectedIds.has(item.id));
  const selected = selections.flatMap((selection) => {
    const unit = options.find((option) => option.id === selection.id);
    return unit ? [{ selection, unit }] : [];
  });

  return <div className="mou-relation-control">
    <select
      aria-label="เพิ่มหน่วยงาน ม.พะเยา"
      defaultValue=""
      disabled={disabled || available.length === 0}
      onChange={(event) => {
        const id = event.target.value;
        if (!id) return;
        onChange([...selections, { id, isOwner: selections.length === 0 }]);
        event.currentTarget.value = "";
      }}
    >
      <option value="">{available.length ? "เลือกหน่วยงานเพื่อเพิ่ม" : "เพิ่มหน่วยงานครบตามที่เลือกแล้ว"}</option>
      {available.map((unit) => <option key={unit.id} value={unit.id}>{unit.name_th}</option>)}
    </select>
    <div className="mou-relation-list" aria-live="polite">
      {selected.length ? selected.map(({ selection, unit }) => <div className="mou-relation-card" key={unit.id}>
        <div><strong>{unit.name_th}</strong><span>{selection.isOwner ? "หน่วยงานเจ้าของ" : "หน่วยงานเกี่ยวข้อง"}</span></div>
        <div className="mou-relation-actions">
          <Button type="button" variant={selection.isOwner ? "default" : "outline"} size="sm" disabled={disabled} onClick={() => onChange(selections.map((item) => ({ ...item, isOwner: item.id === unit.id })))}>
            <Star /> {selection.isOwner ? "หน่วยงานเจ้าของ" : "ตั้งเป็นเจ้าของ"}
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`ลบ ${unit.name_th}`} onClick={() => onChange(selections.filter((item) => item.id !== unit.id))}>
            <Trash2 />
          </Button>
        </div>
      </div>) : <p className="mou-relation-empty">ยังไม่ได้เลือกหน่วยงาน ม.พะเยา</p>}
    </div>
  </div>;
}

export function MouForm({ access, agreement, options, preselectedPartnerId }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitMouForm, initialState);
  const isLocked = agreement?.workflow_status === "under_review" || agreement?.workflow_status === "active";
  const [partners, setPartners] = useState<PartnerSelection[]>(() => agreement?.agreement_partners.map((item) => ({ id: item.partner_organization_id, isLead: item.is_lead })) ?? (preselectedPartnerId ? [{ id: preselectedPartnerId, isLead: true }] : []));
  const [units, setUnits] = useState<UnitSelection[]>(() => agreement?.agreement_units.map((item) => ({ id: item.organization_unit_id, isOwner: item.is_owner })) ?? []);
  const [startDate, setStartDate] = useState(agreement?.start_date ?? "");

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
        <input type="hidden" name="partners_json" value={JSON.stringify(partners)} />
        <input type="hidden" name="units_json" value={JSON.stringify(units)} />

        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>1</span><div><h2>ข้อมูลหลัก</h2><p>ข้อมูลขั้นต่ำสำหรับบันทึกร่างคือชื่อ MOU ภาษาไทย</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field mou-field-wide">ชื่อ MOU ภาษาไทย *<Input name="title_th" defaultValue={agreement?.title_th ?? ""} required disabled={isLocked} /></label>
            <label className="mou-field mou-field-wide">ชื่อ MOU ภาษาอังกฤษ<Input name="title_en" defaultValue={agreement?.title_en ?? ""} disabled={isLocked} /></label>
            <label className="mou-field">เลขที่ MOU<Input name="agreement_number" defaultValue={agreement?.agreement_number ?? ""} disabled={isLocked} /></label>
            <label className="mou-field">ประเภทข้อตกลง<Input name="agreement_type" placeholder="เช่น MOU, MOA" defaultValue={agreement?.agreement_type ?? ""} disabled={isLocked} /></label>
            <label className="mou-field">ปีงบประมาณ<Input name="fiscal_year" value={thaiFiscalYear(startDate)} readOnly placeholder="คำนวณจากวันเริ่ม" /></label>
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>2</span><div><h2>องค์กรและหน่วยงาน</h2><p>เพิ่มได้หลายรายการ แต่ต้องกำหนดองค์กรหลักและหน่วยงานเจ้าของอย่างละหนึ่งรายการก่อนส่งตรวจ</p></div></div>
          <div className="mou-form-grid">
            <div className="mou-field mou-field-wide"><span>องค์กรคู่ความร่วมมือ</span><PartnerSelections options={options.partners} selections={partners} onChange={setPartners} disabled={isLocked} />{!isLocked ? <Link className="form-helper-link" href={`/mou/organizations/new?returnTo=${encodeURIComponent(agreement ? `/mou/${agreement.id}/edit` : "/mou/new")}`}><Plus /> ไม่พบองค์กร? เพิ่มจากหนังสือฉบับนี้</Link> : null}</div>
            <div className="mou-field mou-field-wide"><span>หน่วยงาน ม.พะเยา</span><UnitSelections options={options.units} selections={units} onChange={setUnits} disabled={isLocked} /></div>
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>3</span><div><h2>วันสำคัญและหมายเหตุ</h2><p>วันสิ้นสุดไม่บังคับ; วันลงนามจำเป็นเมื่ออนุมัติและเผยแพร่</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field">วันลงนาม<Input type="date" name="signed_date" defaultValue={agreement?.signed_date ?? ""} disabled={isLocked} /></label>
            <label className="mou-field">วันเริ่มมีผล<Input type="date" name="start_date" value={startDate} onInput={(event) => setStartDate(event.currentTarget.value)} disabled={isLocked} /></label>
            <label className="mou-field">วันสิ้นสุด (ถ้ามี)<Input type="date" name="end_date" defaultValue={agreement?.end_date ?? ""} disabled={isLocked} /></label>
            <label className="mou-field mou-field-wide">หมายเหตุภายใน<textarea name="internal_note" defaultValue={agreement?.internal_note ?? ""} disabled={isLocked} rows={4} /></label>
          </div>
        </section>

        {state.error ? <p className="mou-form-message is-error">{state.error}</p> : null}
        {state.success ? <p className="mou-form-message is-success"><CheckCircle2 /> บันทึกข้อมูลเรียบร้อย</p> : null}

        <div className="mou-form-actions">
          {!isLocked ? <><Button name="intent" value="draft" type="submit" disabled={isPending} variant="outline"><Save /> บันทึกร่าง</Button><Button name="intent" value="review" type="submit" disabled={isPending}><FileCheck2 /> บันทึกและส่งตรวจ</Button></> : null}
          {agreement?.workflow_status === "under_review" && access.modules.mou?.publish ? <Button name="intent" value="publish" type="submit" disabled={isPending}><CheckCircle2 /> อนุมัติและเผยแพร่</Button> : null}
        </div>
      </form>
    </main>
  );
}
