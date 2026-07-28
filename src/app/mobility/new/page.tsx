import { redirect } from "next/navigation";
import { MobilityForm } from "@/features/mobility/mobility-form";
import { getMobilityFormOptions } from "@/features/mobility/mobility-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";
export default async function NewMobilityPage() { const access = await getCurrentUserAccess(); if (!access) redirect("/login"); if (!hasWorkspaceAccess(access) || !access.modules.mobility?.create) redirect("/mobility"); return <MobilityForm mobility={null} options={await getMobilityFormOptions()} />; }
