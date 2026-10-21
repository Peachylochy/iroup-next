import { ContentProduction } from "@/features/content-production/content-production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params;
    const image = await ContentProduction.visual.loadAsset(assetId);
    return new Response(image.bytes, { headers: {
      "Content-Type": image.mimeType, "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) {
    return new Response(null, { status: error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 404,
      headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
  }
}
