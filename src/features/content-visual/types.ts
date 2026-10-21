import type { ContentChannel, ContentKind, ContentVersion } from "@/features/content-production/types";

export type VisualState = ContentVersion["state"];
export type VisualBriefInput = {
  title: string; objective: string; audience: string; key_message: string;
  design_notes: string; brand_notes: string; prompt: string; negative_prompt: string;
  width: number; height: number;
  panels: Array<{ key: string; label: string; notes: string }>;
};
export type ImageProvenance = {
  source_kind: "manual_upload" | "canva_export";
  rights_basis: "owned" | "licensed" | "permission" | "public_domain";
  rights_note: string; attribution: string; origin_url: string;
  parent_asset_id: string | null;
};
export type VisualAsset = ImageProvenance & {
  id: string; brief_id: string; original_file_name: string; mime_type: string;
  size_bytes: number; width: number; height: number; sha256: string;
  uploaded_sha256: string; created_at: string;
};
export type VisualSlot = { panel_key: string; asset_id: string; alt_text_th: string; alt_text_en: string };
export type VisualBrief = {
  id: string; content_version_id: string; version_number: number; based_on_id: string | null;
  brief: VisualBriefInput; state: VisualState; is_latest: boolean; created_at: string;
};
export type VisualAssetSet = {
  id: string; brief_id: string; version_number: number; based_on_id: string | null;
  slots: VisualSlot[]; state: VisualState; is_latest: boolean; created_at: string;
};
export type VisualDetail = {
  work_item: { id: string; row_version: number; kind: ContentKind; record_id: string };
  content_versions: Array<{ id: string; channel: ContentChannel; version_number: number; state: VisualState; digest: string }>;
  briefs: VisualBrief[]; assets: VisualAsset[]; asset_sets: VisualAssetSet[];
  reviews: Array<{ id: string; target_kind: "brief" | "asset_set"; target_id: string;
    decision: "submitted" | "approved" | "returned"; note: string; created_at: string }>;
};
type Existing = { work_item_id: string; expected_revision: number; idempotency_key: string };
export type VisualCommand =
  | (Existing & { op: "save_brief"; content_version_id: string; brief: VisualBriefInput })
  | (Existing & { op: "review_brief"; brief_id: string; decision: "submit" | "approve" | "return"; note: string })
  | (Existing & { op: "save_set"; brief_id: string; slots: VisualSlot[] })
  | (Existing & { op: "review_set"; asset_set_id: string; decision: "submit" | "approve" | "return"; note: string });
export type VisualUploadInput = Existing & { brief_id: string; provenance: ImageProvenance };
export type VisualResult = { work_item_id: string; row_version: number; brief_id?: string; asset_id?: string; asset_set_id?: string };
export type VisualActionState = { success?: boolean; result?: VisualResult; code?: string; error?: string };
export type VerifiedImage = { original_file_name: string; mime_type: string; size_bytes: number;
  width: number; height: number; sha256: string; uploaded_sha256: string; transform: "visual-raster-v1" };
export type UploadReservation = { upload_id: string; storage_path: string; row_version: number; asset_id: string | null };
