import { redirect } from "next/navigation";
import { PartnerOrganizationForm } from "@/features/partners/partner-form";
import { getPartnerFormOptions } from "@/features/partners/partner-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function NewPartnerOrganizationPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.create) redirect("/mou/organizations");
  const [options, params] = await Promise.all([getPartnerFormOptions(), searchParams]);
  return <PartnerOrganizationForm access={access} partner={null} options={options} returnTo={params.returnTo} />;
}
