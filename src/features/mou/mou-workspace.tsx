"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FilePenLine,
  Filter,
  Handshake,
  Plus,
  Search,
} from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import type { MouAgreement } from "./mou-query";

type Props = {
  access: CurrentUserAccess;
  agreements: MouAgreement[];
  viewer: {
    displayName: string;
    email: string;
    role: string;
  };
};

const statusOptions = [
  { value: "all", label: "ทั้งหมด" },
  { value: "draft", label: "ร่าง" },
  { value: "active", label: "ใช้งานอยู่" },
  { value: "expired", label: "หมดอายุ" },
] as const;

const statusLabels: Record<MouAgreement["status"], string> = {
  draft: "ร่าง",
  active: "ใช้งานอยู่",
  expired: "หมดอายุ",
  terminated: "ยุติแล้ว",
};

function formatDate(value: string | null) {
  if (!value) return "ไม่ระบุ";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function partnerName(agreement: MouAgreement) {
  const partner =
    agreement.agreement_partners.find((item) => item.is_lead)
      ?.partner_organizations[0] ??
    agreement.agreement_partners[0]?.partner_organizations[0];
  return partner?.name_th || partner?.name_en || "ยังไม่ระบุองค์กรคู่ความร่วมมือ";
}

export function MouWorkspace({ access, agreements, viewer }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>(
    "all",
  );

  const filteredAgreements = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return agreements.filter((agreement) => {
      const matchesStatus = status === "all" || agreement.status === status;
      const haystack = [
        agreement.agreement_number,
        agreement.title_th,
        agreement.title_en,
        agreement.agreement_type,
        partnerName(agreement),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th");
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [agreements, query, status]);

  const canCreate = Boolean(access.modules.mou?.create);
  const canUpdate = Boolean(access.modules.mou?.update);

  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title="ความร่วมมือและ MOU"
      activePath="/mou"
      query={query}
      onQueryChange={setQuery}
    >
      <main className="module-main">
        <div className="module-page-heading">
          <div>
            <p className="module-eyebrow">ความร่วมมือและ MOU</p>
            <h1>ข้อตกลงความร่วมมือ</h1>
            <p>
              จัดการวงจรชีวิต MOU ตั้งแต่ร่าง ตรวจสอบ ลงนาม และติดตามวันสิ้นสุด
            </p>
          </div>
          {canCreate ? (
            <Button size="lg" disabled>
              <Plus data-icon="inline-start" />
              เพิ่ม MOU
            </Button>
          ) : null}
        </div>

        <div className="module-stat-strip">
          <div>
            <span className="module-stat-icon"><Handshake /></span>
            <span>
              <strong>{agreements.length}</strong>
              <small>MOU ทั้งหมด</small>
            </span>
          </div>
          <div>
            <span>
              <strong>{agreements.filter((item) => item.status === "active").length}</strong>
              <small>ใช้งานอยู่</small>
            </span>
          </div>
          <div>
            <span>
              <strong>{agreements.filter((item) => item.status === "draft").length}</strong>
              <small>รอตรวจสอบ</small>
            </span>
          </div>
        </div>

        <section className="module-list-card" aria-labelledby="mou-list-title">
          <div className="module-list-toolbar">
            <div>
              <h2 id="mou-list-title">รายการ MOU</h2>
              <p>ข้อมูลจาก Supabase · แสดงเฉพาะรายการที่ยังไม่ถูกลบ</p>
            </div>
            <label className="module-search">
              <Search aria-hidden="true" />
              <span className="sr-only">ค้นหารายการ MOU</span>
              <Input
                type="search"
                placeholder="ค้นหาชื่อ MOU หรือองค์กร"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="module-filter-row" role="group" aria-label="กรองสถานะ MOU">
            <Filter aria-hidden="true" />
            {statusOptions.map((option) => (
              <button
                className={cn("filter-pill", status === option.value && "is-selected")}
                key={option.value}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {filteredAgreements.length > 0 ? (
            <div className="mou-list">
              {filteredAgreements.map((agreement) => (
                <article className="mou-row" key={agreement.id}>
                  <span className="mou-row-icon"><FilePenLine /></span>
                  <div className="mou-row-main">
                    <div className="mou-row-title">
                      <strong>{agreement.title_th}</strong>
                      {agreement.agreement_number ? (
                        <small>{agreement.agreement_number}</small>
                      ) : null}
                    </div>
                    <p>{partnerName(agreement)} · {agreement.agreement_type}</p>
                  </div>
                  <div className="mou-row-period">
                    <small>ระยะเวลา</small>
                    <strong>
                      {formatDate(agreement.start_date)} – {formatDate(agreement.end_date)}
                    </strong>
                  </div>
                  <Badge className={cn("mou-status", "mou-status-" + agreement.status)}>
                    {statusLabels[agreement.status]}
                  </Badge>
                  {canUpdate ? (
                    <Button variant="outline" size="sm" disabled>
                      แก้ไข
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="module-empty-state">
              <span><Handshake /></span>
              <h3>
                {agreements.length === 0
                  ? "ยังไม่มีข้อมูล MOU"
                  : "ไม่พบรายการที่ค้นหา"}
              </h3>
              <p>
                {agreements.length === 0
                  ? "เมื่อเริ่มบันทึก MOU รายการจะปรากฏในหน้านี้"
                  : "ลองเปลี่ยนคำค้นหาหรือสถานะที่เลือก"}
              </p>
              {agreements.length === 0 ? (
                <Link className="panel-link" href="#mou-list-title">
                  ดูโครงสร้างรายการ <ArrowRight aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </WorkspaceChrome>
  );
}
