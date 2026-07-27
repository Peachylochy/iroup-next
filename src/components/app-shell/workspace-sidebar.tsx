"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, LockKeyhole } from "lucide-react";

import type { CurrentUserAccess, ModuleKey } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { navigationGroups } from "@/features/dashboard/dashboard-data";

export function Brand() {
  return (
    <Link className="brand-lockup" href="/" aria-label="iROUP Portal">
      <span className="brand-mark" aria-hidden="true">iR</span>
      <span>
        <strong>iROUP Portal</strong>
        <small>กองบริการการศึกษา</small>
        <small>มหาวิทยาลัยพะเยา</small>
      </span>
    </Link>
  );
}

export function SidebarContent({
  access,
  onNavigate,
  activePath = "/",
}: {
  access?: CurrentUserAccess;
  onNavigate?: () => void;
  activePath?: string;
}) {
  const canView = (module: ModuleKey) =>
    !access || Boolean(access.modules[module]?.view);
  const resolveHref = (href: string) =>
    activePath !== "/" && href.startsWith("#") ? `/${href}` : href;

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
                  item.href === activePath && "nav-item-active",
                )}
                href={resolveHref(item.href)}
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
                        href={resolveHref(child.href)}
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
