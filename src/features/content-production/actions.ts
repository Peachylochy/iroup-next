"use server";

import { revalidatePath } from "next/cache";
import { commandSchema } from "./schema";
import { ContentProduction } from "./content-production";
import type { ContentActionState } from "./types";

const messages: Record<string, string> = {
  CONTENT_FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์ทำรายการ กรุณาตรวจสอบสิทธิ์หรือเข้าสู่ระบบใหม่",
  CONTENT_NOT_FOUND: "ไม่พบรายการที่ต้องการ",
  CONTENT_CONFLICT: "มีการแก้ไขรายการนี้จากอีกหน้าต่าง กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง",
  CONTENT_IDEMPOTENCY_CONFLICT: "คำขอนี้ถูกใช้กับข้อมูลอีกชุดแล้ว กรุณาโหลดข้อมูลล่าสุด",
  CONTENT_INVALID: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง กรุณาตรวจสอบข้อมูลที่กรอก",
  CONTENT_STALE: "ข้อมูลอ้างอิงหรือฉบับเนื้อหาเปลี่ยนแล้ว กรุณาบันทึกฉบับใหม่และส่งตรวจอีกครั้ง",
  CONTENT_SOURCE_REQUIRED: "ต้องเลือกแหล่งข้อมูลทางการที่ตรวจสอบแล้วและยังไม่ถึงกำหนดตรวจใหม่",
  CONTENT_LOCALE_REQUIRED: "กรุณาระบุชื่อและเนื้อหาทั้งภาษาไทยและภาษาอังกฤษก่อนส่งตรวจ",
  CONTENT_DEADLINE_REQUIRED: "กรุณาตรวจสอบกำหนดเวลาทุนทั้งสามระดับ หรือระบุเหตุผลว่าไม่เกี่ยวข้อง",
  CONTENT_TRANSITION_INVALID: "สถานะรายการเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนทำรายการ",
};
const databaseCodes: Record<string, keyof typeof messages> = {
  AUTH_REQUIRED: "CONTENT_FORBIDDEN", PROFILE_INACTIVE: "CONTENT_FORBIDDEN", FORBIDDEN: "CONTENT_FORBIDDEN",
  NOT_FOUND: "CONTENT_NOT_FOUND", POLICY_VIOLATION: "CONTENT_INVALID",
  IDEMPOTENCY_CONFLICT: "CONTENT_IDEMPOTENCY_CONFLICT", STALE_REVISION: "CONTENT_CONFLICT",
  SOURCE_REQUIRED: "CONTENT_SOURCE_REQUIRED", SOURCE_STALE: "CONTENT_STALE",
  STALE_VERSION: "CONTENT_STALE", STALE_SNAPSHOT: "CONTENT_STALE",
  MISSING_LOCALE: "CONTENT_LOCALE_REQUIRED", DEADLINE_AMBIGUOUS: "CONTENT_DEADLINE_REQUIRED",
  INVALID_TRANSITION: "CONTENT_TRANSITION_INVALID",
};

export async function executeContentCommand(_previous: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const raw = formData.get("command");
  if (typeof raw !== "string" || raw.length > 160000) return { error: messages.CONTENT_INVALID, code: "CONTENT_INVALID" };
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { return { error: messages.CONTENT_INVALID, code: "CONTENT_INVALID" }; }
  const command = commandSchema.safeParse(decoded);
  if (!command.success) return { error: command.error.issues[0]?.message || messages.CONTENT_INVALID, code: "CONTENT_INVALID" };
  try {
    const result = await ContentProduction.execute(command.data);
    revalidatePath("/content-production", "layout");
    revalidatePath("/news");
    revalidatePath("/scholarships");
    return { success: true, result };
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    const databaseCode = Object.keys(databaseCodes).find((key) => new RegExp(`\\b${key}\\b`).test(text));
    const code = databaseCode ? databaseCodes[databaseCode] : Object.keys(messages).find((key) => new RegExp(`\\b${key}\\b`).test(text));
    return { code: code || "CONTENT_FAILED", error: code ? messages[code] : "ทำรายการไม่สำเร็จ กรุณาลองใหม่ ข้อมูลที่กรอกยังอยู่ในหน้านี้" };
  }
}
