import { ContentProductionEditorPage, parseContentKind } from "@/features/content-production/pages";

export default async function Page({ params }: { params: Promise<{ kind: string; recordId: string }> }) {
  const { kind, recordId } = await params;
  return <ContentProductionEditorPage kind={parseContentKind(kind)} recordId={recordId} />;
}
