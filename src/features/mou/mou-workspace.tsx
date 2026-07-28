"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Eye,
  FilePenLine,
  Filter,
  Globe,
  Handshake,
  Plus,
  RotateCcw,
  Search,
  Building2,
  List,
  BarChart3,
} from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { processMouAnalytics } from "./mou-analytics-query";
import { exportMouToCsv } from "./mou-csv-export";
import { MouFacultyBreakdown } from "./mou-faculty-breakdown";
import type { MouAgreement } from "./mou-query";
import { MouWorldMap } from "./mou-world-map";

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
  { value: "expiring", label: "ใกล้หมดอายุ" },
  { value: "expired", label: "หมดอายุ" },
  { value: "terminated", label: "ยุติแล้ว" },
] as const;

const continentOptions = [
  { value: "all", label: "ทุกทวีป" },
  { value: "AS", label: "เอเชีย (Asia)" },
  { value: "EU", label: "ยุโรป (Europe)" },
  { value: "NA", label: "อเมริกาเหนือ (North America)" },
  { value: "SA", label: "อเมริกาใต้ (South America)" },
  { value: "OC", label: "ออสเตรเลีย/โอเชียเนีย (Oceania)" },
  { value: "AF", label: "แอฟริกา (Africa)" },
] as const;

const statusLabels: Record<MouAgreement["status"], string> = {
  draft: "ร่าง",
  active: "ใช้งานอยู่",
  expiring: "ใกล้หมดอายุ",
  expired: "หมดอายุ",
  terminated: "ยุติแล้ว",
};

