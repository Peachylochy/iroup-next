"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  FileClock,
  FilePenLine,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { signOutAction } from "@/features/auth/actions";
import { SidebarContent } from "@/components/app-shell/workspace-sidebar";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import {
  moduleSummaries,
  priorityItems,
  quickCreateItems,
} from "./dashboard-data";
import type { DashboardSnapshot } from "./dashboard-query";
import type { MouAnalytics } from "./mou-analytics";

type Tone = "critical" | "warning" | "attention";

export type DashboardViewer = {
  displayName: string;
  email: string;
  role: string;
};

type DashboardWorkspaceProps = {
  access?: CurrentUserAccess;
  snapshot?: DashboardSnapshot;
  viewer?: DashboardViewer;
};

const toneClass: Record<Tone, string> = {
  critical: "status-critical",
  warning: "status-warning",
  attention: "status-attention",
};

function InternalBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn("internal-badge", compact && "internal-badge-compact")}
    >
      <LockKeyhole data-icon="inline-start" />
      {compact ? "ภายใน" : "ภายในเท่านั้น"}
    </Badge>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-heading" id={id}>
      <span aria-hidden="true" />
      <h2>{children}</h2>
    </div>
  );
}

function PriorityList({
  query,
  mouAnalytics,
}: {
  query: string;
  mouAnalytics: MouAnalytics | null | undefined;
}) {
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    if (!normalized) return priorityItems;
    return priorityItems.filter((item) =>
      `${item.title} ${item.description} ${item.status}`
        .toLocaleLowerCase("th")
        .includes(normalized),
    );
  }, [query]);

  return (
    <section className="priority-section" aria-labelledby="priority-work">
      <SectionHeading id="priority-work">งานที่ต้องดำเนินการ</SectionHeading>
      <div className="priority-list">
        {mouAnalytics ? (
          mouAnalytics.expiring > 0 || mouAnalytics.underReview > 0 ? (
            <>
              {mouAnalytics.expiring > 0 ? (
                <Link className="priority-row" href="/mou?renewal=90">
                  <span className={cn("priority-icon", toneClass.critical)} aria-hidden="true"><FileClock /></span>
                  <span className="priority-copy"><strong>MOU ใกล้หมดอายุ</strong><small>มีวันสิ้นสุดภายใน 90 วัน</small></span>
                  <span className={cn("priority-count", toneClass.critical)}><strong>{mouAnalytics.expiring}</strong><small>รายการ</small></span>
                  <span className="priority-status"><span className={cn("status-dot", toneClass.critical)} aria-hidden="true" />เร่งติดตาม</span>
                  <span className="priority-due"><CalendarDays aria-hidden="true" /><span><small>ช่วงติดตาม</small><strong>ภายใน 90 วัน</strong></span></span>
                  <ArrowRight className="priority-arrow" aria-hidden="true" />
                </Link>
              ) : null}
              {mouAnalytics.underReview > 0 ? (
                <Link className="priority-row" href="/mou?workflow=under_review">
                  <span className={cn("priority-icon", toneClass.warning)} aria-hidden="true"><FilePenLine /></span>
                  <span className="priority-copy"><strong>แบบร่าง MOU รอตรวจสอบ</strong><small>รายการที่ส่งเข้าสู่ขั้นตอนตรวจสอบแล้ว</small></span>
                  <span className={cn("priority-count", toneClass.warning)}><strong>{mouAnalytics.underReview}</strong><small>รายการ</small></span>
                  <span className="priority-status"><span className={cn("status-dot", toneClass.warning)} aria-hidden="true" />รอดำเนินการ</span>
                  <span className="priority-due"><CalendarDays aria-hidden="true" /><span><small>รายการ</small><strong>ตรวจสอบข้อมูล</strong></span></span>
                  <ArrowRight className="priority-arrow" aria-hidden="true" />
                </Link>
              ) : null}
            </>
          ) : (
            <div className="search-empty">ยังไม่มี MOU ที่ต้องติดตามต่ออายุหรือรอตรวจสอบ</div>
          )
        ) : visibleItems.length > 0 ? (
          visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <a className="priority-row" href="#activity" key={item.title}>
                <span
                  className={cn("priority-icon", toneClass[item.tone])}
                  aria-hidden="true"
                >
                  <Icon />
                </span>
                <span className="priority-copy">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
                <span className={cn("priority-count", toneClass[item.tone])}>
                  <strong>{item.count}</strong>
                  <small>รายการ</small>
                </span>
                <span className="priority-status">
                  <span
                    className={cn("status-dot", toneClass[item.tone])}
                    aria-hidden="true"
                  />
                  {item.status}
                </span>
                <span className="priority-due">
                  <CalendarDays aria-hidden="true" />
                  <span>
                    <small>กำหนดเสร็จ</small>
                    <strong>{item.due}</strong>
                  </span>
                </span>
                <ArrowRight className="priority-arrow" aria-hidden="true" />
              </a>
            );
          })
        ) : (
          <div className="search-empty">
            ไม่พบงานที่ตรงกับ “{query}”
          </div>
        )}
      </div>
    </section>
  );
}

