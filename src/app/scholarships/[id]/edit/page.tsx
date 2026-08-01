import { EditContentPage } from "@/features/content-records/content-pages";

export default async function EditScholarshipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditContentPage module="scholarship" id={id} />;
}
