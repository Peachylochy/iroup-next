"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import {
  parseTravelListState,
  travelListHref,
  travelSortLabels,
  travelWorkflowLabels,
  type TravelListState,
} from "./travel-list-state";
import type { TravelFilterOption, TravelListResult } from "./travel-list-types";
import styles from "./travel-workspace.module.css";

const numberFormat = new Intl.NumberFormat("th-TH");
const dateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Date-only database values must display the same calendar day in every timezone.
function formatDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "ยังไม่ระบุ";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "ยังไม่ระบุ" : dateFormat.format(date);
}

function FilterOptions({
  options,
  selected,
  missingLabel,
}: {
  options: TravelFilterOption[];
  selected: string;
  missingLabel: string;
}) {
  return (
    <>
      {selected && !options.some((option) => option.id === selected) ? (
        <option value={selected}>{missingLabel}</option>
      ) : null}
      {options.map((option) => (
        <option value={option.id} key={option.id}>
          {option.label}
        </option>
      ))}
    </>
  );
}

function pageNumbers(page: number, totalPages: number) {
  return [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);
}

export function TravelWorkspace({
  access,
  viewer,
  state,
  result,
}: {
  access: CurrentUserAccess;
  viewer: { displayName: string; email: string; role: string };
  state: TravelListState;
  result: TravelListResult;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const readOnly = !Object.entries(access.modules.travel).some(
    ([action, allowed]) => action !== "view" && allowed,
  );
  const filtered = Boolean(state.q || state.status || state.country || state.unit || state.year);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const firstRow = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastRow = result.total ? firstRow + result.rows.length - 1 : 0;
  const pages = pageNumbers(result.page, totalPages);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const params = Object.fromEntries(
      [...values.entries()].map(([key, value]) => [key, String(value)]),
    );
    const next = parseTravelListState({ ...params, page: "1" });
    startTransition(() => router.push(travelListHref(next), { scroll: false }));
  }

  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title="เดินทางไปปฏิบัติงาน"
      activePath="/travel"
      hidePlaceholderControls
    >
      <main className={styles.main}>
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>การเดินทางและ Mobility</p>
            <h1>เดินทางไปปฏิบัติงาน</h1>
            <p className={styles.description}>
              ค้นหาและติดตามการเดินทางไปประชุม อบรม และปฏิบัติงานของบุคลากร
            </p>
          </div>
          {access.modules.travel.create ? (
            <Link
              href="/travel/new"
              className={cn(buttonVariants({ size: "lg" }), styles.createLink)}
            >
              <Plus aria-hidden="true" /> เพิ่มการเดินทาง
            </Link>
          ) : null}
        </header>

        {readOnly ? (
          <p className={styles.readOnly} data-testid="travel-readonly">
            <Eye aria-hidden="true" />
            <span>สิทธิ์อ่านอย่างเดียว คุณสามารถดูรายการและรายละเอียดการเดินทางได้</span>
          </p>
        ) : null}

        <section className={styles.overview} aria-labelledby="travel-overview-title">
          <h2 id="travel-overview-title" className={styles.sectionCaption}>
            ภาพรวมรายการที่คุณมีสิทธิ์ดู · ก่อนกรอง
          </h2>
          <div className={styles.summary}>
            <div>
              <span className={styles.summaryIcon}><BriefcaseBusiness aria-hidden="true" /></span>
              <div><strong>{numberFormat.format(result.summary.total)}</strong><span>รายการทั้งหมด</span></div>
            </div>
            <div>
              <span className={styles.summaryIcon}><CheckCircle2 aria-hidden="true" /></span>
              <div><strong>{numberFormat.format(result.summary.active)}</strong><span>กำลังดำเนินการ</span></div>
            </div>
            <div>
              <span className={styles.summaryIcon}><Clock3 aria-hidden="true" /></span>
              <div><strong>{numberFormat.format(result.summary.underReview)}</strong><span>รอตรวจสอบ</span></div>
            </div>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="travel-filter-title">
          <div className={styles.filterHeading}>
            <h2 id="travel-filter-title">ค้นหาและกรองรายการ</h2>
            <p>เลือกเงื่อนไขแล้วกดค้นหา เพื่อแสดงรายการที่ต้องการ</p>
          </div>
          <form
            key={travelListHref(state)}
            method="get"
            action="/travel"
            onSubmit={applyFilters}
            className={styles.filters}
            aria-busy={isPending}
          >
            <label className={styles.searchField}>
              <span>คำค้นหา</span>
              <span className={styles.searchInput}>
                <Search aria-hidden="true" />
                <input
                  name="q"
                  type="search"
                  maxLength={200}
                  defaultValue={state.q}
                  placeholder="ชื่อรายการ ประเทศ องค์กร หรือหน่วยงาน"
                />
              </span>
            </label>
            <label>
              <span>สถานะ</span>
              <select name="status" defaultValue={state.status}>
                <option value="">ทุกสถานะ</option>
                {Object.entries(travelWorkflowLabels).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>ประเทศ</span>
              <select name="country" defaultValue={state.country}>
                <option value="">ทุกประเทศ</option>
                <FilterOptions options={result.filters.countries} selected={state.country} missingLabel="ประเทศที่เลือก (ไม่พบรายการปัจจุบัน)" />
              </select>
            </label>
            <label>
              <span>หน่วยงานเจ้าของเรื่อง</span>
              <select name="unit" defaultValue={state.unit}>
                <option value="">ทุกหน่วยงาน</option>
                <FilterOptions options={result.filters.units} selected={state.unit} missingLabel="หน่วยงานที่เลือก (ไม่พบรายการปัจจุบัน)" />
              </select>
            </label>
            <label>
              <span>ปีงบประมาณ</span>
              <select name="year" defaultValue={state.year}>
                <option value="">ทุกปีงบประมาณ</option>
                {state.year && !result.filters.years.includes(Number(state.year)) ? (
                  <option value={state.year}>{state.year}</option>
                ) : null}
                {result.filters.years.map((year) => (
                  <option value={year} key={year}>{year}</option>
                ))}
              </select>
            </label>
            <label>
              <span>เรียงลำดับ</span>
              <select name="sort" defaultValue={state.sort}>
                {Object.entries(travelSortLabels).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className={styles.filterActions}>
              <button
                type="submit"
                disabled={isPending}
                className={cn(buttonVariants({ size: "lg" }), styles.applyButton)}
              >
                {isPending ? <LoaderCircle aria-hidden="true" className={styles.spinner} /> : <Search aria-hidden="true" />}
                {isPending ? "กำลังค้นหา…" : "ค้นหาและกรอง"}
              </button>
              <Link href="/travel" prefetch={false} className={styles.resetLink} scroll={false}>
                ล้างตัวกรอง
              </Link>
            </div>
          </form>
          <p className={cn(styles.pending, !isPending && styles.inactivePending)} role="status" aria-live="polite">
            {isPending ? "กำลังโหลดรายการตามเงื่อนไขที่เลือก…" : ""}
          </p>
        </section>

        <section className={styles.panel} aria-labelledby="travel-results-title" aria-busy={isPending}>
          <div className={styles.resultsHeading}>
            <div>
              <h2 id="travel-results-title">รายการเดินทาง</h2>
              <p data-testid="travel-result-count" aria-live="polite" aria-atomic="true">
                {filtered ? "ตรงกับเงื่อนไข " : "ทั้งหมด "}
                <strong>{numberFormat.format(result.total)}</strong> รายการ
                {result.total > 0 ? ` · แสดง ${numberFormat.format(firstRow)}–${numberFormat.format(lastRow)}` : ""}
              </p>
            </div>
            <span className={styles.pageSize}>หน้าละ {result.pageSize} รายการ</span>
          </div>

          {result.rows.length ? (
            <div className={styles.list}>
              {result.rows.map((item) => (
                <article className={styles.row} data-testid="travel-row" key={item.id}>
                  <div className={styles.rowMain}>
                    <div className={styles.titleLine}>
                      <h3>
                        <Link href={`/travel/${item.id}`} prefetch={false}>{item.project_name}</Link>
                      </h3>
                      <span className={styles.status} data-status={item.workflow_status}>
                        {travelWorkflowLabels[item.workflow_status] ?? "ยังไม่ระบุสถานะ"}
                      </span>
                    </div>
                    <p className={styles.organization}>
                      {item.partner_name || item.owner_unit_name || "ยังไม่ระบุองค์กร"}
                    </p>
                    <div className={styles.metadata}>
                      <span><MapPin aria-hidden="true" />{item.country_name || "ยังไม่ระบุประเทศ"}</span>
                      <span><UsersRound aria-hidden="true" />{numberFormat.format(item.participant_count)} คน</span>
                      {item.fiscal_year ? <span>ปีงบประมาณ {item.fiscal_year}</span> : null}
                    </div>
                  </div>
                  <div className={styles.period}>
                    <span><CalendarDays aria-hidden="true" />ระยะเวลาเดินทาง</span>
                    <p>{formatDate(item.start_date)}<br /><span>ถึง {formatDate(item.end_date)}</span></p>
                  </div>
                  <Link
                    href={`/travel/${item.id}`}
                    prefetch={false}
                    aria-label={`ดูรายละเอียด ${item.project_name}`}
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.detailLink)}
                  >
                    ดูรายละเอียด <ArrowRight aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div
              className={styles.empty}
              data-testid={result.summary.total ? "travel-no-results" : "travel-empty"}
            >
              <span className={styles.emptyIcon}>
                {result.summary.total ? <Search aria-hidden="true" /> : <BriefcaseBusiness aria-hidden="true" />}
              </span>
              <h3>{result.summary.total ? "ไม่พบรายการที่ตรงกับเงื่อนไข" : "ยังไม่มีรายการเดินทาง"}</h3>
              <p>
                {result.summary.total
                  ? "ลองใช้คำค้นหาอื่น หรือปรับตัวกรองเพื่อดูรายการเพิ่มเติม"
                  : access.modules.travel.create
                    ? "เพิ่มการเดินทางรายการแรก เพื่อเริ่มบันทึกและติดตามข้อมูล"
                    : "รายการเดินทางจะแสดงที่นี่เมื่อมีการเพิ่มข้อมูล"}
              </p>
              {result.summary.total ? (
                <Link href="/travel" prefetch={false} className={styles.resetLink}>ดูรายการทั้งหมด</Link>
              ) : access.modules.travel.create ? (
                <Link href="/travel/new" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                  <Plus aria-hidden="true" /> เพิ่มการเดินทาง
                </Link>
              ) : null}
            </div>
          )}

          {result.total > 0 ? (
            <nav className={styles.pagination} aria-label="หน้ารายการเดินทาง">
              <p>หน้า {numberFormat.format(result.page)} จาก {numberFormat.format(totalPages)}</p>
              <div className={styles.pageLinks}>
                {result.page > 1 ? (
                  <Link href={travelListHref(state, { page: result.page - 1 })} prefetch={false} className={styles.directionLink}>
                    <ArrowLeft aria-hidden="true" /><span>หน้าก่อนหน้า</span>
                  </Link>
                ) : <span className={styles.disabledDirection} aria-disabled="true"><ArrowLeft aria-hidden="true" /><span>หน้าก่อนหน้า</span></span>}
                <div className={styles.pageNumbers}>
                  {pages.map((page, index) => (
                    <span className={styles.pageNumberGroup} key={page}>
                      {index > 0 && page - pages[index - 1] > 1 ? <span className={styles.ellipsis} aria-hidden="true">…</span> : null}
                      <Link
                        href={travelListHref(state, { page })}
                        prefetch={false}
                        className={styles.pageNumber}
                        aria-label={`หน้า ${page}`}
                        aria-current={page === result.page ? "page" : undefined}
                      >
                        {numberFormat.format(page)}
                      </Link>
                    </span>
                  ))}
                </div>
                {result.page < totalPages ? (
                  <Link href={travelListHref(state, { page: result.page + 1 })} prefetch={false} className={styles.directionLink}>
                    <span>หน้าถัดไป</span><ArrowRight aria-hidden="true" />
                  </Link>
                ) : <span className={styles.disabledDirection} aria-disabled="true"><span>หน้าถัดไป</span><ArrowRight aria-hidden="true" /></span>}
              </div>
            </nav>
          ) : null}
        </section>
      </main>
    </WorkspaceChrome>
  );
}
