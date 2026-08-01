import { notFound, redirect } from "next/navigation";

import { getMobilityFormOptions } from "@/features/mobility/mobility-query";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

import {
  staffMovementModules,
  type StaffMovementModule,
} from "./config";
import { StaffMovementDetail } from "./movement-detail";
import { StaffMovementForm } from "./movement-form";
import { getStaffMovement, getStaffMovements } from "./movement-query";
import { StaffMovementWorkspace } from "./movement-workspace";

async function requireAccess(module: StaffMovementModule) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  const config = staffMovementModules[module];
  if (!hasWorkspaceAccess(access) || !access.modules[config.permission]?.view) {
    redirect("/");
  }
  return { access, config };
}

export async function StaffMovementListPage({
  module,
}: {
  module: StaffMovementModule;
}) {
  const { access } = await requireAccess(module);
  return (
    <StaffMovementWorkspace
      module={module}
      access={access}
      items={await getStaffMovements(module)}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}

export async function NewStaffMovementPage({
  module,
}: {
  module: StaffMovementModule;
}) {
  const { access, config } = await requireAccess(module);
  if (!access.modules[config.permission]?.create) redirect(config.route);
  return (
    <StaffMovementForm
      module={module}
      movement={null}
      options={await getMobilityFormOptions()}
    />
  );
}

export async function EditStaffMovementPage({
  module,
  id,
}: {
  module: StaffMovementModule;
  id: string;
}) {
  const { access, config } = await requireAccess(module);
  if (!access.modules[config.permission]?.update) redirect(config.route);
  const [movement, options] = await Promise.all([
    getStaffMovement(module, id),
    getMobilityFormOptions(),
  ]);
  if (!movement) notFound();
  return (
    <StaffMovementForm
      module={module}
      movement={movement}
      options={options}
    />
  );
}

export async function StaffMovementDetailPage({
  module,
  id,
}: {
  module: StaffMovementModule;
  id: string;
}) {
  const { access } = await requireAccess(module);
  const movement = await getStaffMovement(module, id);
  if (!movement) notFound();
  return (
    <StaffMovementDetail
      module={module}
      movement={movement}
      access={access}
    />
  );
}
