"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { signOutAction } from "@/features/auth/actions";
import type { DashboardViewer } from "@/features/dashboard/dashboard-workspace";
import { SidebarContent } from "@/components/app-shell/workspace-sidebar";
import type {
  CurrentUserAccess,
  ModuleKey,
  ModulePermission,
  PermissionAction,
} from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import {
  saveUserAccessAction,
  type SaveUserAccessState,
} from "./actions";
import {
  getRoleLabel,
  managedModuleKeys,
  moduleLabels,
  permissionActions,
  roleOptions,
  type ManagedUser,
} from "./user-access";

const moduleKeys = managedModuleKeys;

type Props = {
  access: CurrentUserAccess;
  currentUserId: string;
  users: ManagedUser[];
  viewer: DashboardViewer;
};

const emptyPermission: ModulePermission = {
  view: false,
  create: false,
  update: false,
  publish: false,
  delete: false,
  import: false,
};

function clonePermissions(user: ManagedUser) {
  return Object.fromEntries(
    moduleKeys.map((module) => [
      module,
      { ...emptyPermission, ...user.modules[module] },
    ]),
  ) as Record<ModuleKey, ModulePermission>;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "UP"
  );
}

function visibleModuleCount(user: ManagedUser) {
  if (user.role === "system_admin" || user.role === "office_admin") {
    return moduleKeys.length;
  }
  return moduleKeys.filter((module) => user.modules[module]?.view).length;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Check data-icon="inline-start" />
      {pending ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}
    </Button>
  );
}

