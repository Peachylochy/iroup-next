import { redirect } from "next/navigation";

import { MouForm } from "@/features/mou/mou-form";
import { getMouFormOptions } from "@/features/mou/mou-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function NewMouPage({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.create) redirect("/mou");

  const [options, params] = await Promise.all([getMouFormOptions(), searchParams]);
  const partnerExists = options.partners.some((partner) => partner.id === params.partner);
  return <MouForm access={access} agreement={null} options={options} preselectedPartnerId={partnerExists ? params.partner : undefined} />;
}
