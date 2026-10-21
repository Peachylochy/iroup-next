// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { ContentVisual } from "./server";
import { hashImage, validateManualImage } from "./image-validation";
import type { VisualDetail, VisualUploadInput } from "./types";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), serviceRpc: vi.fn(), getUser: vi.fn(), upload: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.serviceRpc, storage: { from: () => ({ upload: mocks.upload, download: mocks.download }) } }) }));
const work = "00000000-0000-4000-8000-000000000001";
const briefId = "00000000-0000-4000-8000-000000000002";
const asset = "00000000-0000-4000-8000-000000000003";
const actor = "00000000-0000-4000-8000-000000000004";
const ticket = "00000000-0000-4000-8000-000000000005";
const path = `work-items/${work}/${ticket}.png`;
const input: VisualUploadInput = { work_item_id: work, brief_id: briefId, expected_revision: 1, idempotency_key: ticket,
  provenance: { source_kind: "manual_upload", rights_basis: "owned", rights_note: "Created by QA", attribution: "", origin_url: "", parent_asset_id: null } };
const detail: VisualDetail = { work_item: { id: work, row_version: 1, kind: "news", record_id: work }, content_versions: [], assets: [], asset_sets: [], reviews: [],
  briefs: [{ id: briefId, content_version_id: work, version_number: 1, based_on_id: null, state: "approved", is_latest: true, created_at: "2026-10-21T00:00:00Z",
    brief: { title: "Test", objective: "Explain", audience: "Readers", key_message: "News", design_notes: "", brand_notes: "Neutral", prompt: "", negative_prompt: "",
      width: 128, height: 96, panels: [{ key: "cover", label: "Cover", notes: "" }] } }] };
const result = { work_item_id: work, row_version: 2, asset_id: asset };
let image: File;
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.rpc.mockReset(); mocks.serviceRpc.mockReset(); mocks.download.mockReset(); mocks.upload.mockReset();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:30321"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-placeholder");
  mocks.getUser.mockResolvedValue({ data: { user: { id: actor } }, error: null });
  mocks.rpc.mockResolvedValueOnce({ data: detail, error: null }).mockResolvedValueOnce({ data: { upload_id: ticket, storage_path: path, row_version: 1, asset_id: null }, error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.serviceRpc.mockResolvedValue({ data: result, error: null });
  const bytes = await sharp({ create: { width: 128, height: 96, channels: 3, background: "#604090" } }).png().toBuffer();
  image = new File([new Uint8Array(bytes)], "test.png", { type: "image/png" });
});
afterEach(() => vi.unstubAllEnvs());

describe("trusted manual image ingestion", () => {
  it("reserves verified bytes, never upserts, and finalizes with the session actor", async () => {
    const verified = await validateManualImage(image, { width: 128, height: 96 });
    expect(await ContentVisual.uploadImage(input, image)).toEqual(result);
    expect(mocks.rpc).toHaveBeenLastCalledWith("content_visual_execute", { p_command: { ...input, op: "reserve_upload", file: verified.verified } });
    expect(mocks.upload).toHaveBeenCalledWith(path, verified.bytes, { contentType: "image/png", cacheControl: "0", upsert: false });
    expect(mocks.serviceRpc).toHaveBeenCalledWith("content_visual_finalize_upload", { p_actor_id: actor, p_upload_id: ticket, p_verified: verified.verified });
  });
  it("reconciles exact bytes after an upload response is lost without overwriting", async () => {
    const verified = await validateManualImage(image, { width: 128, height: 96 });
    mocks.upload.mockResolvedValue({ error: { message: "already exists" } });
    mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(verified.bytes)]), error: null });
    expect(await ContentVisual.uploadImage(input, image)).toEqual(result);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(path);
  });
  it("retains an uncertain object and does not finalize when the downloaded hash differs", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "unknown" } });
    mocks.download.mockResolvedValue({ data: new Blob(["different bytes"]), error: null });
    await expect(ContentVisual.uploadImage(input, image)).rejects.toThrow("IMAGE_UPLOAD_PENDING");
    expect(mocks.serviceRpc).not.toHaveBeenCalled();
  });
  it("lets the database replay a completed request even when the original brief is now stale", async () => {
    mocks.rpc.mockReset().mockResolvedValueOnce({ data: { ...detail, briefs: [{ ...detail.briefs[0], state: "stale", is_latest: false }] }, error: null })
      .mockResolvedValueOnce({ data: { upload_id: ticket, storage_path: path, row_version: 2, asset_id: asset }, error: null });
    expect(await ContentVisual.uploadImage(input, image)).toEqual(result);
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.serviceRpc).not.toHaveBeenCalled();
  });
  it("does not store bytes when current authorization is rejected by the reservation RPC", async () => {
    mocks.rpc.mockReset().mockResolvedValueOnce({ data: detail, error: null }).mockResolvedValueOnce({ data: null, error: { message: "FORBIDDEN" } });
    await expect(ContentVisual.uploadImage(input, image)).rejects.toThrow("FORBIDDEN");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("does not reserve when the server credential is missing", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(ContentVisual.uploadImage(input, image)).rejects.toThrow("IMAGE_STORAGE_UNAVAILABLE");
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects a reservation path that escapes the current work item", async () => {
    mocks.rpc.mockReset().mockResolvedValueOnce({ data: detail, error: null }).mockResolvedValueOnce({ data: { upload_id: ticket, storage_path: `work-items/${actor}/${ticket}.png`, row_version: 1, asset_id: null }, error: null });
    await expect(ContentVisual.uploadImage(input, image)).rejects.toThrow("IMAGE_STORAGE_UNAVAILABLE");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("never uploads without a verified authenticated session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(ContentVisual.uploadImage(input, image)).rejects.toThrow("AUTH_REQUIRED");
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
  });
});
describe("private image proxy boundary", () => {
  it("uses server authorization and checks stored bytes against registered digest", async () => {
    const bytes = Buffer.from(await image.arrayBuffer());
    mocks.serviceRpc.mockResolvedValue({ data: { storage_path: path, mime_type: "image/png", sha256: hashImage(bytes), size_bytes: bytes.length }, error: null });
    mocks.download.mockResolvedValue({ data: image, error: null });
    expect(await ContentVisual.loadAsset(asset)).toEqual({ bytes: await image.arrayBuffer(), mimeType: "image/png" });
    expect(mocks.serviceRpc).toHaveBeenCalledWith("content_visual_asset_file", { p_actor_id: actor, p_asset_id: asset });
  });
  it("does not disclose stored data after authorization is rejected", async () => {
    mocks.serviceRpc.mockResolvedValue({ data: null, error: { message: "FORBIDDEN" } });
    await expect(ContentVisual.loadAsset(asset)).rejects.toThrow("FORBIDDEN");
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("rejects changed or corrupt object bytes", async () => {
    mocks.serviceRpc.mockResolvedValue({ data: { storage_path: path, mime_type: "image/png", sha256: "a".repeat(64), size_bytes: 3 }, error: null });
    mocks.download.mockResolvedValue({ data: new Blob(["abc"]), error: null });
    await expect(ContentVisual.loadAsset(asset)).rejects.toThrow("IMAGE_INVALID");
  });
});
