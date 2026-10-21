import { z } from "zod";
import type { UploadReservation, VisualCommand, VisualDetail, VisualResult, VisualUploadInput } from "./types";

const uuid = z.string().uuid();
const bounded = (max: number) => z.string().max(max);
const required = (max: number) => bounded(max).refine((value) => value.trim().length > 0, "กรุณากรอกข้อมูลให้ครบ");
const optionalUrl = z.string().max(2000).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, "กรุณาใช้ลิงก์ http หรือ https ที่ไม่มีรหัสผ่าน");
const panel = z.object({ key: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), label: required(200), notes: bounded(2000) }).strict();
export const briefSchema = z.object({
  title: required(200), objective: required(2000), audience: required(2000), key_message: required(2000),
  design_notes: bounded(8000), brand_notes: bounded(8000), prompt: bounded(8000), negative_prompt: bounded(8000),
  width: z.number().int().min(64).max(4096), height: z.number().int().min(64).max(4096), panels: z.array(panel).min(1).max(6),
}).strict().refine((value) => value.width * value.height <= 16000000, "ขนาดภาพต้องไม่เกิน 16 ล้านพิกเซล")
  .refine((value) => new Set(value.panels.map((item) => item.key)).size === value.panels.length, "รหัสภาพแต่ละช่องต้องไม่ซ้ำกัน");
export const provenanceSchema = z.object({
  source_kind: z.enum(["manual_upload", "canva_export"]), rights_basis: z.enum(["owned", "licensed", "permission", "public_domain"]),
  rights_note: required(4000), attribution: bounded(2000), origin_url: optionalUrl, parent_asset_id: uuid.nullable(),
}).strict();
const slot = z.object({ panel_key: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), asset_id: uuid, alt_text_th: bounded(1000), alt_text_en: bounded(1000) }).strict();
const slots = z.array(slot).min(1).max(6)
  .refine((value) => new Set(value.map((item) => item.panel_key)).size === value.length, "ช่องภาพซ้ำกัน")
  .refine((value) => new Set(value.map((item) => item.asset_id)).size === value.length, "กรุณาเลือกภาพแต่ละไฟล์เพียงครั้งเดียว");
const base = { work_item_id: uuid, expected_revision: z.number().int().positive().max(999999999), idempotency_key: uuid };
const decision = z.enum(["submit", "approve", "return"]);
export const visualCommandSchema: z.ZodType<VisualCommand> = z.discriminatedUnion("op", [
  z.object({ ...base, op: z.literal("save_brief"), content_version_id: uuid, brief: briefSchema }).strict(),
  z.object({ ...base, op: z.literal("review_brief"), brief_id: uuid, decision, note: bounded(4000) }).strict(),
  z.object({ ...base, op: z.literal("save_set"), brief_id: uuid, slots }).strict(),
  z.object({ ...base, op: z.literal("review_set"), asset_set_id: uuid, decision, note: bounded(4000) }).strict(),
]);
export const uploadInputSchema: z.ZodType<VisualUploadInput> = z.object({ ...base, brief_id: uuid, provenance: provenanceSchema }).strict();
export const visualResultSchema: z.ZodType<VisualResult> = z.object({ work_item_id: uuid, row_version: z.number().int().positive(),
  brief_id: uuid.optional(), asset_id: uuid.optional(), asset_set_id: uuid.optional() }).strict();
export const reservationSchema: z.ZodType<UploadReservation> = z.object({ upload_id: uuid, storage_path: z.string(), row_version: z.number().int().positive(), asset_id: uuid.nullable() }).strict();
const state = z.enum(["draft", "under_review", "approved", "returned", "stale"]);
const readBrief = z.object({ title: z.string(), objective: z.string(), audience: z.string(), key_message: z.string(), design_notes: z.string(),
  brand_notes: z.string(), prompt: z.string(), negative_prompt: z.string(), width: z.number().int().positive(), height: z.number().int().positive(),
  panels: z.array(z.object({ key: z.string(), label: z.string(), notes: z.string() }).strict()).max(6) }).strict();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const visualDetailSchema: z.ZodType<VisualDetail> = z.object({
  work_item: z.object({ id: uuid, row_version: z.number().int().positive(), kind: z.enum(["scholarship", "news"]), record_id: uuid }).strict(),
  content_versions: z.array(z.object({ id: uuid, channel: z.enum(["website", "facebook"]), version_number: z.number().int().positive(), state, digest }).strict()).max(22),
  briefs: z.array(z.object({ id: uuid, content_version_id: uuid, version_number: z.number().int().positive(), based_on_id: uuid.nullable(),
    brief: readBrief, state, is_latest: z.boolean(), created_at: z.string() }).strict()).max(100),
  assets: z.array(z.object({ id: uuid, brief_id: uuid, original_file_name: z.string(), mime_type: z.string(), size_bytes: z.number().int().positive(),
    width: z.number().int().positive(), height: z.number().int().positive(), sha256: digest, uploaded_sha256: digest, created_at: z.string(),
    source_kind: z.enum(["manual_upload", "canva_export"]), rights_basis: z.enum(["owned", "licensed", "permission", "public_domain"]),
    rights_note: z.string(), attribution: z.string(), origin_url: z.string(), parent_asset_id: uuid.nullable() }).strict()).max(100),
  asset_sets: z.array(z.object({ id: uuid, brief_id: uuid, version_number: z.number().int().positive(), based_on_id: uuid.nullable(),
    slots: z.array(slot).max(6), state, is_latest: z.boolean(), created_at: z.string() }).strict()).max(100),
  reviews: z.array(z.object({ id: uuid, target_kind: z.enum(["brief", "asset_set"]), target_id: uuid,
    decision: z.enum(["submitted", "approved", "returned"]), note: z.string(), created_at: z.string() }).strict()).max(100),
}).strict();
