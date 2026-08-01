import { EditContentPage } from "@/features/content-records/content-pages";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditContentPage module="news" id={id} />;
}
