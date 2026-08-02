"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { MasterSearchSelect } from "@/components/forms/master-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { savePartnerContact, type ContactFormState } from "./actions";
import type { ContactFormOptions, PartnerContact } from "./contact-query";

const initialState: ContactFormState = {};

type Props = {
  contact: PartnerContact | null;
  options: ContactFormOptions;
};

function methodValue(contact: PartnerContact | null, type: string) {
  return contact?.partner_contact_methods
    .filter((method) => method.method_type === type)
    .map((method) => method.value)
    .join("; ") || "";
}

export function ContactForm({ contact, options }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(savePartnerContact, initialState);

  useEffect(() => {
    if (!state.success || !state.id) return;
    if (!contact) router.replace(`/mou/contacts/${state.id}/edit`);
    else router.refresh();
  }, [contact, router, state.id, state.success]);

  return (
    <main className="module-main mou-form-page">
      <div className="module-page-heading">
        <div>
          <Link className="back-link" href="/mou/contacts"><ArrowLeft /> กลับไปรายชื่อผู้ติดต่อ</Link>
          <p className="module-eyebrow">ข้อมูลภายใน · ความร่วมมือและ MOU</p>
          <h1>{contact ? "แก้ไขผู้ติดต่อ" : "เพิ่มผู้ติดต่อองค์กรต่างประเทศ"}</h1>
          <p>จัดเก็บช่องทางติดต่อและข้อมูลติดตาม โดยไม่เผยแพร่ต่อสาธารณะ</p>
        </div>
      </div>
      <form action={formAction} className="mou-editor-form">
        <input type="hidden" name="contact_id" value={contact?.id || ""} />
        <input type="hidden" name="updated_at" value={contact?.updated_at || ""} />
        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>1</span><div><h2>บุคคลและองค์กร</h2><p>เลือกองค์กรจาก Data Master เพื่อให้ข้อมูลเชื่อมกันทั้งระบบ</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field mou-field-wide">
              องค์กร
              <MasterSearchSelect
                name="partner_organization_id"
                value={contact?.partner_organization_id || ""}
                placeholder="ค้นหาองค์กร"
                required
                options={options.partners.map((partner) => ({
                  value: partner.id,
                  label: partner.name_th || partner.name_en || "องค์กรไม่มีชื่อ",
                  description: partner.countries?.name_th || partner.countries?.name_en,
                }))}
              />
            </label>
            <label className="mou-field mou-field-wide">ชื่อ-นามสกุล<Input name="full_name" defaultValue={contact?.full_name || ""} required /></label>
            <label className="mou-field">ตำแหน่ง<Input name="position_title" defaultValue={contact?.position_title || ""} /></label>
            <label className="mou-field">หน่วยงานย่อย / ภาควิชา<Input name="department" defaultValue={contact?.department || ""} /></label>
            <label className="mou-field mou-field-wide">สาขาความเชี่ยวชาญ<Input name="expertise_areas" defaultValue={contact?.expertise_areas.join(", ") || ""} placeholder="คั่นหลายรายการด้วยเครื่องหมายจุลภาค" /></label>
          </div>
        </section>
        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>2</span><div><h2>ช่องทางติดต่อ</h2><p>ข้อมูลภายในและค้นหาได้จากหน้ารายการ</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field">อีเมล<Input name="email" type="text" defaultValue={methodValue(contact, "email")} placeholder="คั่นหลายค่าโดยใช้ ;" /></label>
            <label className="mou-field">โทรศัพท์<Input name="phone" defaultValue={methodValue(contact, "phone")} placeholder="คั่นหลายค่าโดยใช้ ;" /></label>
            <label className="mou-field">ช่องทางแชต<Input name="messaging" defaultValue={methodValue(contact, "messaging")} placeholder="LINE / WeChat / WhatsApp" /></label>
            <label className="mou-field">ภาษาที่สะดวก<Input name="preferred_language" defaultValue={contact?.preferred_language || ""} /></label>
          </div>
        </section>
        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>3</span><div><h2>การติดตามความสัมพันธ์</h2><p>ช่วยให้เจ้าหน้าที่คนถัดไปเห็นบริบทล่าสุด</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field">ระดับความสัมพันธ์<select name="relationship_level" defaultValue={contact?.relationship_level || "unrated"}><option value="unrated">ยังไม่ประเมิน</option><option value="low">เริ่มต้น</option><option value="medium">ประสานงานต่อเนื่อง</option><option value="high">ความสัมพันธ์สูง</option></select></label>
            <label className="mou-field">วันที่ติดต่อล่าสุด<Input name="last_contacted_on" type="date" defaultValue={contact?.last_contacted_on || ""} /></label>
            <label className="mou-field mou-field-wide">หมายเหตุภายใน<textarea name="internal_note" rows={5} defaultValue={contact?.internal_note || ""} /></label>
            <label className="mou-field"><span className="flex items-center gap-2"><input name="active" type="checkbox" defaultChecked={contact?.active ?? true} /> ใช้งานรายชื่อนี้</span></label>
          </div>
        </section>
        {state.error ? <p className="mou-form-message is-error">{state.error}</p> : null}
        {state.success ? <p className="mou-form-message is-success"><CheckCircle2 /> บันทึกข้อมูลเรียบร้อย</p> : null}
        <div className="mou-form-actions"><Button type="submit" disabled={pending}><Save /> {pending ? "กำลังบันทึก" : "บันทึกผู้ติดต่อ"}</Button></div>
      </form>
    </main>
  );
}