function formatDate(value: string | null) {
  if (!value) return "ไม่ระบุ";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getLeadPartnerInfo(agreement: MouAgreement) {
  const partner =
    agreement.agreement_partners.find((item) => item.is_lead) ||
    agreement.agreement_partners[0];

  const org = partner?.partner_organizations;
  const name =
    partner?.partner_name_en_snapshot ||
    org?.name_en ||
    partner?.partner_name_th_snapshot ||
    org?.name_th ||
    "ยังไม่ระบุองค์กรคู่ความร่วมมือ";

  const country = partner?.country_name_th_snapshot || org?.countries?.name_th || "";
  const continentCode = org?.countries?.continent_code || "";

  return { name, country, continentCode };
}

function getOwnerUnitInfo(agreement: MouAgreement) {
  const unit =
    agreement.agreement_units.find((item) => item.is_owner) ||
    agreement.agreement_units[0];
  return unit?.organization_units?.name_th || "";
}

export function MouWorkspace({ access, agreements, viewer }: Props) {
  const [viewTab, setViewTab] = useState<"list" | "analytics">("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [continent, setContinent] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [fiscalYear, setFiscalYear] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState<boolean>(false);

  // Process analytics data for world map and faculty breakdown
  const analyticsData = useMemo(() => {
    return processMouAnalytics(agreements);
  }, [agreements]);

  // Extract unique UP units from agreements for unit filter dropdown
  const availableUnits = useMemo(() => {
    const unitMap = new Map<string, string>();
    agreements.forEach((item) => {
      item.agreement_units.forEach((u) => {
        if (u.organization_units?.id && u.organization_units?.name_th) {
          unitMap.set(u.organization_units.id, u.organization_units.name_th);
        }
      });
    });
    return Array.from(unitMap.entries()).map(([id, name]) => ({ id, name }));
  }, [agreements]);

  const filteredAgreements = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");

    return agreements.filter((agreement) => {
      const matchesStatus = status === "all" || agreement.status === status;

      // Continent filter
      const partner = getLeadPartnerInfo(agreement);
      const matchesContinent =
        continent === "all" || partner.continentCode === continent;

      // Unit filter
      const matchesUnit =
        unitFilter === "all" ||
        agreement.agreement_units.some(
          (u) => u.organization_units?.id === unitFilter,
        );

      // Fiscal Year filter
      const matchesFiscalYear =
        !fiscalYear ||
        (agreement.fiscal_year &&
          String(agreement.fiscal_year).includes(fiscalYear.trim()));

      // Date Range filter
      let matchesDateRange = true;
      if (startDate && agreement.start_date) {
        matchesDateRange = matchesDateRange && agreement.start_date >= startDate;
      }
      if (endDate && agreement.end_date) {
        matchesDateRange = matchesDateRange && agreement.end_date <= endDate;
      }

      // Search keyword filter
      const ownerUnit = getOwnerUnitInfo(agreement);
      const haystack = [
        agreement.agreement_number,
        agreement.title_th,
        agreement.title_en,
        agreement.agreement_type,
        partner.name,
        partner.country,
        ownerUnit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("th");

      const matchesQuery = !normalized || haystack.includes(normalized);

      return (
        matchesStatus &&
        matchesContinent &&
        matchesUnit &&
        matchesFiscalYear &&
        matchesDateRange &&
        matchesQuery
      );
    });
  }, [
    agreements,
    query,
    status,
    continent,
    unitFilter,
    fiscalYear,
    startDate,
    endDate,
  ]);

  const handleResetFilters = () => {
    setQuery("");
    setStatus("all");
    setContinent("all");
    setUnitFilter("all");
    setFiscalYear("");
    setStartDate("");
    setEndDate("");
  };

  const handleSelectFacultyFromBreakdown = (unitId: string) => {
    setUnitFilter(unitId);
    setViewTab("list");
  };

  const hasActiveFilters =
    query !== "" ||
    status !== "all" ||
    continent !== "all" ||
    unitFilter !== "all" ||
    fiscalYear !== "" ||
    startDate !== "" ||
    endDate !== "";

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => exportMouToCsv(filteredAgreements)}
            >
              <Download className="w-4 h-4" />
              ส่งออก CSV ({filteredAgreements.length})
            </Button>

            {canCreate ? (
              <Link className={cn(buttonVariants({ size: "lg" }))} href="/mou/new">
                <Plus data-icon="inline-start" />
                เพิ่ม MOU
              </Link>
            ) : null}
          </div>
        </div>

        {/* View Switcher Tabs Bar */}
        <div className="flex items-center justify-between border-b pb-3 mb-6">
          <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg text-xs">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all",
                viewTab === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewTab("list")}
            >
              <List className="w-3.5 h-3.5" />
              รายการ MOU
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all",
                viewTab === "analytics"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewTab("analytics")}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              แผนที่โลก & วิเคราะห์สถิติ
            </button>
          </div>

          <div className="text-xs text-muted-foreground">
            ข้อมูลอัปเดตล่าสุดจาก Supabase
          </div>
        </div>

        {/* Mode 1: Analytics & World Map View */}
        {viewTab === "analytics" && (
          <div className="space-y-8">
            <MouWorldMap
              countryStats={analyticsData.countryStats}
              continentStats={analyticsData.continentStats}
              totalAgreementsCount={agreements.length}
            />

            <MouFacultyBreakdown
              facultyStats={analyticsData.facultyStats}
              totalAgreementsCount={agreements.length}
              onSelectFaculty={handleSelectFacultyFromBreakdown}
            />
          </div>
        )}

        {/* Mode 2: List View */}
        {viewTab === "list" && (
          <>
            <div className="module-stat-strip">
              <div>
                <span className="module-stat-icon">
                  <Handshake />
                </span>
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
              <div>
                <span>
                  <strong>{filteredAgreements.length}</strong>
                  <small>ตรงตามเงื่อนไขที่กรอง</small>
                </span>
              </div>
            </div>

            <section className="module-list-card" aria-labelledby="mou-list-title">
              <div className="module-list-toolbar">
                <div>
                  <h2 id="mou-list-title">รายการ MOU</h2>
                  <p>ข้อมูลจาก Supabase · แสดงเฉพาะรายการที่ยังไม่ถูกลบ</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="module-search">
                    <Search aria-hidden="true" />
                    <span className="sr-only">ค้นหารายการ MOU</span>
                    <Input
                      type="search"
                      placeholder="ค้นหาชื่อ MOU, องค์กร หรือคณะ"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>

                  <Button
                    variant={showAdvancedFilter ? "secondary" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    ตัวกรองขั้นสูง {hasActiveFilters && "•"}
                  </Button>
                </div>
              </div>

              {/* Quick Status Filter Pills */}
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

              {/* Advanced Filter Panel */}
              {showAdvancedFilter && (
                <div className="mt-3 p-4 rounded-lg border bg-muted/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="font-semibold block mb-1">ทวีป (Continent)</label>
                    <select
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={continent}
                      onChange={(e) => setContinent(e.target.value)}
                    >
                      {continentOptions.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">คณะ / หน่วยงาน มพ.</label>
                    <select
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={unitFilter}
                      onChange={(e) => setUnitFilter(e.target.value)}
                    >
                      <option value="all">ทุกหน่วยงาน</option>
                      {availableUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">ปีงบประมาณ (พ.ศ.)</label>
                    <Input
                      type="text"
                      placeholder="เช่น 2569"
                      className="h-8 text-xs"
                      value={fiscalYear}
                      onChange={(e) => setFiscalYear(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">ช่วงวันเริ่มบังคับใช้</label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  {hasActiveFilters && (
                    <div className="sm:col-span-2 md:col-span-4 flex items-center justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleResetFilters}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> ล้างตัวกรองทั้งหมด
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {filteredAgreements.length > 0 ? (
                <div className="mou-list mt-4">
                  {filteredAgreements.map((agreement) => {
                    const partner = getLeadPartnerInfo(agreement);
                    const ownerUnit = getOwnerUnitInfo(agreement);

                    return (
                      <article className="mou-row flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/20 transition-colors" key={agreement.id}>
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className="mou-row-icon mt-1">
                            <FilePenLine />
                          </span>
                          <div className="mou-row-main min-w-0 space-y-1">
                            <div className="mou-row-title flex flex-wrap items-center gap-2">
                              <Link
                                href={`/mou/${agreement.id}`}
                                className="font-semibold text-base hover:underline text-foreground"
                              >
                                {agreement.title_th}
                              </Link>
                              {agreement.agreement_number ? (
                                <small className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                                  {agreement.agreement_number}
                                </small>
                              ) : null}
                            </div>

                            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-medium text-foreground">{partner.name}</span>
                              {partner.country && (
                                <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  <Globe className="w-3 h-3" /> {partner.country}
                                </span>
                              )}
                              {ownerUnit && (
                                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                  <Building2 className="w-3 h-3" /> {ownerUnit}
                                </span>
                              )}
                              <span>· {agreement.agreement_type || "MOU"}</span>
                              {agreement.fiscal_year && (
                                <span>· ปีงบประมาณ {agreement.fiscal_year}</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="mou-row-period text-right text-xs">
                            <small className="text-muted-foreground block">ระยะเวลา</small>
                            <strong>
                              {formatDate(agreement.start_date)} – {formatDate(agreement.end_date)}
                            </strong>
                          </div>

                          <Badge className={cn("mou-status", "mou-status-" + agreement.status)}>
                            {statusLabels[agreement.status]}
                          </Badge>

                          <div className="flex items-center gap-1">
                            <Link
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1 text-xs")}
                              href={`/mou/${agreement.id}`}
                            >
                              <Eye className="w-3.5 h-3.5" /> รายละเอียด
                            </Link>

                            {canUpdate ? (
                              <Link
                                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
                                href={`/mou/${agreement.id}/edit`}
                              >
                                แก้ไข
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="module-empty-state">
                  <span>
                    <Handshake />
                  </span>
                  <h3>
                    {agreements.length === 0
                      ? "ยังไม่มีข้อมูล MOU"
                      : "ไม่พบรายการที่ตรงตามเงื่อนไข"}
                  </h3>
                  <p>
                    {agreements.length === 0
                      ? "เมื่อเริ่มบันทึก MOU รายการจะปรากฏในหน้านี้"
                      : "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองเพื่อดูรายการทั้งหมด"}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2 gap-2">
                      <RotateCcw className="w-3.5 h-3.5" /> ล้างตัวกรองทั้งหมด
                    </Button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </WorkspaceChrome>
  );
}
