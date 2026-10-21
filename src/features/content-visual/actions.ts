"use server";

import { revalidatePath } from "next/cache";
import { ContentProduction } from "@/features/content-production/content-production";
import { uploadInputSchema, visualCommandSchema } from "./schema";
import type { VisualActionState } from "./types";

const errors: Record<string, string> = {
  AUTH_REQUIRED: "กรุณาเข้าสู่ระบบใหม่", PROFILE_INACTIVE: "บัญชีนี้ยังไม่พร้อมใช้งาน", FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
  NOT_FOUND: "ไม่พบรายการที่ต้องการ", STALE_REVISION: "มีการแก้ไขจากอีกหน้าต่าง กรุณาเก็บข้อความที่ยังไม่ได้บันทึกแล้วโหลดข้อมูลล่าสุด",
  IDEMPOTENCY_CONFLICT: "คำขอนี้ถูกใช้กับข้อมูลอีกชุดแล้ว กรุณาโหลดข้อมูลล่าสุด", POLICY_VIOLATION: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง กรุณาตรวจข้อมูลที่กรอก",
  VERSION_NOT_APPROVED: "กรุณาเลือกฉบับเนื้อหาที่อนุมัติแล้วและยังเป็นปัจจุบัน", BRIEF_NOT_APPROVED: "บรีฟนี้ยังไม่อนุมัติหรือมีข้อมูลใหม่แล้ว กรุณาตรวจบรีฟฉบับปัจจุบัน",
  STALE_BRIEF: "บรีฟหรือข้อมูลต้นทางเปลี่ยนแล้ว กรุณาจัดทำบรีฟฉบับใหม่", STALE_VERSION: "มีฉบับใหม่แล้ว กรุณาโหลดข้อมูลล่าสุด",
  SOURCE_STALE: "ผลตรวจแหล่งข้อมูลเปลี่ยนหรือหมดอายุแล้ว กรุณาตรวจเนื้อหาใหม่", SOURCE_REQUIRED: "กรุณาตรวจแหล่งอ้างอิงของเนื้อหาก่อน",
  INVALID_TRANSITION: "สถานะเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด", ASSET_NOT_READY: "กรุณาเลือกภาพของบรีฟนี้ให้ครบทุกช่องและตรวจคำอธิบายสองภาษา",
  MISSING_LOCALE: "กรุณากรอกคำอธิบายภาพให้ครบทั้งภาษาไทยและภาษาอังกฤษ", RIGHTS_REQUIRED: "กรุณาระบุสิทธิ์การใช้ภาพและหลักฐานหรือที่มา",
  IMAGE_INVALID: "ไฟล์ไม่ใช่ภาพนิ่ง PNG, JPEG หรือ WebP ที่อ่านได้ กรุณาตรวจชนิดไฟล์และส่งออกภาพใหม่",
  IMAGE_SIZE: "ไฟล์ภาพก่อนและหลังปรับข้อมูลต้องไม่เกิน 8 MB", IMAGE_DIMENSIONS: "ขนาดภาพไม่ตรงกับบรีฟ กรุณาปรับภาพให้ตรงขนาดที่กำหนด",
  IMAGE_STORAGE_UNAVAILABLE: "ยังไม่พร้อมจัดเก็บภาพ กรุณาให้ผู้ดูแลตรวจการตั้งค่าฝั่งเซิร์ฟเวอร์",
  IMAGE_UPLOAD_PENDING: "การอัปโหลดอาจยังไม่ครบ กรุณาลองส่งไฟล์เดิมอีกครั้ง ระบบจะตรวจไฟล์ที่มีอยู่ก่อนบันทึก",
};
function failure(error: unknown): VisualActionState {
  const message = error instanceof Error ? error.message : "";
  const code = Object.keys(errors).find((key) => new RegExp(`\\b${key}\\b`).test(message));
  return { code: code ?? "VISUAL_FAILED", error: code ? errors[code] : "ทำรายการไม่สำเร็จ กรุณาลองใหม่ ข้อมูลที่กรอกยังอยู่ในหน้านี้" };
}
function decode(formData: FormData): unknown {
  const raw = formData.get("command");
  if (typeof raw !== "string" || raw.length > 120000) throw new Error("POLICY_VIOLATION");
  try { return JSON.parse(raw); } catch { throw new Error("POLICY_VIOLATION"); }
}
export async function executeVisualCommand(_previous: VisualActionState, formData: FormData): Promise<VisualActionState> {
  try {
    const command = visualCommandSchema.safeParse(decode(formData));
    if (!command.success) return { code: "POLICY_VIOLATION", error: command.error.issues[0]?.message ?? errors.POLICY_VIOLATION };
    const result = await ContentProduction.visual.execute(command.data);
    revalidatePath("/content-production", "layout");
    return { success: true, result };
  } catch (error) { return failure(error); }
}
export async function uploadVisualImage(_previous: VisualActionState, formData: FormData): Promise<VisualActionState> {
  try {
    const command = uploadInputSchema.safeParse(decode(formData));
    if (!command.success) return { code: "POLICY_VIOLATION", error: command.error.issues[0]?.message ?? errors.POLICY_VIOLATION };
    const file = formData.get("image");
    if (!(file instanceof File)) throw new Error("IMAGE_INVALID");
    const result = await ContentProduction.visual.uploadImage(command.data, file);
    revalidatePath("/content-production", "layout");
    return { success: true, result };
  } catch (error) { return failure(error); }
}
