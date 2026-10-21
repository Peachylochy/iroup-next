import { ContentProductionEditorPage, parseContentKind } from "@/features/content-production/pages";

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return <ContentProductionEditorPage kind={parseContentKind(kind)} />;
}
