"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpenText, CalendarDays, GraduationCap, Megaphone, Plus } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { contentModules, type ContentModule } from "./config";
import type { ContentRecord } from "./content-query";

const icons = {
  scholarship: GraduationCap,
  events: CalendarDays,
  news: Megaphone,
  knowledge: BookOpenText,
};
const publicationLabel = { draft: "ร่าง", published: "เผยแพร่", archived: "เก็บถาวร" };

export function ContentWorkspace({
  module,
  access,
  records,
  viewer,
}: {
  module: ContentModule;
  access: CurrentUserAccess;
  records: ContentRecord[];
  viewer: { displayName: string; email: string; role: string };
}) {
  const [query, setQuery] = useState("");
  const config = contentModules[module];
  const Icon = icons[module];
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th");
    return needle
      ? records.filter((record) => [record.title_th, record.title_en, record.summary_th, record.category]
          .filter(Boolean).join(" ").toLocaleLowerCase("th").includes(needle))
      : records;
  }, [query, records]);

  return (
    <WorkspaceChrome access={access} viewer={viewer} title={config.title} activePath={config.route} query={query} onQueryChange={setQuery} searchPlaceholder={`ค้นหา${config.title}`}>
      <main className="module-main">
        <div className="module-page-heading">
          <div><p className="module-eyebrow">การเผยแพร่และข้อมูลบริการ</p><h1>{config.title}</h1><p>{config.description}</p></div>
          {access.modules[config.module]?.create ? <Link className={cn(buttonVariants({ size: "lg" }))} href={`${config.route}/new`}><Plus /> เพิ่ม{config.itemLabel}</Link> : null}
        </div>
        <section className="module-list-card">
          <div className="module-list-toolbar"><div><h2>รายการ{config.title}</h2><p>ข้อมูลจาก Supabase · แยกสถานะร่างและเผยแพร่</p></div><Badge variant="outline">{shown.length} รายการ</Badge></div>
          {shown.length ? <div className="mou-list">{shown.map((record) => (
            <article className="mou-row" key={record.id}>
              <span className="mou-row-icon"><Icon /></span>
              <div className="mou-row-main"><div className="mou-row-title"><strong>{record.title_th}</strong>{record.title_en ? <small>{record.title_en}</small> : null}</div><p>{record.summary_th || record.category || "ยังไม่มีคำอธิบายย่อ"}</p></div>
              <Badge className="mou-status">{publicationLabel[record.publication_status]}</Badge>
              {access.modules[config.module]?.update ? <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`${config.route}/${record.id}/edit`}>แก้ไข</Link> : null}
            </article>
          ))}</div> : <div className="module-empty-state"><span><Icon /></span><h3>{records.length ? "ไม่พบรายการที่ค้นหา" : `ยังไม่มี${config.title}`}</h3><p>{records.length ? "ลองเปลี่ยนคำค้นหา" : `เพิ่ม${config.itemLabel}รายการแรกเพื่อเริ่มใช้งานโมดูล`}</p></div>}
        </section>
      </main>
    </WorkspaceChrome>
  );
}
