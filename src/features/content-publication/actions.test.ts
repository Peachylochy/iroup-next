// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bundleId, command, digest, result, workId } from "./__tests__/fixtures";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), verify: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/features/content-production/content-production", () => ({ ContentProduction: { publication: { execute: mocks.execute, verify: mocks.verify } } }));
import { freezePublicationBundle, verifyPublicationBundle } from "./actions";
function form(value: unknown) { const input = new FormData(); input.set("command", JSON.stringify(value)); return input; }
beforeEach(() => { vi.clearAllMocks(); mocks.execute.mockResolvedValue(result); });

describe("Publication actions", () => {
  it("revalidates on freeze and never dispatches through the verify action", async () => {
    expect(await freezePublicationBundle({}, form(command))).toEqual({ success: true, result });
    expect(mocks.revalidate).toHaveBeenCalledWith("/content-production", "layout");
    mocks.revalidate.mockClear();
    const proof = { bundle_id: bundleId, digest, checked_at: "2026-10-21T09:00:00Z", checked_assets: 1 };
    mocks.verify.mockResolvedValue(proof);
    expect(await verifyPublicationBundle({}, form({ work_item_id: workId, bundle_id: bundleId }))).toEqual({ success: true, result: proof });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each(["{", "x".repeat(2001)])("rejects malformed/oversized command before execution", async (raw) => {
    const input = new FormData(); input.set("command", raw);
    expect(await freezePublicationBundle({}, input)).toMatchObject({ code: "POLICY_VIOLATION" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects payload, actor and verification proof injection", async () => {
    expect(await freezePublicationBundle({}, form({ ...command, actor_id: workId, payload: {} }))).toMatchObject({ code: "POLICY_VIOLATION" });
    expect(await verifyPublicationBundle({}, form({ work_item_id: workId, bundle_id: bundleId, verified: true }))).toMatchObject({ code: "POLICY_VIOLATION" });
    expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
  });
  it.each(["FORBIDDEN", "STALE_REVISION", "BUNDLE_STALE", "ASSET_NOT_READY", "IMAGE_INVALID", "IDEMPOTENCY_CONFLICT"])("maps %s without exposing diagnostics", async (code) => {
    mocks.verify.mockRejectedValue(new Error(`${code}: private/object and database detail`));
    const response = await verifyPublicationBundle({}, form({ work_item_id: workId, bundle_id: bundleId }));
    expect(response.code).toBe(code); expect(response.error).not.toContain("private/object"); expect(response.error).not.toContain("database");
  });
  it("hides unexpected database/provider internals", async () => {
    mocks.execute.mockRejectedValue(new Error("sensitive unexpected diagnostics"));
    expect(await freezePublicationBundle({}, form(command))).toEqual({ code: "PUBLICATION_FAILED", error: "ทำรายการไม่สำเร็จ กรุณาลองใหม่" });
  });
});
