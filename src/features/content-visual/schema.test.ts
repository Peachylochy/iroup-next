import { describe, expect, it } from "vitest";

import { briefSchema, provenanceSchema, uploadInputSchema, visualCommandSchema, visualDetailSchema, visualResultSchema } from "./schema";
import type { ImageProvenance, VisualBriefInput, VisualDetail } from "./types";

const workItemId = "07f52ad7-6540-4bc5-907e-18c80c9a6821";
const versionId = "07f52ad7-6540-4bc5-907e-18c80c9a6822";
const briefId = "07f52ad7-6540-4bc5-907e-18c80c9a6823";
const assetId = "07f52ad7-6540-4bc5-907e-18c80c9a6824";
const requestId = "07f52ad7-6540-4bc5-907e-18c80c9a6825";
const base = { work_item_id: workItemId, expected_revision: 8, idempotency_key: requestId };

function brief(): VisualBriefInput {
  return { title: "ภาพทุนวิจัย", objective: "อธิบายโอกาสสมัครทุน", audience: "บุคลากร", key_message: "ตรวจรายละเอียดก่อนสมัคร",
    design_notes: "เน้นข้อความอ่านง่าย", brand_notes: "", prompt: "", negative_prompt: "", width: 1080, height: 1080,
    panels: [{ key: "cover", label: "ภาพปก", notes: "แสดงชื่อทุน" }, { key: "details", label: "รายละเอียด", notes: "" }] };
}
function provenance(): ImageProvenance {
  return { source_kind: "manual_upload", rights_basis: "owned", rights_note: "ผู้จัดทำเป็นเจ้าของภาพและข้อความ", attribution: "", origin_url: "", parent_asset_id: null };
}
function briefCommand() { return { ...base, op: "save_brief", content_version_id: versionId, brief: brief() }; }
function upload() { return { ...base, brief_id: briefId, provenance: provenance() }; }
function setCommand() { return { ...base, op: "save_set", brief_id: briefId, slots: [{ panel_key: "cover", asset_id: assetId, alt_text_th: "", alt_text_en: "" }] }; }
function detail(): VisualDetail {
  return { work_item: { id: workItemId, row_version: 8, kind: "news", record_id: versionId }, content_versions: [], briefs: [], assets: [], asset_sets: [], reviews: [] };
}

describe("visual brief authoring contract", () => {
  it("keeps a manual draft without prompt or brand guidance while preserving explicit dimensions and panel semantics", () => {
    expect(briefSchema.parse(brief())).toEqual(brief());
    expect(visualCommandSchema.parse(briefCommand())).toEqual(briefCommand());
  });

  it.each(["title", "objective", "audience", "key_message"] as const)("requires a meaningful %s instead of whitespace", (field) => {
    expect(briefSchema.safeParse({ ...brief(), [field]: " \t\n " }).success).toBe(false);
  });

  it.each([
    ["title", 200], ["objective", 2000], ["audience", 2000], ["key_message", 2000],
    ["design_notes", 8000], ["brand_notes", 8000], ["prompt", 8000], ["negative_prompt", 8000],
  ])("bounds %s at %i characters without truncating it", (field, limit) => {
    expect(briefSchema.safeParse({ ...brief(), [field]: "a".repeat(Number(limit)) }).success).toBe(true);
    expect(briefSchema.safeParse({ ...brief(), [field]: "a".repeat(Number(limit) + 1) }).success).toBe(false);
  });

  it.each([
    { width: 63 }, { height: 63 }, { width: 4097 }, { height: 4097 }, { width: 1080.5 }, { height: 1080.5 },
    { width: 4096, height: 4096 }, { width: "1080" }, { height: null },
  ])("rejects invalid or oversized image dimensions %j", (dimensions) => {
    expect(briefSchema.safeParse({ ...brief(), ...dimensions }).success).toBe(false);
  });

  it("accepts the exact sixteen-million-pixel boundary", () => {
    expect(briefSchema.safeParse({ ...brief(), width: 4000, height: 4000 }).success).toBe(true);
    expect(briefSchema.safeParse({ ...brief(), width: 64, height: 64 }).success).toBe(true);
  });

  it("requires one to six uniquely named semantic panels", () => {
    const panels = Array.from({ length: 6 }, (_, index) => ({ key: `panel_${index}`, label: "ภาพ", notes: "" }));
    expect(briefSchema.safeParse({ ...brief(), panels }).success).toBe(true);
    expect(briefSchema.safeParse({ ...brief(), panels: [] }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief(), panels: [...panels, { ...panels[0], key: "extra" }] }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief(), panels: [panels[0], panels[0]] }).success).toBe(false);
  });

  it.each(["", "Cover", "1_cover", "cover/panel", "ภาพปก", "a".repeat(41)])("rejects unsafe or ambiguous panel key %s", (key) => {
    expect(briefSchema.safeParse({ ...brief(), panels: [{ key, label: "ภาพ", notes: "" }] }).success).toBe(false);
  });

  it("requires a panel label and bounds its label and notes", () => {
    const panel = brief().panels[0];
    expect(briefSchema.safeParse({ ...brief(), panels: [{ ...panel, label: " " }] }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief(), panels: [{ ...panel, label: "a".repeat(201) }] }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief(), panels: [{ ...panel, notes: "a".repeat(2001) }] }).success).toBe(false);
  });
});

