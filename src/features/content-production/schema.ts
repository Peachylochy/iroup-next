import { z } from "zod";
import type { ContentCommand, ContentCommandResult, ContentDetail, ContentListResult } from "./types";

const uuid = z.string().uuid();
const text = (max: number) => z.string().max(max);
const required = (max: number) => text(max).refine((value) => value.trim().length > 0, "กรุณากรอกข้อมูลให้ครบ");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "วันที่ไม่ถูกต้อง");
const safeUrl = z.string().max(2000).refine((value) => {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, "กรุณาใช้ลิงก์ http หรือ https ที่ไม่มีรหัสผ่าน");
const optionalUrl = z.union([z.literal(""), safeUrl]);
const timezone = z.string().max(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; }
  catch { return false; }
}, "เขตเวลาไม่ถูกต้อง").nullable();

export const factsSchema = z.object({
  subject: required(500), key_points: text(10000), category: text(200),
  scholarship_type: text(200), audience: z.enum(["student", "staff", "both", "external"]),
  funding_type: text(200), study_level: text(200), eligibility: text(5000),
  detail_url: optionalUrl, apply_url: optionalUrl,
}).strict();
const localeSchema = z.object({ title: text(500), summary: text(4000), body: text(20000), coverage: text(10000) }).strict();
export const localesSchema = z.object({ th: localeSchema, en: localeSchema }).strict();
export const deadlineSchema = z.object({
  kind: z.enum(["university_internal", "thai_nominating_body", "scholarship_owner"]),
  applicability: z.enum(["specified", "not_applicable"]), reason: text(2000), cycle_key: required(100),
  raw_text: text(4000), precision: z.enum(["date_only", "local_datetime", "instant"]),
  date: date.nullable(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(),
  timezone, instant: z.iso.datetime({ offset: true }).nullable(), source_verification_id: uuid.nullable(),
}).strict().superRefine((value, ctx) => {
  const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
  if (value.applicability === "not_applicable") {
    if (!value.reason.trim() || value.date || value.time || value.timezone || value.instant || value.source_verification_id || value.raw_text) invalid("กรณีไม่เกี่ยวข้องต้องระบุเหตุผล และเว้นข้อมูลวันเวลา/แหล่งอ้างอิง");
    return;
  }
  if (!value.raw_text.trim()) invalid("กรุณาเก็บข้อความกำหนดเวลาจากต้นทาง");
  if (value.precision === "date_only" && (!value.date || value.time || value.timezone || value.instant)) invalid("ข้อมูลที่ระบุเพียงวันที่ต้องไม่เติมเวลาหรือเขตเวลา");
  if (value.precision === "local_datetime" && (!value.date || !value.time || value.instant)) invalid("กรุณาระบุวันที่และเวลาตามต้นทาง");
  if (value.precision === "instant" && (!value.instant || value.date || value.time)) invalid("กรุณาระบุเวลาพร้อม UTC offset ตามต้นทาง");
});
export const sourceSchema = z.object({
  title: required(500), publisher: required(500), requested_url: safeUrl, final_url: safeUrl,
  observed_on: date, valid_until: date, official: z.boolean(), result: z.enum(["verified", "unverified"]), note: text(4000),
}).strict().refine((value) => value.valid_until >= value.observed_on, "วันที่ควรตรวจใหม่ต้องไม่อยู่ก่อนวันที่ตรวจ");
const existing = { work_item_id: uuid, expected_revision: z.number().int().nonnegative().safe(), idempotency_key: uuid };
export const commandSchema: z.ZodType<ContentCommand> = z.discriminatedUnion("op", [
  z.object({ op: z.literal("open"), kind: z.enum(["scholarship", "news"]), record_id: uuid.nullable(), title_th: text(500), idempotency_key: uuid }).strict()
    .refine((value) => value.record_id !== null || value.title_th.trim().length > 0, "กรุณาระบุชื่อรายการ"),
  z.object({ ...existing, op: z.literal("record_source"), source: sourceSchema }).strict(),
  z.object({ ...existing, op: z.literal("save_draft"), channel: z.enum(["website", "facebook"]), facts: factsSchema,
    source_verification_ids: z.array(uuid).max(100), deadlines: z.array(deadlineSchema).max(3), locales: localesSchema }).strict()
    .refine((value) => value.locales.th.title.trim().length > 0, "กรุณาระบุชื่อภาษาไทย")
    .refine((value) => new Set(value.deadlines.map((item) => item.kind)).size === value.deadlines.length, "ชนิดกำหนดเวลาซ้ำกัน"),
  z.object({ ...existing, op: z.literal("review"), version_id: uuid, decision: z.enum(["submit", "approve", "return"]), note: text(4000) }).strict(),
]);
export const commandResultSchema: z.ZodType<ContentCommandResult> = z.object({
  work_item_id: uuid, record_id: uuid, row_version: z.number().int().positive(), version_id: uuid.optional(), source_verification_id: uuid.optional(),
}).strict();
const contentState = z.enum(["draft", "under_review", "approved", "returned", "stale"]);
const sourceReadSchema = z.object({
  id: uuid, created_by: uuid, created_at: z.string(), title: z.string(), publisher: z.string(),
  requested_url: z.string(), final_url: z.string(), observed_on: z.string(), valid_until: z.string(),
  official: z.boolean(), result: z.enum(["verified", "unverified"]), note: z.string(),
}).strict();
// Existing canonical text predates editorial limits. Read it without truncation;
// only an explicit authored save must satisfy the new command constraints.
const baselineFactsSchema = z.object({
  subject: z.string(), key_points: z.string(), category: z.string(), scholarship_type: z.string(),
  audience: z.enum(["student", "staff", "both", "external"]), funding_type: z.string(),
  study_level: z.string(), eligibility: z.string(), detail_url: z.string(), apply_url: z.string(),
}).strict();
const baselineLocaleSchema = z.object({ title: z.string(), summary: z.string(), body: z.string(), coverage: z.string() }).strict();
const readLocalesSchema = z.object({ th: baselineLocaleSchema, en: baselineLocaleSchema }).strict();
const readDeadlineSchema = z.object({
  kind: z.enum(["university_internal", "thai_nominating_body", "scholarship_owner"]),
  applicability: z.enum(["specified", "not_applicable"]), reason: z.string(), cycle_key: z.string(), raw_text: z.string(),
  precision: z.enum(["date_only", "local_datetime", "instant"]), date: z.string().nullable(), time: z.string().nullable(),
  timezone: z.string().nullable(), instant: z.string().nullable(), source_verification_id: uuid.nullable(),
}).strict();
export const detailSchema: z.ZodType<ContentDetail> = z.object({
  kind: z.enum(["scholarship", "news"]), record_id: uuid,
  baseline: z.object({ title_th: z.string(), publication_status: z.string(), public_visible: z.boolean(), facts: baselineFactsSchema,
    locales: readLocalesSchema }).strict(),
  work_item: z.object({ id: uuid, row_version: z.number().int().positive(), current_snapshot_id: uuid.nullable() }).strict().nullable(),
  snapshot: z.object({ id: uuid, facts: baselineFactsSchema, source_verification_ids: z.array(uuid).max(100), deadlines: z.array(readDeadlineSchema).max(3), digest: z.string(), created_at: z.string() }).strict().nullable(),
  sources: z.array(sourceReadSchema).max(100),
  versions: z.array(z.object({ id: uuid, channel: z.enum(["website", "facebook"]), version_number: z.number().int().positive(), snapshot_id: uuid,
    locales: readLocalesSchema, state: contentState, is_latest: z.boolean(), digest: z.string(), created_at: z.string() }).strict()).max(22),
  reviews: z.array(z.object({ id: uuid, version_id: uuid, decision: z.enum(["submitted", "approved", "returned"]), note: z.string(), created_by: uuid, created_at: z.string() }).strict()).max(50),
}).strict();
export const listSchema: z.ZodType<ContentListResult> = z.object({
  rows: z.array(z.object({ id: uuid, title_th: z.string(), updated_at: z.string(), publication_status: z.string(), work_item_id: uuid.nullable(),
    state: z.enum(["not_started", "draft", "under_review", "approved", "returned", "stale"]) }).strict()).max(20),
  total: z.number().int().nonnegative(), page: z.number().int().positive(), page_size: z.literal(20),
}).strict();
