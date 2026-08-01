import { StaffMovementDetailPage } from "@/features/movements/movement-pages";

export default async function TravelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StaffMovementDetailPage module="travel" id={id} />;
}
