"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FilePenLine,
  Filter,
  Handshake,
  Plus,
  Search,
} from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { downloadMouCsv, downloadMouXlsx } from "./mou-export";
import type { MouAgreement } from "./mou-query";

type Props = {
  access: CurrentUserAccess;
  agreements: MouAgreement[];
  viewer: { displayName: string; email: string; role: string };
  initialFilters?: MouInitialFilters;
};

export type MouInitialFilters = {
  status?: string;
  workflow?: string;
  country?: string;
  owner?: string;
  renewalBefore?: string;
};

const PAGE_SIZE = 10;

const statusOptions = [
  ["all", "ทั้งหมด"],
  ["draft", "ร่าง"],
  ["active", "ใช้งานอยู่"],
  ["expiring", "ใกล้หมดอายุ"],
  ["expired", "หมดอายุ"],
  ["terminated", "ยุติแล้ว"],
] as const;

const workflowOptions = [
  ["all", "ทุกสถานะงาน"],
  ["draft", "ร่าง"],
  ["under_review", "รอตรวจสอบ"],
  ["approved", "อนุมัติแล้ว"],
  ["active", "ใช้งานอยู่"],
  ["completed", "เสร็จสิ้น"],
  ["cancelled", "ยกเลิก"],
  ["archived", "เก็บถาวร"],
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
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function leadPartner(agreement: MouAgreement) {
  return agreement.agreement_partners.find((item) => item.is_lead) ?? agreement.agreement_partners[0];
}

function partnerName(agreement: MouAgreement) {
  const partner = leadPartner(agreement);
  return partner?.partner_name_th_snapshot || partner?.partner_name_en_snapshot || partner?.partner_organizations?.name_th || partner?.partner_organizations?.name_en || "ยังไม่ระบุองค์กรคู่ความร่วมมือ";
}

function countryName(agreement: MouAgreement) {
  const partner = leadPartner(agreement);
  return partner?.country_name_th_snapshot || partner?.country_name_en_snapshot || partner?.partner_organizations?.countries?.name_th || partner?.partner_organizations?.countries?.name_en || "";
}

function continentCode(agreement: MouAgreement) {
  return leadPartner(agreement)?.partner_organizations?.countries?.continent_code ?? "";
}

function ownerUnitName(agreement: MouAgreement) {
  const unit = agreement.agreement_units.find((item) => item.is_owner)?.organization_units ?? agreement.agreement_units[0]?.organization_units;
  return unit?.name_th || unit?.name_en || "";
}

export function MouWorkspace({ access, agreements, viewer, initialFilters }: Props) {
  const [query, setQuery] = useState("");
  const initialStatus = statusOptions.some(([value]) => value === initialFilters?.status) ? initialFilters?.status as (typeof statusOptions)[number][0] : "all";
  const initialWorkflow = workflowOptions.some(([value]) => value === initialFilters?.workflow) ? initialFilters?.workflow as (typeof workflowOptions)[number][0] : "all";
  const [status, setStatus] = useState<(typeof statusOptions)[number][0]>(initialStatus);
  const [workflow, setWorkflow] = useState<(typeof workflowOptions)[number][0]>(initialWorkflow);
  const [type, setType] = useState("all");
  const [country, setCountry] = useState(initialFilters?.country ?? "all");
  const [ownerUnit, setOwnerUnit] = useState(initialFilters?.owner ?? "all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [renewalBefore, setRenewalBefore] = useState(initialFilters?.renewalBefore ?? "");
  const [sort, setSort] = useState("updated_desc");
  const [page, setPage] = useState(1);
  const [isExporting, startExport] = useTransition();

  const filterOptions = useMemo(() => ({
    types: [...new Set(agreements.map((item) => item.agreement_type).filter((value): value is string => Boolean(value)))].sort(),
    countries: [...new Set(agreements.map(countryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    ownerUnits: [...new Set(agreements.map(ownerUnitName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
  }), [agreements]);

  const filteredAgreements = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    const items = agreements.filter((agreement) => {
      const matchesSearch = !normalized || [
        agreement.agreement_number, agreement.title_th, agreement.title_en, agreement.agreement_type,
        partnerName(agreement), countryName(agreement), continentCode(agreement), ownerUnitName(agreement),
      ].filter(Boolean).join(" ").toLocaleLowerCase("th").includes(normalized);
      const matchesDate = (!fromDate || (agreement.start_date && agreement.start_date >= fromDate)) && (!toDate || (agreement.start_date && agreement.start_date <= toDate));
      const matchesRenewal = !renewalBefore || (agreement.status === "active" && agreement.end_date && agreement.end_date >= new Date().toISOString().slice(0, 10) && agreement.end_date <= renewalBefore);
      return matchesSearch && matchesDate && matchesRenewal &&
        (status === "all" || agreement.status === status) &&
        (workflow === "all" || agreement.workflow_status === workflow) &&
        (type === "all" || agreement.agreement_type === type) &&
        (country === "all" || countryName(agreement) === country) &&
        (ownerUnit === "all" || ownerUnitName(agreement) === ownerUnit);
    });
    return items.toSorted((left, right) => {
      if (sort === "title_asc") return left.title_th.localeCompare(right.title_th, "th");
      if (sort === "start_asc") return (left.start_date ?? "9999-12-31").localeCompare(right.start_date ?? "9999-12-31");
      if (sort === "start_desc") return (right.start_date ?? "").localeCompare(left.start_date ?? "");
      return right.updated_at.localeCompare(left.updated_at);
    });
  }, [agreements, country, fromDate, ownerUnit, query, renewalBefore, sort, status, toDate, type, workflow]);

  const totalPages = Math.max(1, Math.ceil(filteredAgreements.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAgreements = filteredAgreements.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const canCreate = Boolean(access.modules.mou?.create);
  const canUpdate = Boolean(access.modules.mou?.update);
  const canExport = Boolean(access.modules.mou?.view);
  const clearFilters = () => { setQuery(""); setStatus("all"); setWorkflow("all"); setType("all"); setCountry("all"); setOwnerUnit("all"); setFromDate(""); setToDate(""); setRenewalBefore(""); setSort("updated_desc"); };
  const exportXlsx = () => startExport(() => { void downloadMouXlsx(filteredAgreements); });

  return (
    <WorkspaceChrome access={access} viewer={viewer} title="ความร่วมมือและ MOU" activePath="/mou" query={query} onQueryChange={setQuery}>
      <main className="module-main">
        <div className="module-page-heading">
          <div>
            <p className="module-eyebrow">ความร่วมมือและ MOU</p>
            <h1>ข้อตกลงความร่วมมือ</h1>
            <p>จัดการวงจรชีวิต MOU ตั้งแต่ร่าง ตรวจสอบ ลงนาม และติดตามวันสิ้นสุด</p>
          </div>
          {canCreate ? <Link className={cn(buttonVariants({ size: "lg" }))} href="/mou/new"><Plus data-icon="inline-start" />เพิ่ม MOU</Link> : null}
        </div>

        <div className="module-stat-strip">
          <div><span className="module-stat-icon"><Handshake /></span><span><strong>{agreements.length}</strong><small>MOU ทั้งหมด</small></span></div>
          <div><span><strong>{agreements.filter((item) => item.status === "active").length}</strong><small>ใช้งานอยู่</small></span></div>
          <div><span><strong>{agreements.filter((item) => item.workflow_status === "under_review").length}</strong><small>รอตรวจสอบ</small></span></div>
        </div>

        <section className="module-list-card" aria-labelledby="mou-list-title">
          <div className="module-list-toolbar">
            <div><h2 id="mou-list-title">รายการ MOU</h2><p>ข้อมูลจาก Supabase · แสดงเฉพาะรายการที่ยังไม่ถูกลบ</p></div>
            <label className="module-search"><Search aria-hidden="true" /><span className="sr-only">ค้นหารายการ MOU</span><Input type="search" placeholder="ค้นหาชื่อ MOU องค์กร หน่วยงาน หรือประเทศ" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>

          <div className="module-filter-row" role="group" aria-label="กรองสถานะ MOU">
            <Filter aria-hidden="true" />
            {statusOptions.map(([value, label]) => <button className={cn("filter-pill", status === value && "is-selected")} key={value} onClick={() => setStatus(value)}>{label}</button>)}
          </div>

          <div className="mou-advanced-filters">
            <label>สถานะงาน<select value={workflow} onChange={(event) => setWorkflow(event.target.value as typeof workflow)}>{workflowOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>ประเภท<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">ทุกประเภท</option>{filterOptions.types.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>ประเทศ<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="all">ทุกประเทศ</option>{filterOptions.countries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>หน่วยงานเจ้าของ<select value={ownerUnit} onChange={(event) => setOwnerUnit(event.target.value)}><option value="all">ทุกหน่วยงาน</option>{filterOptions.ownerUnits.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>เริ่มตั้งแต่<Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label>ถึงวันที่<Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <label>สิ้นสุดภายใน<Input type="date" value={renewalBefore} onChange={(event) => setRenewalBefore(event.target.value)} /></label>
            <label>เรียงลำดับ<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated_desc">แก้ไขล่าสุด</option><option value="start_desc">วันเริ่มใหม่สุด</option><option value="start_asc">วันเริ่มเก่าสุด</option><option value="title_asc">ชื่อ ก-ฮ / A-Z</option></select></label>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>ล้างตัวกรอง</Button>
          </div>

          <div className="mou-list-summary">
            <span>พบ {filteredAgreements.length} รายการ</span>
            {canExport ? <span className="mou-export-actions"><Button type="button" variant="outline" size="sm" disabled={filteredAgreements.length === 0 || isExporting} onClick={() => downloadMouCsv(filteredAgreements)}><Download data-icon="inline-start" />CSV</Button><Button type="button" variant="outline" size="sm" disabled={filteredAgreements.length === 0 || isExporting} onClick={exportXlsx}><Download data-icon="inline-start" />{isExporting ? "กำลังสร้างไฟล์…" : "Excel"}</Button></span> : null}
          </div>

          {filteredAgreements.length > 0 ? <>
            <div className="mou-list">{pagedAgreements.map((agreement) => <article className="mou-row" key={agreement.id}>
              <span className="mou-row-icon"><FilePenLine /></span>
              <div className="mou-row-main"><div className="mou-row-title"><strong>{agreement.title_th}</strong>{agreement.agreement_number ? <small>{agreement.agreement_number}</small> : null}</div><p>{partnerName(agreement)} · {countryName(agreement) || agreement.agreement_type || "ยังไม่ระบุประเภท"}</p></div>
              <div className="mou-row-period"><small>ระยะเวลา</small><strong>{formatDate(agreement.start_date)} – {formatDate(agreement.end_date)}</strong></div>
              <Badge className={cn("mou-status", "mou-status-" + agreement.status)}>{statusLabels[agreement.status]}</Badge>
              {canUpdate ? <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/mou/${agreement.id}/edit`}>แก้ไข</Link> : null}
            </article>)}</div>
            <div className="mou-pagination"><span>หน้า {currentPage} จาก {totalPages}</span><span><Button type="button" variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft data-icon="inline-start" />ก่อนหน้า</Button><Button type="button" variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)}>ถัดไป<ArrowRight data-icon="inline-end" /></Button></span></div>
          </> : <div className="module-empty-state"><span><Handshake /></span><h3>{agreements.length === 0 ? "ยังไม่มีข้อมูล MOU" : "ไม่พบรายการที่ค้นหา"}</h3><p>{agreements.length === 0 ? "เมื่อเริ่มบันทึก MOU รายการจะปรากฏในหน้านี้" : "ลองเปลี่ยนคำค้นหาหรือตัวกรองที่เลือก"}</p>{agreements.length === 0 ? <Link className="panel-link" href="/mou/new">เพิ่ม MOU รายการแรก <ArrowRight aria-hidden="true" /></Link> : <Button type="button" variant="link" onClick={clearFilters}>ล้างตัวกรอง</Button>}</div>}
        </section>
      </main>
    </WorkspaceChrome>
  );
}