describe("visual command and ordered asset-set boundaries", () => {
  it("allows a partial draft with empty alt text without inventing a missing panel or translation", () => {
    const command = setCommand();
    expect(visualCommandSchema.parse(command)).toEqual(command);
    expect(visualCommandSchema.safeParse({ ...command, slots: [] }).success).toBe(false);
  });

  it("preserves explicit slot order and rejects duplicate panels or repeated physical assets", () => {
    const command = setCommand();
    const second = { panel_key: "details", asset_id: versionId, alt_text_th: "รายละเอียดทุน", alt_text_en: "Scholarship details" };
    const ordered = { ...command, slots: [second, command.slots[0]] };
    expect(visualCommandSchema.parse(ordered)).toEqual(ordered);
    expect(visualCommandSchema.safeParse({ ...command, slots: [command.slots[0], { ...second, panel_key: "cover" }] }).success).toBe(false);
    expect(visualCommandSchema.safeParse({ ...command, slots: [command.slots[0], { ...second, asset_id: assetId }] }).success).toBe(false);
  });

  it.each(["alt_text_th", "alt_text_en"])("bounds %s without trimming or translating saved draft text", (field) => {
    const command = setCommand();
    const input = { ...command, slots: [{ ...command.slots[0], [field]: "a".repeat(1000) }] };
    expect(visualCommandSchema.parse(input)).toEqual(input);
    expect(visualCommandSchema.safeParse({ ...command, slots: [{ ...command.slots[0], [field]: "a".repeat(1001) }] }).success).toBe(false);
  });

  it.each([0, -1, 1.5, 1000000000, undefined, "8"])("rejects a missing or unsafe optimistic revision %s", (expected_revision) => {
    expect(visualCommandSchema.safeParse({ ...briefCommand(), expected_revision }).success).toBe(false);
    expect(uploadInputSchema.safeParse({ ...upload(), expected_revision }).success).toBe(false);
  });

  it.each(["submit", "approve", "return"])("accepts explicit %s review intent for a brief or asset set", (decision) => {
    expect(visualCommandSchema.safeParse({ ...base, op: "review_brief", brief_id: briefId, decision, note: "ตรวจแล้ว" }).success).toBe(true);
    expect(visualCommandSchema.safeParse({ ...base, op: "review_set", asset_set_id: assetId, decision, note: "ตรวจแล้ว" }).success).toBe(true);
  });

  it("rejects actor, provider, storage, and publication controls outside the allowed command shapes", () => {
    expect(visualCommandSchema.safeParse({ ...briefCommand(), actor_id: assetId }).success).toBe(false);
    expect(uploadInputSchema.safeParse({ ...upload(), storage_path: "private/forged.png" }).success).toBe(false);
    expect(uploadInputSchema.safeParse({ ...upload(), actor_id: assetId }).success).toBe(false);
    expect(visualCommandSchema.safeParse({ ...briefCommand(), brief: { ...brief(), provider_token: "secret" } }).success).toBe(false);
    expect(visualCommandSchema.safeParse({ ...briefCommand(), op: "publish" }).success).toBe(false);
    expect(visualCommandSchema.safeParse({ ...base, op: "review_brief", brief_id: briefId, decision: "publish", note: "" }).success).toBe(false);
    expect(visualCommandSchema.safeParse({ ...setCommand(), slots: [{ ...setCommand().slots[0], storage_path: "private/forged.png" }] }).success).toBe(false);
  });

  it("requires persisted UUIDs and a request identity instead of accepting arbitrary references", () => {
    expect(visualCommandSchema.safeParse({ ...briefCommand(), content_version_id: "latest" }).success).toBe(false);
    expect(visualCommandSchema.safeParse({ ...briefCommand(), idempotency_key: "request" }).success).toBe(false);
    expect(uploadInputSchema.safeParse({ ...upload(), brief_id: "current" }).success).toBe(false);
  });
});

