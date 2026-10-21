import { z } from "zod";
import type { PublicationCommand, PublicationDetail, PublicationResult, PublicationVerifyResult, VerifyCommand } from "./types";

const uuid = z.string().uuid();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const positive = z.number().int().positive();
const channel = z.enum(["website", "facebook"]);
const kind = z.enum(["scholarship", "news"]);
export const publicationCommandSchema: z.ZodType<PublicationCommand> = z.object({
  op: z.literal("freeze_bundle"), work_item_id: uuid, expected_revision: positive.max(999999999),
  idempotency_key: uuid, asset_set_id: uuid,
}).strict();
export const verifyCommandSchema: z.ZodType<VerifyCommand> = z.object({ work_item_id: uuid, bundle_id: uuid }).strict();
export const publicationResultSchema: z.ZodType<PublicationResult> = z.object({
  work_item_id: uuid, row_version: positive, bundle_id: uuid, reused: z.boolean(),
}).strict();
export const publicationVerifyResultSchema: z.ZodType<PublicationVerifyResult> = z.object({
  bundle_id: uuid, digest, checked_at: z.iso.datetime(), checked_assets: positive.max(6),
}).strict();
const locale = z.object({ title: z.string(), summary: z.string(), body: z.string(), coverage: z.string() }).strict();
const image = z.object({
  asset_id: uuid, panel_key: z.string(), label: z.string(), order: positive.max(6),
  width: positive.max(4096), height: positive.max(4096), mime_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
  sha256: digest, alt_text_th: z.string(), alt_text_en: z.string(), attribution: z.string(),
}).strict();
export const publicationPayloadSchema = z.object({
  schema_version: z.literal(1), kind, channel, locales: z.object({ th: locale, en: locale }).strict(),
  images: z.array(image).min(1).max(6)
    .refine((images) => images.every((item, index) => item.order === index + 1), "ลำดับภาพไม่ตรงกับชุดที่บันทึก")
    .refine((images) => new Set(images.map((item) => item.asset_id)).size === images.length, "ภาพซ้ำในชุดที่บันทึก")
    .refine((images) => new Set(images.map((item) => item.panel_key)).size === images.length, "แผงภาพซ้ำในชุดที่บันทึก"),
}).strict();
const summary = z.object({
  id: uuid, version_number: positive, channel, content_version_id: uuid, content_version_number: positive,
  asset_set_id: uuid, asset_set_version_number: positive, based_on_id: uuid.nullable(), revision: positive, digest,
  state: z.enum(["current", "stale"]), issues: z.array(z.enum(["CONTENT_NOT_APPROVED", "BRIEF_NOT_APPROVED", "ASSET_SET_NOT_APPROVED", "ASSET_NOT_READY"])).max(4),
  created_at: z.string(),
}).strict();
const bundle = summary.extend({
  payload: publicationPayloadSchema, snapshot_id: uuid, snapshot_digest: digest,
  content_digest: digest, brief_id: uuid, brief_digest: digest, asset_set_digest: digest,
}).strict().refine((value) => value.channel === value.payload.channel, "ช่องทางไม่ตรงกับชุดที่บันทึก");
export const publicationDetailSchema: z.ZodType<PublicationDetail> = z.object({
  work_item: z.object({ id: uuid, row_version: positive, kind, record_id: uuid }).strict(),
  candidates: z.array(z.object({ asset_set_id: uuid, brief_id: uuid, content_version_id: uuid, channel,
    content_version_number: positive, brief_title: z.string(), asset_set_version_number: positive, image_count: positive.max(6),
  }).strict()).max(100),
  bundles: z.array(summary).max(100), selected: bundle.nullable(),
}).strict().refine((value) => !value.selected || value.selected.payload.kind === value.work_item.kind, "ประเภทเนื้อหาไม่ตรงกับรายการ");
