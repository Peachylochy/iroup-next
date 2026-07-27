import { redirect } from "next/navigation";

import { MouForm } from "@/features/mou/mou-form";
import { getMouFormOptions } from "@/features/mou/mou-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function NewMouPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.create) redirect("/mou");

  const options = await getMouFormOptions();
  return <MouForm access={access} agreement={null} options={options} />;
}
