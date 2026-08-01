import { EditContentPage } from "@/features/content-records/content-pages";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditContentPage module="events" id={id} />;
}
