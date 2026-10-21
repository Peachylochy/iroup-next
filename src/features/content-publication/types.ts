import type { ContentChannel, ContentKind, ContentLocales } from "@/features/content-production/types";

export type PublicationImage = {
  asset_id: string; panel_key: string; label: string; order: number;
  width: number; height: number; mime_type: "image/png" | "image/jpeg" | "image/webp";
  sha256: string; alt_text_th: string; alt_text_en: string; attribution: string;
};
export type PublicationPayload = {
  schema_version: 1; kind: ContentKind; channel: ContentChannel;
  locales: ContentLocales; images: PublicationImage[];
};
export type PublicationIssue = "CONTENT_NOT_APPROVED" | "BRIEF_NOT_APPROVED" | "ASSET_SET_NOT_APPROVED" | "ASSET_NOT_READY";
export type BundleSummary = {
  id: string; version_number: number; channel: ContentChannel;
  content_version_id: string; content_version_number: number;
  asset_set_id: string; asset_set_version_number: number; based_on_id: string | null;
  revision: number; digest: string; state: "current" | "stale";
  issues: PublicationIssue[]; created_at: string;
};
export type PublicationBundle = BundleSummary & {
  payload: PublicationPayload; snapshot_id: string; snapshot_digest: string;
  content_digest: string; brief_id: string; brief_digest: string; asset_set_digest: string;
};
export type PublicationDetail = {
  work_item: { id: string; row_version: number; kind: ContentKind; record_id: string };
  candidates: Array<{
    asset_set_id: string; brief_id: string; content_version_id: string; channel: ContentChannel;
    content_version_number: number; brief_title: string; asset_set_version_number: number; image_count: number;
  }>;
  bundles: BundleSummary[];
  selected: PublicationBundle | null;
};
export type PublicationCommand = {
  op: "freeze_bundle"; work_item_id: string; expected_revision: number;
  idempotency_key: string; asset_set_id: string;
};
export type PublicationResult = { work_item_id: string; row_version: number; bundle_id: string; reused: boolean };
export type VerifyCommand = { work_item_id: string; bundle_id: string };
export type PublicationVerifyResult = { bundle_id: string; digest: string; checked_at: string; checked_assets: number };
export type PublicationActionState = { success?: boolean; error?: string; code?: string; result?: PublicationResult };
export type PublicationVerifyState = { success?: boolean; error?: string; code?: string; result?: PublicationVerifyResult };