function ModuleOverview({
  access,
  snapshot,
}: {
  access?: CurrentUserAccess;
  snapshot?: DashboardSnapshot;
}) {
  const liveValues = snapshot
    ? [
        snapshot.agreements,
        snapshot.mobility,
        snapshot.officialTravel,
        snapshot.partnerContacts,
      ]
    : null;

  return (
    <section aria-labelledby="module-overview">
      <SectionHeading id="module-overview">ภาพรวมโมดูลหลัก</SectionHeading>
      <div className="module-strip">
        {moduleSummaries.map((item, index) => {
          if (access && !access.modules[item.module]?.view) return null;
          const Icon = item.icon;
          const value = liveValues?.[index] ?? item.value;
          const detail = index === 0 && snapshot?.mouAnalytics
            ? `ใช้งานอยู่ ${snapshot.mouAnalytics.active} · ใกล้หมดอายุ ${snapshot.mouAnalytics.expiring}`
            : snapshot
              ? value === 0
                ? "ยังไม่มีข้อมูลในฐานข้อมูล"
                : "ข้อมูลจาก Supabase"
              : item.detail;
          return (
            <article className="module-summary" key={item.label}>
              <span className="module-icon" aria-hidden="true">
                <Icon />
              </span>
              <div>
                <div className="module-title-line">
                  <h3>{item.label}</h3>
                  {"internal" in item && item.internal ? (
                    <InternalBadge compact />
                  ) : null}
                </div>
                <p className="module-value">
                  <strong>{value}</strong>
                  <span>{item.unit}</span>
                </p>
                <small>{detail}</small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MouAnalyticsOverview({ analytics }: { analytics: MouAnalytics | null | undefined }) {
  if (!analytics) return null;

  const maxOwnerCount = Math.max(...analytics.ownerUnits.map((item) => item.count), 1);
  const maxCountryCount = Math.max(...analytics.countries.map((item) => item.count), 1);

  return (
    <section className="mou-analytics-section" aria-labelledby="mou-analytics-title">
      <div className="mou-analytics-heading">
        <SectionHeading id="mou-analytics-title">ภาพรวม MOU และงานต่ออายุ</SectionHeading>
        <Link href="/mou">ดูรายการ MOU <ArrowRight aria-hidden="true" /></Link>
      </div>
      <div className="mou-kpi-grid">
        <Link href="/mou?status=active"><small>ใช้งานอยู่</small><strong>{analytics.active}</strong><span>ฉบับ</span></Link>
        <Link href="/mou?renewal=90"><small>ใกล้หมดอายุ</small><strong>{analytics.expiring}</strong><span>ภายใน 90 วัน</span></Link>
        <Link href="/mou?status=expired"><small>หมดอายุ</small><strong>{analytics.expired}</strong><span>ฉบับ</span></Link>
        <Link href="/mou?workflow=under_review"><small>รอตรวจสอบ</small><strong>{analytics.underReview}</strong><span>ฉบับ</span></Link>
      </div>
      <div className="mou-analytics-grid">
        <article className="mou-analytics-panel">
          <div className="mou-panel-heading"><div><h3>คิวติดตามต่ออายุ</h3><p>เรียงตามวันสิ้นสุดที่ใกล้ที่สุด</p></div><Link href="/mou?renewal=90">ดูทั้งหมด</Link></div>
          {analytics.renewals.length > 0 ? <div className="renewal-list">{analytics.renewals.map((item) => <Link href={`/mou/${item.id}`} key={item.id} className="renewal-row"><span><strong>{item.title}</strong><small>{item.partner}</small></span><span><strong>{formatThaiDate(item.endDate)}</strong><small>เหลือ {item.daysRemaining} วัน</small></span></Link>)}</div> : <p className="analytics-empty">ยังไม่มี MOU ที่สิ้นสุดภายใน 90 วัน</p>}
        </article>
        <article className="mou-analytics-panel">
          <div className="mou-panel-heading"><div><h3>หน่วยงานเจ้าของ</h3><p>จำนวน MOU ตามหน่วยงาน ม.พะเยา</p></div></div>
          <div className="ranked-bars">{analytics.ownerUnits.map((item) => <Link href={`/mou?owner=${encodeURIComponent(item.name)}`} className="ranked-bar" key={item.name}><span><strong>{item.name}</strong><small>{item.count} ฉบับ</small></span><i style={{ "--bar-value": `${(item.count / maxOwnerCount) * 100}%` } as React.CSSProperties} /></Link>)}</div>
        </article>
        <article className="mou-analytics-panel">
          <div className="mou-panel-heading"><div><h3>ประเทศคู่ความร่วมมือ</h3><p>อ้างอิง country snapshot ของ MOU</p></div></div>
          <div className="ranked-bars">{analytics.countries.map((item) => <Link href={`/mou?country=${encodeURIComponent(item.name)}`} className="ranked-bar" key={item.name}><span><strong>{item.name}</strong><small>{item.count} ฉบับ</small></span><i style={{ "--bar-value": `${(item.count / maxCountryCount) * 100}%` } as React.CSSProperties} /></Link>)}</div>
        </article>
      </div>
    </section>
  );
}

function formatThaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ActivityList({
  items,
}: {
  items: DashboardSnapshot["recentActivities"];
}) {
  return (
    <section className="lower-panel" id="activity">
      <SectionHeading>กิจกรรมล่าสุด</SectionHeading>
      <div className="activity-list">
        {items.length === 0 ? (
          <div className="search-empty">ยังไม่มีกิจกรรมในระบบ</div>
        ) : items.map((item) => {
          return (
            <Link className="activity-row" href={item.href} key={item.id}>
              <time>{formatActivityTime(item.occurredAt)}</time>
              <span className="activity-icon" aria-hidden="true"><FilePenLine /></span>
              <span className="activity-copy">
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <span className="activity-module">
                {item.module}
                {"internal" in item && item.internal ? (
                  <LockKeyhole aria-label="ข้อมูลภายใน" />
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
      <a className="panel-link" href="#priority-work">
        ดูทั้งหมด <ArrowRight aria-hidden="true" />
      </a>
    </section>
  );
}

function UpcomingList({
  items,
}: {
  items: DashboardSnapshot["upcomingItems"];
}) {
  return (
    <section className="lower-panel">
      <SectionHeading>กำหนดการใกล้ถึง</SectionHeading>
      <div className="upcoming-list">
        {items.length === 0 ? (
          <div className="search-empty">ยังไม่มีกำหนดการในระบบ</div>
        ) : items.map((item) => {
          const date = new Date(item.occursAt);
          return <Link className="upcoming-row" href={item.href} key={item.id}>
            <time className="upcoming-date">
              <strong>{new Intl.DateTimeFormat("th-TH", { day: "2-digit" }).format(date)}</strong>
              <small>{new Intl.DateTimeFormat("th-TH", { month: "short" }).format(date)}</small>
            </time>
            <time className="upcoming-time">{date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time>
            <span className="upcoming-copy">
              <strong>{item.title}</strong>
              <small>{item.module}</small>
            </span>
          </Link>;
        })}
      </div>
      <a className="panel-link" href="#priority-work">
        ดูทั้งหมด <ArrowRight aria-hidden="true" />
      </a>
    </section>
  );
}

export function DashboardWorkspace({
  access,
  snapshot,
  viewer = {
    displayName: "นางสาวพิมพ์ชนก ศรีดี",
    email: "preview@up.ac.th",
    role: "เจ้าหน้าที่บริหารงานทั่วไป",
  },
}: DashboardWorkspaceProps = {}) {
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const initials = viewer.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const liveDatabaseEmpty = Boolean(
    snapshot &&
      snapshot.agreements === 0 &&
      snapshot.mobility === 0 &&
      snapshot.officialTravel === 0 &&
      snapshot.partnerContacts === 0,
  );
  const visibleQuickCreateItems = quickCreateItems.filter(
    (item) => !access || access.modules[item.module]?.create,
  );

  return (
    <div className="workspace-shell">
      <aside className="desktop-sidebar">
        <SidebarContent access={access} />
      </aside>

      {mobileMenuOpen ? (
        <div className="mobile-nav-layer">
          <button
            className="mobile-nav-backdrop"
            aria-label="ปิดเมนูเมื่อคลิกพื้นที่ด้านนอก"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="mobile-sidebar" aria-label="เมนูบนมือถือ">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-nav-close"
              aria-label="ปิดเมนู"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X />
            </Button>
            <SidebarContent
              access={access}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-title">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu-button"
              aria-label="เปิดเมนู"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu />
            </Button>
            <strong>ภาพรวม</strong>
          </div>
          <div className="topbar-actions">
            <label className="fiscal-select">
              <span className="sr-only">เลือกปีงบประมาณ</span>
              <select defaultValue="2569">
                <option value="2569">ปีงบประมาณ 2569</option>
                <option value="2570">ปีงบประมาณ 2570</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <label className="search-control">
              <Search aria-hidden="true" />
              <span className="sr-only">ค้นหาข้อมูล</span>
              <Input
                type="search"
                placeholder="ค้นหาข้อมูล"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd>⌘K</kbd>
            </label>
            <Button
              variant="ghost"
              size="icon"
              className="notification-button"
              aria-label={`การแจ้งเตือน ${snapshot?.attentionCount ?? 0} รายการ`}
            >
              <Bell />
              <span>{snapshot?.attentionCount ?? 0}</span>
            </Button>
            <Separator orientation="vertical" className="account-separator" />
            <div className="account">
              {access ? (
                <Link
                  href="/settings/account"
                  className="inline-flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-muted"
                  aria-label="เปิดหน้าบัญชีและเปลี่ยนรหัสผ่าน"
                  title="บัญชีของฉัน / เปลี่ยนรหัสผ่าน"
                >
                  <Avatar size="lg">
                    <AvatarFallback>{initials || "UP"}</AvatarFallback>
                  </Avatar>
                  <span>
                    <strong>{viewer.displayName}</strong>
                    <small>{viewer.role}</small>
                  </span>
                  <KeyRound className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <>
                  <Avatar size="lg">
                    <AvatarFallback>{initials || "UP"}</AvatarFallback>
                  </Avatar>
                  <span>
                    <strong>{viewer.displayName}</strong>
                    <small>{viewer.role}</small>
                  </span>
                </>
              )}
              {access ? (
                <form action={signOutAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label={`ออกจากระบบ ${viewer.email}`}
                  >
                    <LogOut />
                  </Button>
                </form>
              ) : (
                <ChevronDown aria-hidden="true" />
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-main" id="main">
          <div className="dashboard-intro">
            <div>
              <h1>สวัสดีค่ะ วันนี้มีอะไรต้องจัดการบ้าง</h1>
              <p>ติดตามงานสำคัญและข้อมูลภาพรวมของฝ่ายวิเทศสัมพันธ์</p>
              {snapshot ? (
                <span className="live-data-status">
                  เชื่อมต่อ Supabase แล้ว
                  {liveDatabaseEmpty ? " · ยังไม่มีข้อมูลจริง" : ""}
                </span>
              ) : null}
            </div>
            {visibleQuickCreateItems.length > 0 ? (
              <div className="quick-add">
              <Button
                size="lg"
                aria-expanded={quickAddOpen}
                aria-controls="quick-add-menu"
                onClick={() => setQuickAddOpen((open) => !open)}
              >
                <Plus data-icon="inline-start" />
                เพิ่มข้อมูล
                <ChevronDown data-icon="inline-end" />
              </Button>
              {quickAddOpen ? (
                <div className="quick-add-menu" id="quick-add-menu">
                  {visibleQuickCreateItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        href={item.href}
                        key={item.label}
                        onClick={() => setQuickAddOpen(false)}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                        {"internal" in item && item.internal ? (
                          <LockKeyhole aria-label="ข้อมูลภายใน" />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
              </div>
            ) : null}
          </div>

          <PriorityList query={query} mouAnalytics={snapshot?.mouAnalytics} />
          <ModuleOverview access={access} snapshot={snapshot} />
          <MouAnalyticsOverview analytics={snapshot?.mouAnalytics} />
          <div className="lower-grid">
            <ActivityList items={snapshot?.recentActivities ?? []} />
            <UpcomingList items={snapshot?.upcomingItems ?? []} />
          </div>
        </main>
      </div>
    </div>
  );
}
