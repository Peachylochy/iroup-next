import { EditStaffMovementPage } from "@/features/movements/movement-pages";

export default async function EditTravelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditStaffMovementPage module="travel" id={id} />;
}
