import { StaffMovementDetailPage } from "@/features/movements/movement-pages";

export default async function StaffMobilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StaffMovementDetailPage module="staff-mobility" id={id} />;
}
