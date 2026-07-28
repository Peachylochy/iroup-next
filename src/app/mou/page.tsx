import { redirect } from "next/navigation";

import { MouWorkspace } from "@/features/mou/mou-workspace";
import { getMouAgreements } from "@/features/mou/mou-query";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

type MouPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MouPage({ searchParams }: MouPageProps) {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");
  if (!access.modules.mou?.view) redirect("/");

  const [agreements, params] = await Promise.all([getMouAgreements(), searchParams]);
  const filterValue = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };
  const renewalBefore = (() => {
    if (filterValue("renewal") !== "90") return undefined;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 90);
    return cutoff.toISOString().slice(0, 10);
  })();

  return (
    <MouWorkspace
      access={access}
      agreements={agreements}
      initialFilters={{
        status: filterValue("status"),
        workflow: filterValue("workflow"),
        country: filterValue("country"),
        owner: filterValue("owner"),
        renewalBefore,
      }}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}
