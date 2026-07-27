"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { savePartnerOrganization, type PartnerFormState } from "./actions";
import type { PartnerFormOptions, PartnerOrganization } from "./partner-query";

type Props = { access: CurrentUserAccess; partner: PartnerOrganization | null; options: PartnerFormOptions; returnTo?: string };
const initialState: PartnerFormState = {};

export function PartnerOrganizationForm({ access, partner, options, returnTo }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(savePartnerOrganization, initialState);
  const canVerify = Boolean(access.modules.mou?.publish);
  const safeReturnTo = returnTo?.startsWith("/mou") ? returnTo : undefined;

  useEffect(() => {
    if (!state.success || !state.id) return;
    if (safeReturnTo) {
      router.replace(`${safeReturnTo}${safeReturnTo.includes("?") ? "&" : "?"}partner=${state.id}`);
      return;
    }
    if (!partner) router.replace(`/mou/organizations/${state.id}/edit`);
    else router.refresh();
  }, [partner, router, safeReturnTo, state.id, state.success]);

  return (
    <main className="module-main mou-form-page">
      <div className="module-page-heading">
        <div>
          <Link className="back-link" href={safeReturnTo || "/mou/organizations"}><ArrowLeft /> กลับ</Link>
          <p className="module-eyebrow">ความร่วมมือและ MOU</p>
          <h1>{partner ? "แก้ไของค์กรคู่ความร่วมมือ" : "เพิ่มองค์กรคู่ความร่วมมือ"}</h1>
          <p>บันทึกข้อมูลขั้นต่ำจากหนังสือได้ทันที แล้วค่อยตรวจยืนยันให้เป็นข้อมูลกลาง</p>
        </div>
        <span className="workflow-state">{partner?.verification_status === "verified" ? "ยืนยันแล้ว" : "รอตรวจสอบ"}</span>
      </div>
      <form action={formAction} className="mou-editor-form">
        <input type="hidden" name="partner_id" value={partner?.id ?? ""} />
        <input type="hidden" name="updated_at" value={partner?.updated_at ?? ""} />
        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>1</span><div><h2>ข้อมูลองค์กร</h2><p>กรอกชื่ออย่างน้อยหนึ่งภาษาเพื่อสร้างรายการจากหนังสือได้</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field mou-field-wide">ชื่อองค์กรภาษาไทย<Input name="name_th" defaultValue={partner?.name_th ?? ""} /></label>
            <label className="mou-field mou-field-wide">ชื่อองค์กรภาษาอังกฤษ<Input name="name_en" defaultValue={partner?.name_en ?? ""} /></label>
            <label className="mou-field">ประเภทองค์กร<Input name="organization_type" placeholder="เช่น University, Embassy" defaultValue={partner?.organization_type ?? ""} /></label>
            <label className="mou-field">ประเทศ<select name="country_id" defaultValue={partner?.country_id ?? ""}><option value="">ยังไม่ระบุ</option>{options.countries.map((country) => <option key={country.id} value={country.id}>{country.name_th} ({country.name_en})</option>)}</select></label>
            <label className="mou-field">เมือง<Input name="city" defaultValue={partner?.city ?? ""} /></label>
            <label className="mou-field">เว็บไซต์<Input name="website_url" type="url" placeholder="https://" defaultValue={partner?.website_url ?? ""} /></label>
          </div>
        </section>
        <section className="mou-form-section">
          <div className="mou-form-section-heading"><span>2</span><div><h2>การตรวจสอบข้อมูล</h2><p>ใช้บันทึกที่มาของข้อมูลก่อนทำให้เป็นรายการยืนยัน</p></div></div>
          <div className="mou-form-grid">
            <label className="mou-field">สถานะข้อมูล<select name="verification_status" defaultValue={partner?.verification_status ?? "pending_verification"}><option value="pending_verification">รอตรวจสอบ</option><option value="incomplete">ข้อมูลไม่ครบ</option>{canVerify ? <option value="verified">ยืนยันแล้ว</option> : null}</select></label>
            <label className="mou-field mou-field-wide">แหล่งที่มา / หมายเหตุ<textarea name="source_note" rows={4} placeholder="เช่น หนังสือขอลงนามจากคณะ..." defaultValue={partner?.source_note ?? ""} /></label>
          </div>
        </section>
        {state.error ? <p className="mou-form-message is-error">{state.error}</p> : null}
        {state.success ? <p className="mou-form-message is-success"><CheckCircle2 /> บันทึกข้อมูลเรียบร้อย</p> : null}
        <div className="mou-form-actions"><Button type="submit" disabled={isPending}><Save /> บันทึกองค์กร</Button></div>
      </form>
    </main>
  );
}
