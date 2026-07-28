import { notFound, redirect } from "next/navigation";

import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";
import { getMobilityFormOptions, getMovementCaseById } from "@/features/mobility/mobility-query";
import { MobilityDetailView } from "@/features/mobility/mobility-detail-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MobilityDetailPage({ params }: Props) {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");
  if (!access.modules.mobility?.view && !access.modules.mou?.view) redirect("/");

  const { id } = await params;
  const [movementCase, options] = await Promise.all([
    getMovementCaseById(id),
    getMobilityFormOptions(),
  ]);

  if (!movementCase) {
    notFound();
  }

  const viewer = {
    displayName: access.profile.display_name,
    email: access.profile.email,
    role: roleLabel(access.roles),
  };

  return (
    <MobilityDetailView
      access={access}
      movementCase={movementCase}
      options={options}
      viewer={viewer}
    />
  );
}
