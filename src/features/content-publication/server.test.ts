// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assetId, bundleId, command, detail, result, workId } from "./__tests__/fixtures";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), loadAsset: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: mocks.rpc })) }));
vi.mock("@/features/content-visual/server", () => ({ ContentVisual: { loadAsset: mocks.loadAsset } }));
import { ContentPublication } from "./server";
const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
const hash = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
const verify = { work_item_id: workId, bundle_id: bundleId };
function current() { const value = detail(); value.selected!.payload.images[0].sha256 = hash; return value; }
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: current(), error: null }); mocks.loadAsset.mockResolvedValue({ bytes, mimeType: "image/png" }); });

describe("Publication server", () => {
  it("sends only persisted references to the freeze RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    expect(await ContentPublication.execute(command)).toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledWith("content_publication_execute", { p_command: command });
    expect(mocks.loadAsset).not.toHaveBeenCalled();
  });
  it("checks frozen bytes and current state twice before returning a dated result", async () => {
    const proof = await ContentPublication.verify(verify);
    expect(proof).toMatchObject({ bundle_id: bundleId, digest: current().selected!.digest, checked_assets: 1 });
    expect(Number.isNaN(Date.parse(proof.checked_at))).toBe(false);
    expect(mocks.loadAsset).toHaveBeenCalledWith(assetId);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("does not read bytes for an unauthorized or stale bundle", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "FORBIDDEN" } });
    await expect(ContentPublication.verify(verify)).rejects.toThrow("FORBIDDEN");
    const stale = current(); stale.selected!.state = "stale"; stale.selected!.issues = ["CONTENT_NOT_APPROVED"];
    mocks.rpc.mockResolvedValueOnce({ data: stale, error: null });
    await expect(ContentPublication.verify(verify)).rejects.toThrow("BUNDLE_STALE");
    expect(mocks.loadAsset).not.toHaveBeenCalled();
  });
  it("rejects a frozen hash or MIME mismatch", async () => {
    mocks.loadAsset.mockResolvedValueOnce({ bytes: new Uint8Array([9, 9, 9, 9]).buffer, mimeType: "image/png" });
    await expect(ContentPublication.verify(verify)).rejects.toThrow("IMAGE_INVALID");
    mocks.loadAsset.mockResolvedValueOnce({ bytes, mimeType: "image/jpeg" });
    await expect(ContentPublication.verify(verify)).rejects.toThrow("IMAGE_INVALID");
  });
  it("fails if access is revoked during a private asset read", async () => {
    mocks.loadAsset.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(ContentPublication.verify(verify)).rejects.toThrow("FORBIDDEN");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects source invalidation that happens while bytes are read", async () => {
    const stale = current(); stale.selected!.state = "stale"; stale.selected!.issues = ["CONTENT_NOT_APPROVED"];
    mocks.rpc.mockResolvedValueOnce({ data: current(), error: null }).mockResolvedValueOnce({ data: stale, error: null });
    await expect(ContentPublication.verify(verify)).rejects.toThrow("BUNDLE_STALE");
  });
  it("rejects concurrent editorial change even if the same bundle still reads current", async () => {
    const newer = current(); newer.work_item.row_version += 1;
    mocks.rpc.mockResolvedValueOnce({ data: current(), error: null }).mockResolvedValueOnce({ data: newer, error: null });
    await expect(ContentPublication.verify(verify)).rejects.toThrow("STALE_REVISION");
  });
  it("never reports successful verification when final permission check is denied", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: current(), error: null }).mockResolvedValueOnce({ data: null, error: { message: "FORBIDDEN" } });
    await expect(ContentPublication.verify(verify)).rejects.toThrow("FORBIDDEN");
  });
  it("rejects unknown fields before connecting to the database", async () => {
    await expect(ContentPublication.execute({ ...command, token: "untrusted" } as typeof command)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
