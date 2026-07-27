import { notFound, redirect } from "next/navigation";
import { PartnerOrganizationForm } from "@/features/partners/partner-form";
import { getPartnerFormOptions, getPartnerOrganization } from "@/features/partners/partner-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function EditPartnerOrganizationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.update) redirect("/mou/organizations");
  const [, options, partner, query] = await Promise.all([params, getPartnerFormOptions(), params.then(({ id }) => getPartnerOrganization(id)), searchParams]);
  if (!partner) notFound();
  return <PartnerOrganizationForm access={access} partner={partner} options={options} returnTo={query.returnTo} />;
}
