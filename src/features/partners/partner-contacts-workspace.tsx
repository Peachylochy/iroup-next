"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Search,
  UserCheck,
  Users,
} from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import type { PartnerContact } from "./partner-query";

type Props = {
  access: CurrentUserAccess;
  contacts: PartnerContact[];
  viewer: { displayName: string; email: string; role: string };
};

const relationshipRatingMap = {
  high: { label: "ระดับสูง (High)", className: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" },
  medium: { label: "ปานกลาง (Medium)", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  low: { label: "เริ่มต้น (Low)", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  unrated: { label: "ไม่ได้ระบุ", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export function PartnerContactsWorkspace({ access, contacts, viewer }: Props) {
  const [query, setQuery] = useState("");

  const visibleContacts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("th");
    if (!term) return contacts;

    return contacts.filter((c) => {
      const searchStr = [
        c.full_name,
        c.position_title,
        c.department,
        c.partner_organizations?.name_th,
        c.partner_organizations?.name_en,
        c.partner_organizations?.countries?.[0]?.name_th,
        c.partner_organizations?.countries?.[0]?.name_en,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th");

      return searchStr.includes(term);
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
    >
      <main className="module-main space-y-6">
        <div className="module-page-heading">
          <div>
            <p className="module-eyebrow">ความร่วมมือและ MOU</p>
            <h1>ผู้ติดต่อองค์กรต่างประเทศ</h1>
            <p>คลังรายชื่อบุคคลประสานงานระดับสถาบัน มหาวิทยาลัย และหน่วยงานต่างประเทศ</p>
          </div>
        </div>

        {/* Top Stat Strip */}
        <div className="module-stat-strip">
          <div>
            <span className="module-stat-icon">
              <Users />
            </span>
            <span>
              <strong>{contacts.length}</strong>
              <small>ผู้ติดต่อทั้งหมด</small>
            </span>
          </div>

          <div>
            <span>
              <strong>{contacts.filter((c) => c.relationship_level === "high").length}</strong>
              <small>ความสัมพันธ์ระดับสูง</small>
            </span>
          </div>

          <div>
            <span>
              <strong>
                {
                  new Set(contacts.map((c) => c.partner_organization_id)).size
                }
              </strong>
              <small>องค์กรคู่สัญญา</small>
            </span>
          </div>
        </div>

        {/* Main List */}
        <section className="module-list-card">
          <div className="module-list-toolbar">
            <div>
              <h2>รายชื่อผู้ติดต่อ</h2>
              <p>ค้นหาตามชื่อบุคคล, ตำแหน่ง, คณะ, หรือชื่อมหาวิทยาลัยต่างประเทศ</p>
            </div>

            <label className="module-search">
              <Search aria-hidden="true" />
              <span className="sr-only">ค้นหาผู้ติดต่อ</span>
              <Input
                type="search"
                placeholder="ค้นหาชื่อ, ตำแหน่ง, มหาวิทยาลัย"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {visibleContacts.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {visibleContacts.map((contact) => {
                const org = contact.partner_organizations;
                const country = org?.countries?.[0];
                const primaryEmail = contact.partner_contact_methods?.find((m) => m.method_type === "email")?.value;
                const primaryPhone = contact.partner_contact_methods?.find((m) => m.method_type === "phone")?.value;
                const rating = relationshipRatingMap[contact.relationship_level] || relationshipRatingMap.unrated;

                return (
                  <Card key={contact.id} className="border-border/60 hover:shadow-sm transition-all flex flex-col justify-between">
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <span className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-primary shrink-0" />
                            {contact.full_name}
                          </span>
                          <p className="text-muted-foreground truncate">
                            {[contact.position_title, contact.department].filter(Boolean).join(" · ") || "ไม่ระบุตำแหน่ง"}
                          </p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0 font-normal", rating.className)}>
                          {rating.label}
                        </Badge>
                      </div>

                      {/* Organization info */}
                      {org && (
                        <div className="bg-muted/40 p-2.5 rounded-lg space-y-1">
                          <Link
                            href={`/mou/organizations/${contact.partner_organization_id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <Building2 size={13} className="text-primary shrink-0" />
                            <span className="truncate">{org.name_th || org.name_en}</span>
                          </Link>
                          {country && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Globe size={12} /> {country.name_th || country.name_en}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Communication info */}
                      <div className="space-y-1 text-muted-foreground pt-1">
                        {primaryEmail && (
                          <p className="flex items-center gap-2 truncate">
                            <Mail size={13} className="text-primary shrink-0" />
                            <a href={`mailto:${primaryEmail}`} className="hover:underline text-foreground">
                              {primaryEmail}
                            </a>
                          </p>
                        )}
                        {primaryPhone && (
                          <p className="flex items-center gap-2">
                            <Phone size={13} className="text-primary shrink-0" />
                            <a href={`tel:${primaryPhone}`} className="hover:underline text-foreground">
                              {primaryPhone}
                            </a>
                          </p>
                        )}
                      </div>
                    </CardContent>

                    <div className="p-3 border-t border-border/40 bg-muted/20 flex justify-end">
                      <Link
                        href={`/mou/organizations/${contact.partner_organization_id}`}
                        className={buttonVariants({ variant: "ghost", size: "xs", className: "gap-1 text-primary" })}
                      >
                        ดูองค์กร <ExternalLink size={12} />
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="module-empty-state">
              <span>
                <Users />
              </span>
              <h3>{contacts.length ? "ไม่พบผู้ติดต่อที่ค้นหา" : "ยังไม่มีข้อมูลผู้ติดต่อต่างประเทศ"}</h3>
              <p>
                {contacts.length
                  ? "ลองเปลี่ยนคำค้นหาเป็นชื่อบุคคล ตำแหน่ง หรือชื่อมหาวิทยาลัย"
                  : "สามารถเพิ่มข้อมูลผู้ติดต่อได้จากหน้ารายละเอียดองค์กรคู่ความร่วมมือ"}
              </p>
            </div>
          )}
        </section>
      </main>
    </WorkspaceChrome>
  );
}
