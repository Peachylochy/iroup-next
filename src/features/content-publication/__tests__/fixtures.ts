import type { PublicationDetail } from "../types";

export const workId = "d8000000-0000-4000-8000-000000000001";
export const bundleId = "d8000000-0000-4000-8000-000000000002";
export const assetId = "d8000000-0000-4000-8000-000000000003";
export const setId = "d8000000-0000-4000-8000-000000000004";
export const versionId = "d8000000-0000-4000-8000-000000000005";
export const briefId = "d8000000-0000-4000-8000-000000000006";
export const snapshotId = "d8000000-0000-4000-8000-000000000007";
export const recordId = "d8000000-0000-4000-8000-000000000008";
export const requestId = "d8000000-0000-4000-8000-000000000009";
export const digest = "a".repeat(64);
export const command = { op: "freeze_bundle" as const, work_item_id: workId, expected_revision: 10, idempotency_key: requestId, asset_set_id: setId };
export const result = { work_item_id: workId, row_version: 11, bundle_id: bundleId, reused: false };
export function detail(): PublicationDetail {
  const summary = { id: bundleId, version_number: 1, channel: "website" as const, content_version_id: versionId,
    content_version_number: 1, asset_set_id: setId, asset_set_version_number: 1, based_on_id: null, revision: 11,
    digest, state: "current" as const, issues: [], created_at: "2026-10-21T09:00:00Z" };
  return { work_item: { id: workId, row_version: 11, kind: "news", record_id: recordId },
    candidates: [{ asset_set_id: setId, brief_id: briefId, content_version_id: versionId, channel: "website", content_version_number: 1,
      brief_title: "Verified synthetic brief", asset_set_version_number: 1, image_count: 1 }],
    bundles: [summary], selected: { ...summary, snapshot_id: snapshotId, snapshot_digest: digest, content_digest: digest,
      brief_id: briefId, brief_digest: digest, asset_set_digest: digest, payload: { schema_version: 1, kind: "news", channel: "website",
        locales: { th: { title: "หัวข้อ", summary: "สรุป", body: "เนื้อหา", coverage: "" }, en: { title: "Title", summary: "Summary", body: "Body", coverage: "" } },
        images: [{ asset_id: assetId, panel_key: "cover", label: "Cover", order: 1, width: 64, height: 64,
          mime_type: "image/png", sha256: digest, alt_text_th: "ภาพปก", alt_text_en: "Cover", attribution: "Synthetic QA" }] } } };
}
