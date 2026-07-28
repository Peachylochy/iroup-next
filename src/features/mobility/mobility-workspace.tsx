"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ExternalLink,
  GraduationCap,
  Plus,
  Search,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { MobilityFormDialog } from "./mobility-form-dialog";
import type {
  MobilityFormOptions,
  MovementCase,
  MovementCategory,
} from "./mobility-query";

type Props = {
  access: CurrentUserAccess;
  cases: MovementCase[];
  options: MobilityFormOptions;
  initialCategory?: string;
  viewer: { displayName: string; email: string; role: string };
};

const categoryMap: Record<MovementCategory, { label: string; icon: LucideIcon }> = {
  student_exchange: { label: "Mobility นิสิต", icon: GraduationCap },
  staff_exchange: { label: "Mobility บุคลากร", icon: UsersRound },
  staff_official_travel: { label: "เดินทางไปปฏิบัติงาน", icon: BriefcaseBusiness },
};

export function MobilityWorkspace({
  access,
  cases,
  options,
  initialCategory,
  viewer,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || "all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const canCreate = Boolean(access.modules.mobility?.create || access.modules.mou?.create);

  const visibleCases = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("th");

    return cases.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }

      if (!term) return true;

      const searchStr = [
        item.title_th,
        item.title_en,
        item.partner_organizations?.name_th,
        item.partner_organizations?.name_en,
        item.organization_units?.name_th,
        item.activity_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th");

      return searchStr.includes(term);
    });
  }, [cases, query, selectedCategory]);

  const totalParticipants = useMemo(() => {
    return cases.reduce((acc, curr) => acc + (curr.movement_participants?.length || 1), 0);
  }, [cases]);

  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title="การเดินทางและ Mobility"
      activePath="/mobility"
      query={query}
      onQueryChange={setQuery}
    >
      <main className="module-main space-y-6">
        {/* Page Heading */}
        <div className="module-page-heading">
          <div>
            <p className="module-eyebrow">การเดินทางและ Mobility</p>
            <h1>การเดินทางแลกเปลี่ยนและปฏิบัติงานต่างประเทศ</h1>
            <p>ติดตามการแลกเปลี่ยนนิสิต อาจารย์ บุคลากรวิจัย และการเดินทางไปปฏิบัติงานต่างประเทศ</p>
          </div>

          {canCreate && (
            <Button size="lg" onClick={() => setDialogOpen(true)} className="gap-1">
              <Plus size={16} /> บันทึกการเดินทาง / Mobility
            </Button>
          )}
        </div>

        {/* Top Stat Strip */}
        <div className="module-stat-strip">
          <div>
            <span className="module-stat-icon">
              <GraduationCap />
            </span>
            <span>
              <strong>{cases.length}</strong>
              <small>รายการเดินทางทั้งหมด</small>
            </span>
          </div>

          <div>
            <span>
              <strong>{totalParticipants}</strong>
              <small>จำนวนผู้เดินทาง (คน)</small>
            </span>
          </div>

          <div>
            <span>
              <strong>{cases.filter((c) => c.direction === "inbound").length}</strong>
              <small>Inbound (รับเข้ามา)</small>
            </span>
          </div>

          <div>
            <span>
              <strong>{cases.filter((c) => c.direction === "outbound").length}</strong>
              <small>Outbound (ส่งไปต่างประเทศ)</small>
            </span>
          </div>
        </div>

        {/* List Section with Category Tabs */}
        <section className="module-list-card">
          <div className="border-b border-border/60 px-4 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-4 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={cn(
                  "pb-3 text-xs font-medium border-b-2 transition-colors shrink-0",
                  selectedCategory === "all"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                ทั้งหมด ({cases.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("student_exchange")}
                className={cn(
                  "pb-3 text-xs font-medium border-b-2 transition-colors shrink-0 flex items-center gap-1.5",
                  selectedCategory === "student_exchange"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <GraduationCap size={14} /> Mobility นิสิต ({cases.filter((c) => c.category === "student_exchange").length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("staff_exchange")}
                className={cn(
                  "pb-3 text-xs font-medium border-b-2 transition-colors shrink-0 flex items-center gap-1.5",
                  selectedCategory === "staff_exchange"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <UsersRound size={14} /> Mobility บุคลากร ({cases.filter((c) => c.category === "staff_exchange").length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory("staff_official_travel")}
                className={cn(
                  "pb-3 text-xs font-medium border-b-2 transition-colors shrink-0 flex items-center gap-1.5",
                  selectedCategory === "staff_official_travel"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <BriefcaseBusiness size={14} /> เดินทางไปปฏิบัติงาน ({cases.filter((c) => c.category === "staff_official_travel").length})
              </button>
            </div>

            <label className="module-search mb-2 sm:mb-0">
              <Search aria-hidden="true" />
              <span className="sr-only">ค้นหาโครงการ</span>
              <Input
                type="search"
                placeholder="ค้นหาชื่อโครงการ, มหาวิทยาลัย, คณะ"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {/* List items */}
          {visibleCases.length ? (
            <div className="divide-y divide-border/60">
              {visibleCases.map((item) => {
                const catInfo = categoryMap[item.category];
                const CatIcon = catInfo.icon;
                const partner = item.partner_organizations;
                const unit = item.organization_units;
                const participantsCount = item.movement_participants?.length || 1;

                return (
                  <article key={item.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[11px] gap-1 font-normal">
                          <CatIcon size={12} /> {catInfo.label}
                        </Badge>

                        {item.direction === "inbound" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] gap-0.5 border-emerald-200">
                            <ArrowDownLeft size={12} /> Inbound (รับเข้า)
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] gap-0.5 border-blue-200">
                            <ArrowUpRight size={12} /> Outbound (ส่งออก)
                          </Badge>
                        )}

                        {item.activity_type && (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.activity_type}
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-semibold text-sm text-foreground">
                        {item.title_th}
                      </h3>
                      {item.title_en && <p className="text-xs text-muted-foreground">{item.title_en}</p>}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                        {partner && (
                          <span className="flex items-center gap-1">
                            <Building2 size={13} className="text-primary" /> {partner.name_th || partner.name_en}
                          </span>
                        )}
                        {unit && (
                          <span className="flex items-center gap-1">
                            เจ้าของเรื่อง: <strong className="text-foreground">{unit.name_th}</strong>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users size={13} /> {participantsCount} คน
                        </span>
                        {(item.start_date || item.end_date) && (
                          <span className="flex items-center gap-1">
                            <Calendar size={13} /> {[item.start_date, item.end_date].filter(Boolean).join(" ถึง ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/mobility/${item.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1 text-xs" })}
                      >
                        รายละเอียด <ExternalLink size={12} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="module-empty-state">
              <span>
                <GraduationCap />
              </span>
              <h3>{cases.length ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีข้อมูลรายการ Mobility / การเดินทาง"}</h3>
              <p>
                {cases.length
                  ? "ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น"
                  : "คลิกที่ปุ่ม '+ บันทึกการเดินทาง / Mobility' เพื่อเริ่มสร้างรายการใหม่"}
              </p>
            </div>
          )}
        </section>
      </main>

      <MobilityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        options={options}
      />
    </WorkspaceChrome>
  );
}
