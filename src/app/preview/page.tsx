import { notFound } from "next/navigation";

import { DashboardWorkspace } from "@/features/dashboard/dashboard-workspace";

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DashboardWorkspace />;
}
