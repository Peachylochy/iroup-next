"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
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
import type { CurrentUserAccess, ModuleKey } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import {
  moduleSummaries,
  navigationGroups,
  priorityItems,
  quickCreateItems,
  recentActivities,
  upcomingItems,
} from "./dashboard-data";
import type { DashboardSnapshot } from "./dashboard-query";

type Tone = "critical" | "warning" | "attention";

type DashboardViewer = {
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

function Brand() {
  return (
    <a className="brand-lockup" href="#main" aria-label="iROUP Portal">
      <span className="brand-mark" aria-hidden="true">
        iR
      </span>
      <span>
        <strong>iROUP Portal</strong>
        <small>กองบริการการศึกษา</small>
        <small>มหาวิทยาลัยพะเยา</small>
      </span>
    </a>
  );
}

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

function SidebarContent({
  access,
  onNavigate,
}: {
  access?: CurrentUserAccess;
  onNavigate?: () => void;
}) {
  const canView = (module: ModuleKey) =>
    !access || Boolean(access.modules[module]?.view);

  return (
    <div className="sidebar-content">
      <Brand />
      <nav className="sidebar-nav" aria-label="เมนูหลัก">
        {navigationGroups.map((item) => {
          const visibleChildren =
            "children" in item
              ? item.children.filter((child) => canView(child.module))
              : [];
          const itemVisible =
            !("module" in item) ||
            canView(item.module) ||
            visibleChildren.length > 0;
          if (!itemVisible) return null;

          const Icon = item.icon;
          return (
            <div className="nav-group" key={item.label}>
              <a
                className={cn(
                  "nav-item",
                  "active" in item && item.active && "nav-item-active",
                )}
                href={item.href}
                onClick={onNavigate}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
                {"children" in item ? (
                  <ChevronDown className="nav-chevron" aria-hidden="true" />
                ) : null}
              </a>
              {"children" in item ? (
                <div className="nav-children">
                  {visibleChildren.map((child) => {
                    const ChildIcon = child.icon;
                    return (
                      <a
                        className="nav-child"
                        href={child.href}
                        key={child.label}
                        onClick={onNavigate}
                      >
                        <ChildIcon aria-hidden="true" />
                        <span>{child.label}</span>
                        {"internal" in child && child.internal ? (
                          <LockKeyhole
                            className="nav-lock"
                            aria-label="ข้อมูลภายใน"
                          />
                        ) : null}
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <ChevronLeft aria-hidden="true" />
        <span>ย่อเมนู</span>
      </div>
    </div>
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
  liveMode = false,
}: {
  query: string;
  liveMode?: boolean;
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
        {liveMode ? (
          <div className="search-empty">
            เชื่อมต่อฐานข้อมูลแล้ว — ยังไม่มีงานในคิวดำเนินการ
          </div>
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
                <small>
                  {snapshot
                    ? value === 0
                      ? "ยังไม่มีข้อมูลในฐานข้อมูล"
                      : "ข้อมูลจาก Supabase"
                    : item.detail}
                </small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActivityList({ liveMode = false }: { liveMode?: boolean }) {
  return (
    <section className="lower-panel" id="activity">
      <SectionHeading>กิจกรรมล่าสุด</SectionHeading>
      <div className="activity-list">
        {liveMode ? (
          <div className="search-empty">ยังไม่มีกิจกรรมในระบบ</div>
        ) : recentActivities.map((item) => {
          const Icon = item.icon;
          return (
            <div className="activity-row" key={`${item.time}-${item.title}`}>
              <time>{item.time}</time>
              <span className="activity-icon" aria-hidden="true">
                <Icon />
              </span>
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
            </div>
          );
        })}
      </div>
      <a className="panel-link" href="#priority-work">
        ดูทั้งหมด <ArrowRight aria-hidden="true" />
      </a>
    </section>
  );
}

function UpcomingList({ liveMode = false }: { liveMode?: boolean }) {
  return (
    <section className="lower-panel">
      <SectionHeading>กำหนดการใกล้ถึง</SectionHeading>
      <div className="upcoming-list">
        {liveMode ? (
          <div className="search-empty">ยังไม่มีกำหนดการในระบบ</div>
        ) : upcomingItems.map((item) => (
          <div className="upcoming-row" key={`${item.day}-${item.title}`}>
            <time className="upcoming-date">
              <strong>{item.day}</strong>
              <small>{item.month}</small>
            </time>
            <time className="upcoming-time">{item.time}</time>
            <span className="upcoming-copy">
              <strong>{item.title}</strong>
              <small>
                {item.module}
                {"internal" in item && item.internal ? (
                  <LockKeyhole aria-label="ข้อมูลภายใน" />
                ) : null}
              </small>
            </span>
          </div>
        ))}
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
              aria-label="การแจ้งเตือน 12 รายการ"
            >
              <Bell />
              <span>12</span>
            </Button>
            <Separator orientation="vertical" className="account-separator" />
            <div className="account">
              <Avatar size="lg">
                <AvatarFallback>{initials || "UP"}</AvatarFallback>
              </Avatar>
              <span>
                <strong>{viewer.displayName}</strong>
                <small>{viewer.role}</small>
              </span>
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
                      <button
                        key={item.label}
                        onClick={() => setQuickAddOpen(false)}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                        {"internal" in item && item.internal ? (
                          <LockKeyhole aria-label="ข้อมูลภายใน" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              </div>
            ) : null}
          </div>

          <PriorityList query={query} liveMode={Boolean(snapshot)} />
          <ModuleOverview access={access} snapshot={snapshot} />
          <div className="lower-grid">
            <ActivityList liveMode={Boolean(snapshot)} />
            <UpcomingList liveMode={Boolean(snapshot)} />
          </div>
        </main>
      </div>
    </div>
  );
}
