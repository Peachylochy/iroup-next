"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, CircleAlert, Clock3, Plus } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";
import type { PartnerOrganization } from "./partner-query";

type Props = { access: CurrentUserAccess; partners: PartnerOrganization[]; viewer: { displayName: string; email: string; role: string } };

const status = {
  verified: { label: "ยืนยันแล้ว", icon: CheckCircle2 },
  pending_verification: { label: "รอตรวจสอบ", icon: Clock3 },
  incomplete: { label: "ข้อมูลไม่ครบ", icon: CircleAlert },
} as const;

export function PartnerWorkspace({ access, partners, viewer }: Props) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("th");
    return partners.filter((partner) => !term || [partner.name_th, partner.name_en, partner.countries[0]?.name_th, partner.countries[0]?.name_en].filter(Boolean).join(" ").toLocaleLowerCase("th").includes(term));
  }, [partners, query]);
  const canCreate = Boolean(access.modules.mou?.create);
  const canUpdate = Boolean(access.modules.mou?.update);

  return <WorkspaceChrome access={access} viewer={viewer} title="องค์กรคู่ความร่วมมือ" activePath="/mou/organizations" query={query} onQueryChange={setQuery} searchPlaceholder="ค้นหาชื่อองค์กรหรือประเทศ">
    <main className="module-main">
      <div className="module-page-heading"><div><p className="module-eyebrow">ความร่วมมือและ MOU</p><h1>องค์กรคู่ความร่วมมือ</h1><p>คลังข้อมูลองค์กรภายนอกสำหรับ MOU และการติดตามความร่วมมือ</p></div>
        {canCreate ? <Link className={cn(buttonVariants({ size: "lg" }))} href="/mou/organizations/new"><Plus data-icon="inline-start" /> เพิ่มองค์กร</Link> : null}
      </div>
      <div className="module-stat-strip"><div><span className="module-stat-icon"><Building2 /></span><span><strong>{partners.length}</strong><small>องค์กรทั้งหมด</small></span></div><div><span><strong>{partners.filter((p) => p.verification_status === "pending_verification").length}</strong><small>รอตรวจสอบ</small></span></div><div><span><strong>{partners.filter((p) => p.verification_status === "verified").length}</strong><small>ยืนยันแล้ว</small></span></div></div>
      <section className="module-list-card" aria-labelledby="partner-list-title"><div className="module-list-toolbar"><div><h2 id="partner-list-title">รายชื่อองค์กร</h2><p>ค้นหาก่อนสร้างรายการใหม่เพื่อป้องกันข้อมูลซ้ำ</p></div></div>
        {visible.length ? <div className="mou-list">{visible.map((partner) => { const state = status[partner.verification_status]; const Icon = state.icon; const country = partner.countries[0]; return <article className="mou-row" key={partner.id}><span className="mou-row-icon"><Building2 /></span><div className="mou-row-main"><div className="mou-row-title"><strong>{partner.name_th || partner.name_en}</strong>{partner.name_th && partner.name_en ? <small>{partner.name_en}</small> : null}</div><p>{[partner.organization_type, country?.name_th || country?.name_en, partner.city].filter(Boolean).join(" · ") || "ยังไม่มีรายละเอียดเพิ่มเติม"}</p></div><Badge className="mou-status"><Icon data-icon="inline-start" /> {state.label}</Badge>{canUpdate ? <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/mou/organizations/${partner.id}/edit`}>แก้ไข</Link> : null}</article>; })}</div> : <div className="module-empty-state"><span><Building2 /></span><h3>{partners.length ? "ไม่พบองค์กรที่ค้นหา" : "ยังไม่มีข้อมูลองค์กร"}</h3><p>{partners.length ? "ลองเปลี่ยนคำค้นหา หรือตรวจสอบชื่อภาษาอังกฤษ" : "เพิ่มข้อมูลจากหนังสือขอลงนาม หรือบันทึกองค์กรที่ประสานงานไว้ล่วงหน้า"}</p></div>}
      </section>
    </main>
  </WorkspaceChrome>;
}
