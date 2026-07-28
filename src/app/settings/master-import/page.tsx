import { redirect } from "next/navigation";
import { MasterImportWorkspace } from "@/features/master-import/master-import-workspace";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";
export default async function MasterImportPage() { const access = await getCurrentUserAccess(); if (!access) redirect("/login"); if (!hasWorkspaceAccess(access) || !access.roles.includes("system_admin")) redirect("/"); return <MasterImportWorkspace access={access} viewer={{ displayName: access.profile.display_name, email: access.profile.email, role: roleLabel(access.roles) }} />; }
