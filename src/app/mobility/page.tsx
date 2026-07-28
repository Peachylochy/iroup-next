import { redirect } from "next/navigation";

import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";
import { getMobilityFormOptions, getMovementCases } from "@/features/mobility/mobility-query";
import { MobilityWorkspace } from "@/features/mobility/mobility-workspace";

type Props = {
  searchParams: Promise<{ category?: string }>;
};

export default async function MobilityPage({ searchParams }: Props) {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");
  if (!access.modules.mobility?.view && !access.modules.mou?.view) redirect("/");

  const { category } = await searchParams;
  const [cases, options] = await Promise.all([
    getMovementCases(category),
    getMobilityFormOptions(),
  ]);

  const viewer = {
    displayName: access.profile.display_name,
    email: access.profile.email,
    role: roleLabel(access.roles),
  };

  return (
    <MobilityWorkspace
      access={access}
      cases={cases}
      options={options}
      initialCategory={category}
      viewer={viewer}
    />
  );
}
