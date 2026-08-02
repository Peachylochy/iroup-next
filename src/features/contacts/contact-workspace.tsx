"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ContactRound, Mail, Phone, Plus } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CurrentUserAccess } from "@/lib/auth/access";

import type { PartnerContact } from "./contact-query";

type Props = {
  access: CurrentUserAccess;
  contacts: PartnerContact[];
  viewer: { displayName: string; email: string; role: string };
};

const relationshipLabel = {
  unrated: "ยังไม่ประเมิน",
  low: "เริ่มต้น",
  medium: "ประสานงานต่อเนื่อง",
  high: "ความสัมพันธ์สูง",
} as const;

export function ContactWorkspace({ access, contacts, viewer }: Props) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th");
    if (!needle) return contacts;
    return contacts.filter((contact) => {
      const organization = contact.partner_organizations?.name_th || contact.partner_organizations?.name_en || "";
      const methods = contact.partner_contact_methods.map((method) => method.value).join(" ");
      return [contact.full_name, contact.position_title, organization, methods]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th")
        .includes(needle);
    });
  }, [contacts, query]);

  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title="ผู้ติดต่อองค์กรต่างประเทศ"
      activePath="/mou/contacts"
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="ค้นหาชื่อ องค์กร อีเมล หรือโทรศัพท์"
    >
      <main className="module-main">
        <div className="module-page-heading">
          <div>
            <p className="module-eyebrow">ข้อมูลภายใน · ความร่วมมือและ MOU</p>
            <h1>ผู้ติดต่อองค์กรต่างประเทศ</h1>
            <p>สมุดรายชื่อภายในสำหรับติดตามผู้ประสานงาน ความสัมพันธ์ และช่องทางติดต่อ</p>
          </div>
          {access.modules.mou?.create ? (
            <Link className={cn(buttonVariants({ size: "lg" }))} href="/mou/contacts/new">
              <Plus /> เพิ่มผู้ติดต่อ
            </Link>
          ) : null}
        </div>
        <section className="module-list-card">
          <div className="module-list-toolbar">
            <div>
              <h2>รายชื่อผู้ติดต่อ</h2>
              <p>ข้อมูลนี้ไม่แสดงใน Public Portal</p>
            </div>
            <Badge variant="outline">{shown.length} ราย</Badge>
          </div>
          {shown.length ? (
            <div className="mou-list">
              {shown.map((contact) => {
                const emails = contact.partner_contact_methods.filter((method) => method.method_type === "email");
                const phones = contact.partner_contact_methods.filter((method) => method.method_type === "phone");
                const organization = contact.partner_organizations?.name_th || contact.partner_organizations?.name_en || "ยังไม่ระบุองค์กร";
                const country = contact.partner_organizations?.countries?.name_th || contact.partner_organizations?.countries?.name_en;
                return (
                  <article className="mou-row" key={contact.id}>
                    <span className="mou-row-icon"><ContactRound /></span>
                    <div className="mou-row-main">
                      <div className="mou-row-title">
                        <strong>{contact.full_name}</strong>
                        <small>{contact.position_title || contact.department || "ยังไม่ระบุตำแหน่ง"}</small>
                      </div>
                      <p>{organization}{country ? ` · ${country}` : ""}</p>
                      <p className="flex flex-wrap gap-3">
                        {emails.map((email) => <span key={email.id}><Mail /> {email.value}</span>)}
                        {phones.map((phone) => <span key={phone.id}><Phone /> {phone.value}</span>)}
                      </p>
                    </div>
                    <Badge className="mou-status">{relationshipLabel[contact.relationship_level]}</Badge>
                    {access.modules.mou?.update ? (
                      <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/mou/contacts/${contact.id}/edit`}>
                        แก้ไข
                      </Link>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="module-empty-state">
              <span><ContactRound /></span>
              <h3>{contacts.length ? "ไม่พบผู้ติดต่อที่ค้นหา" : "ยังไม่มีข้อมูลผู้ติดต่อ"}</h3>
              <p>{contacts.length ? "ลองเปลี่ยนคำค้นหา" : "เพิ่มรายชื่อใหม่หรือนำเข้าจากไฟล์เดิม"}</p>
            </div>
          )}
        </section>
      </main>
    </WorkspaceChrome>
  );
}
