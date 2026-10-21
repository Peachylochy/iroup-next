import { ContentProductionListPage, parseContentKind } from "@/features/content-production/pages";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = rawPage && /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) ? Math.min(1000000, Math.max(1, Number(rawPage))) : 1;
  return <ContentProductionListPage kind={parseContentKind(rawKind || "scholarship")} page={page} />;
}
