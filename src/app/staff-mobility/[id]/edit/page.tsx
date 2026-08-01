import { EditStaffMovementPage } from "@/features/movements/movement-pages";

export default async function EditStaffMobilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditStaffMovementPage module="staff-mobility" id={id} />;
}
