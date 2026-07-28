import { notFound, redirect } from "next/navigation";

import { MouDetailView } from "@/features/mou/mou-detail-view";
import { getMouDetail } from "@/features/mou/mou-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function MouDetailPage({ params, searchParams }: Props) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.view) redirect("/");

  const { id } = await params;
  const { created } = await searchParams;
  const mou = await getMouDetail(id);

  if (!mou) notFound();

  return <MouDetailView mou={mou} access={access} showCreatedNotice={created === "1"} />;
}
