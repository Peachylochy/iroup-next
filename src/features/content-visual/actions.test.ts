import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute, uploadImage, revalidatePath } = vi.hoisted(() => ({ execute: vi.fn(), uploadImage: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/features/content-production/content-production", () => ({ ContentProduction: { visual: { execute, uploadImage } } }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { executeVisualCommand, uploadVisualImage } from "./actions";

const base = { work_item_id: "0a844b33-33f8-4512-9b97-801f67e7b6c1", expected_revision: 3, idempotency_key: "0a844b33-33f8-4512-9b97-801f67e7b6c2" };
const briefId = "0a844b33-33f8-4512-9b97-801f67e7b6c3";
const command = { ...base, op: "review_brief", brief_id: briefId, decision: "submit", note: "ตรวจข้อมูลครบแล้ว" };
const upload = { ...base, brief_id: briefId, provenance: { source_kind: "manual_upload", rights_basis: "owned", rights_note: "สร้างผลงานเอง", attribution: "", origin_url: "", parent_asset_id: null } };
const result = { work_item_id: base.work_item_id, row_version: 4, brief_id: briefId };

function form(value: unknown = command) {
  const data = new FormData();
  data.set("command", JSON.stringify(value));
  return data;
}
function uploadForm(value: unknown = upload) {
  const data = form(value);
  data.set("image", new File([new Uint8Array([1, 2, 3])], "manual-cover.png", { type: "image/png" }));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  execute.mockResolvedValue(result);
  uploadImage.mockResolvedValue(result);
});

describe("visual action validation and side effects", () => {
  it.each([undefined, "", "{", "x".repeat(120001)])("rejects absent, malformed, or oversized JSON before the application boundary", async (raw) => {
    const data = new FormData();
    if (raw !== undefined) data.set("command", raw);
    expect(await executeVisualCommand({}, data)).toMatchObject({ code: "POLICY_VIOLATION", error: expect.any(String) });
    expect(await uploadVisualImage({}, data)).toMatchObject({ code: "POLICY_VIOLATION", error: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a file supplied as the JSON command field", async () => {
    const data = new FormData();
    data.set("command", new File(["{}"], "command.json"));
    expect(await executeVisualCommand({}, data)).toMatchObject({ code: "POLICY_VIOLATION" });
    expect(await uploadVisualImage({}, data)).toMatchObject({ code: "POLICY_VIOLATION" });
    expect(execute).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { ...command, actor_id: "forged" }, { ...command, expected_revision: 0 }, { ...command, decision: "publish" }])("rejects malformed or overpowered commands before execution (%j)", async (input) => {
    expect(await executeVisualCommand({}, form(input))).toMatchObject({ code: "POLICY_VIOLATION", error: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    { ...upload, actor_id: "forged" }, { ...upload, storage_path: "forged/file.png" },
    { ...upload, provenance: { ...upload.provenance, rights_note: " " } },
    { ...upload, provenance: { ...upload.provenance, origin_url: "https://user:secret@example.org" } },
  ])("rejects forged or invalid upload metadata before reading or storing the file", async (input) => {
    expect(await uploadVisualImage({}, uploadForm(input))).toMatchObject({ code: "POLICY_VIOLATION", error: expect.any(String) });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([null, "image.png", "data:image/png;base64,arbitrary"])("requires an actual uploaded File, not %s", async (file) => {
    const data = form(upload);
    if (file !== null) data.set("image", file);
    expect(await uploadVisualImage({}, data)).toMatchObject({ code: "IMAGE_INVALID", error: expect.stringMatching(/[ก-๙]/) });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("passes one validated editorial command with its unchanged request identity and revalidates only the content layout", async () => {
    expect(await executeVisualCommand({}, form())).toEqual({ success: true, result });
    expect(execute).toHaveBeenCalledExactlyOnceWith(command);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(revalidatePath.mock.calls).toEqual([["/content-production", "layout"]]);
  });

  it("passes the uploaded File and validated provenance unchanged to the module boundary and refreshes only after success", async () => {
    const data = uploadForm();
    expect(await uploadVisualImage({}, data)).toEqual({ success: true, result });
    expect(uploadImage).toHaveBeenCalledExactlyOnceWith(upload, data.get("image"));
    expect(execute).not.toHaveBeenCalled();
    expect(revalidatePath.mock.calls).toEqual([["/content-production", "layout"]]);
  });
});

describe("safe visual action failures", () => {
  it.each([
    "AUTH_REQUIRED", "PROFILE_INACTIVE", "FORBIDDEN", "NOT_FOUND", "STALE_REVISION", "IDEMPOTENCY_CONFLICT", "POLICY_VIOLATION",
    "VERSION_NOT_APPROVED", "BRIEF_NOT_APPROVED", "STALE_BRIEF", "STALE_VERSION", "SOURCE_STALE", "SOURCE_REQUIRED",
    "INVALID_TRANSITION", "ASSET_NOT_READY", "MISSING_LOCALE", "RIGHTS_REQUIRED",
  ])("maps %s to a safe Thai outcome while withholding database diagnostics", async (code) => {
    execute.mockRejectedValue(new Error(`Database error ${code}; storage/path=private/object.png SQL actor detail=secret`));
    const state = await executeVisualCommand({}, form());
    expect(state).toMatchObject({ code, error: expect.stringMatching(/[ก-๙]/) });
    expect(state.success).toBeUndefined();
    expect(state.error).not.toContain(code);
    expect(state.error).not.toContain("private/object.png");
    expect(state.error).not.toContain("secret");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["IMAGE_INVALID", "IMAGE_SIZE", "IMAGE_DIMENSIONS", "IMAGE_STORAGE_UNAVAILABLE", "IMAGE_UPLOAD_PENDING"])("maps upload failure %s without exposing raw decoder, storage, or credential information", async (code) => {
    uploadImage.mockRejectedValue(new Error(`${code}: provider Authorization Bearer secret; /private/object.png`));
    const state = await uploadVisualImage({}, uploadForm());
    expect(state).toMatchObject({ code, error: expect.stringMatching(/[ก-๙]/) });
    expect(state.success).toBeUndefined();
    expect(state.error).not.toContain("secret");
    expect(state.error).not.toContain("/private/object.png");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([new Error("unexpected internal detail secret"), new Error("STALE_REVISION_FOR_ANOTHER_MODULE secret"), { message: "FORBIDDEN secret" }])("uses a generic outcome for unknown errors and does not match partial error-code names", async (error) => {
    execute.mockRejectedValue(error);
    uploadImage.mockRejectedValue(error);
    for (const state of [await executeVisualCommand({}, form()), await uploadVisualImage({}, uploadForm())]) {
      expect(state).toMatchObject({ code: "VISUAL_FAILED", error: expect.stringMatching(/[ก-๙]/) });
      expect(state.error).not.toContain("secret");
      expect(state.success).toBeUndefined();
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
