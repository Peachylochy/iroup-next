"use client";

import { useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { signOutAction } from "@/features/auth/actions";
import type { CurrentUserAccess } from "@/lib/auth/access";

import { SidebarContent } from "./workspace-sidebar";

type WorkspaceChromeProps = {
  access?: CurrentUserAccess;
  viewer: {
    displayName: string;
    email: string;
    role: string;
  };
  title: string;
  activePath?: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  searchPlaceholder?: string;
  children: React.ReactNode;
};

function getInitials(displayName: string) {
  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "UP"
  );
}

export function WorkspaceChrome({
  access,
  viewer,
  title,
  activePath = "/",
  query = "",
  onQueryChange,
  searchPlaceholder = "ค้นหาข้อมูล",
  children,
}: WorkspaceChromeProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="workspace-shell">
      <aside className="desktop-sidebar">
        <SidebarContent access={access} activePath={activePath} />
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
              activePath={activePath}
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
            <strong>{title}</strong>
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
            {onQueryChange ? (
              <label className="search-control">
                <Search aria-hidden="true" />
                <span className="sr-only">{searchPlaceholder}</span>
                <Input
                  type="search"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                />
                <kbd>⌘K</kbd>
              </label>
            ) : null}
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
                <AvatarFallback>{getInitials(viewer.displayName)}</AvatarFallback>
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
        {children}
      </div>
    </div>
  );
}
