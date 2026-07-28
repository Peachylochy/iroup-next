import { notFound, redirect } from "next/navigation";
import { MobilityDetailView } from "@/features/mobility/mobility-detail-view";
import { getMobilityDetail } from "@/features/mobility/mobility-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";
export default async function MobilityDetailPage({ params }: { params: Promise<{ id: string }> }) { const access = await getCurrentUserAccess(); if (!access) redirect("/login"); if (!hasWorkspaceAccess(access) || !access.modules.mobility?.view) redirect("/"); const mobility = await getMobilityDetail((await params).id); if (!mobility) notFound(); return <MobilityDetailView mobility={mobility} access={access} />; }