export function UserManagementWorkspace({
  access,
  currentUserId,
  users,
  viewer,
}: Props) {
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<ManagedUser["role"]>(null);
  const [active, setActive] = useState(true);
  const [permissions, setPermissions] = useState<
    Record<ModuleKey, ModulePermission>
  >(() =>
    Object.fromEntries(
      moduleKeys.map((module) => [module, { ...emptyPermission }]),
    ) as Record<ModuleKey, ModulePermission>,
  );
  const [saveState, saveAction] = useActionState<
    SaveUserAccessState,
    FormData
  >(saveUserAccessAction, { message: "" });

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    if (!normalized) return users;
    return users.filter((user) =>
      `${user.display_name} ${user.email} ${getRoleLabel(user.role)}`
        .toLocaleLowerCase("th")
        .includes(normalized),
    );
  }, [query, users]);

  const openEditor = (user: ManagedUser) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setActive(user.active);
    setPermissions(clonePermissions(user));
  };

  const updatePermission = (
    module: ModuleKey,
    action: PermissionAction,
    checked: boolean,
  ) => {
    setPermissions((current) => ({
      ...current,
      [module]: {
        ...current[module],
        [action]: checked,
        ...(action === "view" && !checked
          ? {
              create: false,
              update: false,
              publish: false,
              delete: false,
              import: false,
            }
          : action !== "view" && checked
            ? { view: true }
            : {}),
      },
    }));
  };

  const isAutomaticAccess =
    selectedRole === "system_admin" || selectedRole === "office_admin";
  const isSelfAdmin = selectedUser?.id === currentUserId;

  return (
    <div className="workspace-shell">
      <aside className="desktop-sidebar">
        <SidebarContent access={access} activePath="/settings/users" />
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
              activePath="/settings/users"
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
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu />
            </Button>
            <strong>ผู้ใช้และสิทธิ์</strong>
          </div>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              size="icon"
              className="notification-button"
              aria-label="การแจ้งเตือน"
            >
              <Bell />
            </Button>
            <Separator orientation="vertical" className="account-separator" />
            <div className="account">
              <Avatar size="lg">
                <AvatarFallback>{initials(viewer.displayName)}</AvatarFallback>
              </Avatar>
              <span>
                <strong>{viewer.displayName}</strong>
                <small>{viewer.role}</small>
              </span>
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
            </div>
          </div>
        </header>

        <main className="settings-main">
          <div className="settings-heading">
            <div>
              <p className="settings-eyebrow">ตั้งค่าระบบ</p>
              <h1>ผู้ใช้และสิทธิ์</h1>
              <p>
                อนุมัติบัญชี กำหนดบทบาท และควบคุมการเข้าถึงแต่ละโมดูล
              </p>
            </div>
            <div className="settings-summary">
              <span className="settings-summary-icon">
                <ShieldCheck aria-hidden="true" />
              </span>
              <span>
                <strong>{users.length}</strong>
                <small>บัญชีในระบบ</small>
              </span>
            </div>
          </div>

          <section className="user-directory" aria-labelledby="user-list-title">
            <div className="directory-toolbar">
              <div>
                <h2 id="user-list-title">รายชื่อผู้ใช้</h2>
                <p>เลือกผู้ใช้เพื่อกำหนดบทบาทและสิทธิ์การทำงาน</p>
              </div>
              <label className="directory-search">
                <Search aria-hidden="true" />
                <span className="sr-only">ค้นหาผู้ใช้</span>
                <Input
                  type="search"
                  placeholder="ค้นหาชื่อ อีเมล หรือบทบาท"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="user-table-wrap">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>ผู้ใช้</th>
                    <th>สถานะ</th>
                    <th>บทบาท</th>
                    <th>โมดูล</th>
                    <th>สร้างเมื่อ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-identity">
                          <Avatar>
                            <AvatarFallback>
                              {initials(user.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            <strong>{user.display_name}</strong>
                            <small>{user.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={cn(
                            "account-status",
                            user.active ? "is-active" : "is-disabled",
                          )}
                        >
                          {user.active ? "ใช้งาน" : "ปิดใช้งาน"}
                        </span>
                      </td>
                      <td>
                        <span className={cn("role-chip", `role-${user.role ?? "none"}`)}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td>
                        <strong className="module-count">
                          {visibleModuleCount(user)}/{moduleKeys.length}
                        </strong>
                      </td>
                      <td>
                        <time dateTime={user.created_at}>
                          {new Intl.DateTimeFormat("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(user.created_at))}
                        </time>
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditor(user)}
                        >
                          <SlidersHorizontal data-icon="inline-start" />
                          จัดการ
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 ? (
                <div className="directory-empty">
                  <UserCog aria-hidden="true" />
                  <strong>ไม่พบผู้ใช้ที่ค้นหา</strong>
                  <span>ลองค้นหาด้วยชื่อ อีเมล หรือบทบาทอื่น</span>
                </div>
              ) : null}
            </div>
          </section>
        </main>
      </div>

      {selectedUser ? (
        <div className="permission-layer" role="presentation">
          <button
            className="permission-backdrop"
            aria-label="ปิดหน้าต่างแก้ไขสิทธิ์"
            onClick={() => setSelectedUser(null)}
          />
          <aside
            className="permission-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="permission-panel-title"
          >
            <div className="permission-panel-header">
              <div>
                <p>จัดการผู้ใช้</p>
                <h2 id="permission-panel-title">{selectedUser.display_name}</h2>
                <span>{selectedUser.email}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="ปิด"
                onClick={() => setSelectedUser(null)}
              >
                <X />
              </Button>
            </div>

            <form action={saveAction} className="permission-form">
              <input type="hidden" name="userId" value={selectedUser.id} />
              <input type="hidden" name="active" value={String(active)} />
              <input
                type="hidden"
                name="permissions"
                value={JSON.stringify(permissions)}
              />

              <section className="permission-section">
                <div className="permission-section-title">
                  <h3>บทบาทในระบบ</h3>
                  <p>บทบาทกำหนดขอบเขตหลักของบัญชีนี้</p>
                </div>
                <label className="role-select">
                  <span className="sr-only">เลือกบทบาท</span>
                  <select
                    name="role"
                    value={selectedRole ?? ""}
                    disabled={isSelfAdmin}
                    onChange={(event) => {
                      const role =
                        (event.target.value as ManagedUser["role"] | "") || null;
                      setSelectedRole(role);
                    }}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" />
                </label>
                <p className="role-description">
                  {
                    roleOptions.find(
                      (option) => option.value === (selectedRole ?? ""),
                    )?.description
                  }
                </p>
                {isSelfAdmin ? (
                  <p className="self-protection-note">
                    <ShieldCheck aria-hidden="true" />
                    บัญชีที่กำลังใช้งานจะคงสิทธิ์ผู้ดูแลระบบ
                    เพื่อป้องกันการล็อกตัวเองออกจากระบบ
                  </p>
                ) : null}
              </section>

              <section className="permission-section module-permission-section">
                <div className="permission-section-title">
                  <h3>สิทธิ์รายโมดูล</h3>
                  <p>
                    {isAutomaticAccess
                      ? "บทบาทผู้ดูแลได้รับสิทธิ์ทุกโมดูลโดยอัตโนมัติ"
                      : selectedRole
                        ? "เลือกการดำเนินการที่อนุญาตในแต่ละโมดูล"
                        : "กำหนดบทบาทก่อนเปิดสิทธิ์รายโมดูล"}
                  </p>
                </div>
                <div className="permission-matrix-wrap">
                  <table className="permission-matrix">
                    <thead>
                      <tr>
                        <th>โมดูล</th>
                        {permissionActions.map((action) => (
                          <th key={action.key}>{action.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {moduleKeys.map((module) => (
                        <tr key={module}>
                          <th>{moduleLabels[module]}</th>
                          {permissionActions.map((action) => {
                            const disabled =
                              !selectedRole ||
                              isAutomaticAccess ||
                              (selectedRole === "viewer" &&
                                action.key !== "view");
                            return (
                              <td key={action.key}>
                                <label className="permission-check">
                                  <input
                                    type="checkbox"
                                    aria-label={`${moduleLabels[module]} ${action.label}`}
                                    disabled={disabled}
                                    checked={
                                      isAutomaticAccess ||
                                      permissions[module][action.key]
                                    }
                                    onChange={(event) =>
                                      updatePermission(
                                        module,
                                        action.key,
                                        event.target.checked,
                                      )
                                    }
                                  />
                                  <span aria-hidden="true">
                                    <Check />
                                  </span>
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="account-toggle-row">
                <span>
                  <strong>เปิดใช้งานบัญชี</strong>
                  <small>ปิดบัญชีเพื่อระงับการเข้าถึงชั่วคราว</small>
                </span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={isSelfAdmin}
                    onChange={(event) => setActive(event.target.checked)}
                  />
                  <span aria-hidden="true" />
                  <span className="sr-only">เปิดใช้งานบัญชี</span>
                </label>
              </section>

              {saveState.message ? (
                <p
                  className={cn(
                    "permission-message",
                    saveState.success && "is-success",
                  )}
                  role="status"
                >
                  {saveState.message}
                </p>
              ) : null}

              <div className="permission-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
                >
                  ยกเลิก
                </Button>
                <SaveButton />
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
