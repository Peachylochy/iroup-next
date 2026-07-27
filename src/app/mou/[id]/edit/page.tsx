import { notFound, redirect } from "next/navigation";

import { MouForm } from "@/features/mou/mou-form";
import { getMouAgreementForForm, getMouFormOptions } from "@/features/mou/mou-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

type Props = { params: Promise<{ id: string }> };

export default async function EditMouPage({ params }: Props) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.view) redirect("/");

  const { id } = await params;
  const [agreement, options] = await Promise.all([
    getMouAgreementForForm(id),
    getMouFormOptions(),
  ]);

  if (!agreement) notFound();
  return <MouForm access={access} agreement={agreement} options={options} />;
}