describe("manual image provenance validation", () => {
  it("keeps manual and Canva provenance distinct and allows a known predecessor asset", () => {
    expect(uploadInputSchema.parse(upload())).toEqual(upload());
    const input = { ...provenance(), source_kind: "canva_export", origin_url: "https://www.canva.com/design/example/view", parent_asset_id: assetId };
    expect(provenanceSchema.parse(input)).toEqual(input);
    expect(provenanceSchema.safeParse({ ...provenance(), source_kind: "ai_generated" }).success).toBe(false);
  });

  it.each(["owned", "licensed", "permission", "public_domain"])("requires evidence text even for %s rights", (rights_basis) => {
    expect(provenanceSchema.safeParse({ ...provenance(), rights_basis }).success).toBe(true);
    expect(provenanceSchema.safeParse({ ...provenance(), rights_basis, rights_note: " \n " }).success).toBe(false);
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,x", "file:///C:/private.png", "/relative", "https://user:secret@example.org/image", "https://user@example.org/image"])("rejects unsafe or credential-bearing provenance URL %s", (origin_url) => {
    expect(provenanceSchema.safeParse({ ...provenance(), origin_url }).success).toBe(false);
  });

  it("bounds provenance text and rejects fabricated nested ownership data", () => {
    expect(provenanceSchema.safeParse({ ...provenance(), rights_note: "a".repeat(4001) }).success).toBe(false);
    expect(provenanceSchema.safeParse({ ...provenance(), attribution: "a".repeat(2001) }).success).toBe(false);
    expect(provenanceSchema.safeParse({ ...provenance(), origin_url: `https://example.org/${"a".repeat(2000)}` }).success).toBe(false);
    expect(provenanceSchema.safeParse({ ...provenance(), parent_asset_id: "unverified" }).success).toBe(false);
    expect(provenanceSchema.safeParse({ ...provenance(), created_by: assetId }).success).toBe(false);
  });
});

describe("safe visual read models", () => {
  it("rejects internal diagnostics, paths, and unexpected fields rather than silently carrying them to the UI", () => {
    const input = detail();
    expect(visualDetailSchema.parse(input)).toEqual(input);
    expect(visualDetailSchema.safeParse({ ...input, storage_token: "private" }).success).toBe(false);
    expect(visualDetailSchema.safeParse({ ...input, work_item: { ...input.work_item, internal_note: "private" } }).success).toBe(false);
    const asset = { ...provenance(), id: assetId, brief_id: briefId, original_file_name: "cover.png", mime_type: "image/png", size_bytes: 200,
      width: 1080, height: 1080, sha256: "a".repeat(64), uploaded_sha256: "b".repeat(64), created_at: "2026-10-21T00:00:00Z" };
    expect(visualDetailSchema.safeParse({ ...input, assets: [asset] }).success).toBe(true);
    expect(visualDetailSchema.safeParse({ ...input, assets: [{ ...asset, storage_path: "private/object.png" }] }).success).toBe(false);
    expect(visualDetailSchema.safeParse({ ...input, assets: [{ ...asset, sha256: "unverified" }] }).success).toBe(false);
  });

  it("limits asset readbacks and validates mutation result revisions", () => {
    const asset = { ...provenance(), id: assetId, brief_id: briefId, original_file_name: "cover.png", mime_type: "image/png", size_bytes: 200,
      width: 1080, height: 1080, sha256: "a".repeat(64), uploaded_sha256: "b".repeat(64), created_at: "2026-10-21T00:00:00Z" };
    expect(visualDetailSchema.safeParse({ ...detail(), assets: Array.from({ length: 101 }, () => asset) }).success).toBe(false);
    expect(visualResultSchema.parse({ work_item_id: workItemId, row_version: 9, asset_id: assetId })).toEqual({ work_item_id: workItemId, row_version: 9, asset_id: assetId });
    expect(visualResultSchema.safeParse({ work_item_id: workItemId, row_version: 0 }).success).toBe(false);
    expect(visualResultSchema.safeParse({ work_item_id: workItemId, row_version: 9, sql: "private" }).success).toBe(false);
  });
});
