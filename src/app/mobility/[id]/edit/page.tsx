import { notFound, redirect } from "next/navigation";
import { MobilityForm } from "@/features/mobility/mobility-form";
import { getMobilityForForm, getMobilityFormOptions } from "@/features/mobility/mobility-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";
export default async function EditMobilityPage({ params }: { params: Promise<{ id: string }> }) { const access = await getCurrentUserAccess(); if (!access) redirect("/login"); if (!hasWorkspaceAccess(access) || !access.modules.mobility?.view) redirect("/mobility"); const id = (await params).id; const [mobility, options] = await Promise.all([getMobilityForForm(id), getMobilityFormOptions()]); if (!mobility) notFound(); return <MobilityForm mobility={mobility} options={options} />; }
