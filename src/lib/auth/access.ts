import { createClient } from "@/lib/supabase/server";

export const moduleKeys = [
  "mou",
  "mobility",
  "travel",
  "scholarship",
  "events",
  "news",
  "knowledge",
  "reports",
  "settings",
] as const;

export const appRoles = [
  "system_admin",
  "office_admin",
  "editor",
  "viewer",
] as const;

export type ModuleKey = (typeof moduleKeys)[number];
export type AppRole = (typeof appRoles)[number];
export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "publish"
  | "delete"
  | "import";

export type ModulePermission = Record<PermissionAction, boolean>;

export type CurrentUserAccess = {
  user_id: string;
  profile: {
    email: string;
    display_name: string;
    preferred_locale: "th" | "en";
    active: boolean;
  };
  roles: AppRole[];
  modules: Record<ModuleKey, ModulePermission>;
};

function isCurrentUserAccess(value: unknown): value is CurrentUserAccess {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CurrentUserAccess>;
  return (
    typeof candidate.user_id === "string" &&
    Boolean(candidate.profile) &&
    Array.isArray(candidate.roles) &&
    Boolean(candidate.modules)
  );
}

export async function getCurrentUserAccess() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_user_access");

  if (error) {
    throw new Error(`Unable to read current user access: ${error.message}`);
  }

  return isCurrentUserAccess(data) ? data : null;
}

export function hasWorkspaceAccess(access: CurrentUserAccess | null) {
  if (!access?.profile.active) return false;
  if (access.roles.length > 0) return true;
  return moduleKeys.some((module) => access.modules[module]?.view);
}

export function roleLabel(roles: AppRole[]) {
  if (roles.includes("system_admin")) return "ผู้ดูแลระบบ";
  if (roles.includes("office_admin")) return "ผู้ดูแลสำนักงาน";
  if (roles.includes("editor")) return "เจ้าหน้าที่ผู้แก้ไขข้อมูล";
  if (roles.includes("viewer")) return "ผู้ดูข้อมูล";
  return "รออนุมัติสิทธิ์";
}
