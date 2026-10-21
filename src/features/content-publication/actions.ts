"use server";

import { revalidatePath } from "next/cache";
import { ContentProduction } from "@/features/content-production/content-production";
import { publicationCommandSchema, verifyCommandSchema } from "./schema";
import type { PublicationActionState, PublicationVerifyState } from "./types";

const messages: Record<string, string> = {
  AUTH_REQUIRED: "กรุณาเข้าสู่ระบบใหม่", PROFILE_INACTIVE: "บัญชีนี้ยังไม่พร้อมใช้งาน", FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
  NOT_FOUND: "ไม่พบรายการหรือไฟล์ภาพที่ต้องการ", POLICY_VIOLATION: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง กรุณาตรวจรายการที่เลือก",
  STALE_REVISION: "มีการเปลี่ยนข้อมูลระหว่างทำรายการ กรุณาโหลดข้อมูลล่าสุดแล้วตรวจอีกครั้ง",
  IDEMPOTENCY_CONFLICT: "คำขอนี้ถูกใช้กับข้อมูลอีกชุดแล้ว กรุณาโหลดข้อมูลล่าสุด",
  CONTENT_NOT_APPROVED: "เนื้อหายังไม่อนุมัติหรือข้อมูลต้นทางเปลี่ยนแล้ว กรุณาตรวจเนื้อหาใหม่",
  BRIEF_NOT_APPROVED: "บรีฟภาพยังไม่อนุมัติหรือมีฉบับใหม่แล้ว กรุณาตรวจบรีฟปัจจุบัน",
  ASSET_SET_NOT_APPROVED: "ชุดภาพยังไม่อนุมัติหรือมีฉบับใหม่แล้ว กรุณาตรวจชุดภาพปัจจุบัน",
  ASSET_NOT_READY: "ไฟล์ภาพของชุดนี้ยังไม่ครบหรือไม่ตรงกับข้อมูลที่บันทึก กรุณาตรวจภาพอีกครั้ง",
  BUNDLE_STALE: "ข้อมูลที่ชุดนี้อ้างอิงเปลี่ยนแล้ว กรุณาตรวจและจัดเตรียมชุดใหม่",
  IMAGE_INVALID: "ไฟล์ภาพไม่ตรงกับชุดที่บันทึก กรุณาให้ผู้ดูแลตรวจไฟล์ก่อนดำเนินการต่อ",
  IMAGE_STORAGE_UNAVAILABLE: "ยังไม่พร้อมอ่านไฟล์ภาพ กรุณาให้ผู้ดูแลตรวจการตั้งค่าฝั่งเซิร์ฟเวอร์",
};
function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = Object.keys(messages).find((key) => new RegExp(`\\b${key}\\b`).test(message));
  return { code: code ?? "PUBLICATION_FAILED", error: code ? messages[code] : "ทำรายการไม่สำเร็จ กรุณาลองใหม่" };
}
function decode(formData: FormData): unknown {
  const raw = formData.get("command");
  if (typeof raw !== "string" || raw.length > 2000) throw new Error("POLICY_VIOLATION");
  try { return JSON.parse(raw); } catch { throw new Error("POLICY_VIOLATION"); }
}
export async function freezePublicationBundle(_previous: PublicationActionState, formData: FormData): Promise<PublicationActionState> {
  try {
    const parsed = publicationCommandSchema.safeParse(decode(formData));
    if (!parsed.success) throw new Error("POLICY_VIOLATION");
    const result = await ContentProduction.publication.execute(parsed.data);
    revalidatePath("/content-production", "layout");
    return { success: true, result };
  } catch (error) { return fail(error); }
}
export async function verifyPublicationBundle(_previous: PublicationVerifyState, formData: FormData): Promise<PublicationVerifyState> {
  try {
    const parsed = verifyCommandSchema.safeParse(decode(formData));
    if (!parsed.success) throw new Error("POLICY_VIOLATION");
    return { success: true, result: await ContentProduction.publication.verify(parsed.data) };
  } catch (error) { return fail(error); }
}
