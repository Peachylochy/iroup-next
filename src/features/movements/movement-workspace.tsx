"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, MapPin, Plus, UsersRound } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import {
  staffMovementModules,
  type StaffMovementModule,
} from "./config";
import type { StaffMovementListItem } from "./movement-query";

const statusLabel = {
  draft: "ร่าง",
  under_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  active: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  archived: "เก็บถาวร",
};
const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "ยังไม่ระบุ";

export function StaffMovementWorkspace({
  module,
  access,
  items,
  viewer,
}: {
  module: StaffMovementModule;
  access: CurrentUserAccess;
  items: StaffMovementListItem[];
  viewer: { displayName: string; email: string; role: string };
}) {
  const config = staffMovementModules[module];
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th");
    return needle
      ? items.filter((item) =>
          [
            item.project_name,
            item.title_en,
            item.country_name_snapshot,
            item.partner_name_snapshot,
            item.organization_units?.name_th,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("th")
            .includes(needle),
        )
      : items;
  }, [items, query]);

  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title={config.title}
      activePath={config.route}
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder={`ค้นหา${config.title}`}
    >
      <main className="module-main">
        <div className="module-page-heading">
          <div>
            <p className="module-eyebrow">การเดินทางและ Mobility</p>
            <h1>{config.title}</h1>
            <p>{config.description}</p>
          </div>
          {access.modules[config.permission]?.create ? (
            <Link
              className={cn(buttonVariants({ size: "lg" }))}
              href={`${config.route}/new`}
            >
              <Plus /> เพิ่ม{config.itemLabel}
            </Link>
          ) : null}
        </div>
        <div className="module-stat-strip">
          <div>
            <span className="module-stat-icon">
              <BriefcaseBusiness />
            </span>
            <span>
              <strong>{items.length}</strong>
              <small>รายการทั้งหมด</small>
            </span>
          </div>
          <div>
            <span>
              <strong>
                {items.filter((item) => item.workflow_status === "active").length}
              </strong>
              <small>กำลังดำเนินการ</small>
            </span>
          </div>
          <div>
            <span>
              <strong>
                {
                  items.filter(
                    (item) => item.workflow_status === "under_review",
                  ).length
                }
              </strong>
              <small>รอตรวจสอบ</small>
            </span>
          </div>
        </div>
        <section className="module-list-card">
          <div className="module-list-toolbar">
            <div>
              <h2>รายการ{config.title}</h2>
              <p>ข้อมูลจริงจาก Supabase และ Data Master กลาง</p>
            </div>
            <Badge variant="outline">{shown.length} รายการ</Badge>
          </div>
          {shown.length ? (
            <div className="mou-list">
              {shown.map((item) => (
                <article className="mou-row" key={item.id}>
                  <span className="mou-row-icon">
                    <BriefcaseBusiness />
                  </span>
                  <div className="mou-row-main">
                    <div className="mou-row-title">
                      <strong>{item.project_name}</strong>
                      <small>
                        {item.partner_name_snapshot ||
                          item.organization_units?.name_th ||
                          "ยังไม่ระบุองค์กร"}
                      </small>
                    </div>
                    <p>
                      <MapPin /> {item.country_name_snapshot || "ยังไม่ระบุประเทศ"} ·{" "}
                      <UsersRound /> {item.participant_count} คน
                    </p>
                  </div>
                  <div className="mou-row-period">
                    <small>ระยะเวลา</small>
                    <strong>
                      {formatDate(item.start_date)} – {formatDate(item.end_date)}
                    </strong>
                  </div>
                  <Badge className="mou-status">
                    {statusLabel[item.workflow_status]}
                  </Badge>
                  <Link
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                    href={`${config.route}/${item.id}`}
                  >
                    ดูรายละเอียด <ArrowRight />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="module-empty-state">
              <span>
                <BriefcaseBusiness />
              </span>
              <h3>
                {items.length
                  ? "ไม่พบรายการที่ค้นหา"
                  : `ยังไม่มี${config.title}`}
              </h3>
              <p>
                {items.length
                  ? "ลองเปลี่ยนคำค้นหา"
                  : `เพิ่ม${config.itemLabel}รายการแรกเพื่อเริ่มใช้งาน`}
              </p>
            </div>
          )}
        </section>
      </main>
    </WorkspaceChrome>
  );
}
