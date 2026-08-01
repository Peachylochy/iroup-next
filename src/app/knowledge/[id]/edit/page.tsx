import { EditContentPage } from "@/features/content-records/content-pages";

export default async function EditKnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditContentPage module="knowledge" id={id} />;
}
