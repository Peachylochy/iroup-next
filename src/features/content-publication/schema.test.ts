import { describe, expect, it } from "vitest";
import { publicationCommandSchema, publicationDetailSchema, publicationPayloadSchema, verifyCommandSchema } from "./schema";
import { bundleId, command, detail, workId } from "./__tests__/fixtures";

describe("Publication boundary", () => {
  it("accepts a reference-only freeze and bounded frozen preview", () => {
    expect(publicationCommandSchema.parse(command)).toEqual(command);
    expect(publicationDetailSchema.parse(detail())).toEqual(detail());
    expect(verifyCommandSchema.parse({ work_item_id: workId, bundle_id: bundleId })).toEqual({ work_item_id: workId, bundle_id: bundleId });
  });
  it.each(["actor_id", "channel", "locales", "storage_path", "token", "target_id", "payload"])("rejects caller-controlled %s on freeze", (key) => {
    expect(publicationCommandSchema.safeParse({ ...command, [key]: "untrusted" }).success).toBe(false);
  });
  it.each([0, -1, 1.5, 1e10, "10", null])("rejects invalid expected revision %s", (revision) => {
    expect(publicationCommandSchema.safeParse({ ...command, expected_revision: revision }).success).toBe(false);
  });
  it("rejects sensitive fields at each projection boundary", () => {
    const original = detail();
    const payload = original.selected!.payload;
    for (const value of [
      { ...payload, internal_note: "private" },
      { ...payload, locales: { ...payload.locales, th: { ...payload.locales.th, source_note: "private" } } },
      { ...payload, images: [{ ...payload.images[0], storage_path: "private/path" }] },
      { ...payload, images: [{ ...payload.images[0], rights_note: "private" }] },
    ]) expect(publicationPayloadSchema.safeParse(value).success).toBe(false);
  });
  it("rejects changed order, duplicate images, too many images and unsupported schema", () => {
    const payload = detail().selected!.payload;
    expect(publicationPayloadSchema.safeParse({ ...payload, images: [{ ...payload.images[0], order: 2 }] }).success).toBe(false);
    expect(publicationPayloadSchema.safeParse({ ...payload, images: [payload.images[0], { ...payload.images[0], order: 2 }] }).success).toBe(false);
    expect(publicationPayloadSchema.safeParse({ ...payload, images: Array(7).fill(payload.images[0]) }).success).toBe(false);
    expect(publicationPayloadSchema.safeParse({ ...payload, schema_version: 2 }).success).toBe(false);
  });
  it("rejects cross-channel/cross-kind preview mismatches", () => {
    const value = detail();
    value.selected!.payload.channel = "facebook";
    expect(publicationDetailSchema.safeParse(value).success).toBe(false);
    value.selected!.payload.channel = "website";
    value.selected!.payload.kind = "scholarship";
    expect(publicationDetailSchema.safeParse(value).success).toBe(false);
  });
  it("preserves long approved historical copy without truncating it", () => {
    const value = detail();
    value.selected!.payload.locales.th.body = "ข้อมูลเดิม".repeat(4000);
    expect(publicationDetailSchema.parse(value).selected!.payload.locales.th.body).toBe(value.selected!.payload.locales.th.body);
  });
  it("bounds history, and rejects injected verification proof", () => {
    const value = detail();
    value.bundles = Array(101).fill(value.bundles[0]);
    expect(publicationDetailSchema.safeParse(value).success).toBe(false);
    expect(verifyCommandSchema.safeParse({ work_item_id: workId, bundle_id: bundleId, checked_assets: 6 }).success).toBe(false);
  });
});
