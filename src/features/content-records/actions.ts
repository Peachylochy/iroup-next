"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

import { contentModules, isContentModule } from "./config";

export type ContentFormState = { error?: string; success?: boolean; id?: string };

const value = (data: FormData, name: string) => {
  const item = data.get(name);
  return typeof item === "string" ? item.trim() : "";
};
const nullable = (data: FormData, name: string) => value(data, name) || null;

export async function saveContentRecord(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const moduleValue = value(formData, "content_module");
  if (!isContentModule(moduleValue)) return { error: "ไม่พบโมดูลที่ต้องการบันทึก" };
  const config = contentModules[moduleValue];
  const access = await getCurrentUserAccess();
  if (!access) return { error: "กรุณาเข้าสู่ระบบใหม่" };
  const id = value(formData, "record_id");
  const status = value(formData, "publication_status") || "draft";
  const publicVisible = status === "published" || formData.get("public_visible") === "on";
  const common = {
    title_th: value(formData, "title_th"),
    title_en: nullable(formData, "title_en"),
    publication_status: status,
    public_visible: publicVisible,
    pinned: formData.get("pinned") === "on",
    internal_note: nullable(formData, "internal_note"),
  };
  if (!common.title_th) return { error: "กรุณาระบุชื่อภาษาไทย" };

  let payload: Record<string, unknown>;
  if (moduleValue === "scholarship") {
    payload = {
      ...common,
      scholarship_type: nullable(formData, "scholarship_type"),
      funding_type: nullable(formData, "funding_type"),
      study_level: nullable(formData, "study_level"),
      audience: value(formData, "audience") || "student",
      partner_organization_id: nullable(formData, "partner_organization_id"),
      country_id: nullable(formData, "country_id"),
      publish_date: nullable(formData, "publish_date"),
      open_date: nullable(formData, "open_date"),
      close_date: nullable(formData, "close_date"),
      summary_th: nullable(formData, "summary_th"),
      content_th: nullable(formData, "content_th"),
      detail_url: nullable(formData, "detail_url"),
      apply_url: nullable(formData, "apply_url"),
    };
  } else if (moduleValue === "events") {
    const startsAt = nullable(formData, "starts_at");
    const endsAt = nullable(formData, "ends_at");
    if (!startsAt || !endsAt) return { error: "กรุณาระบุวันและเวลาเริ่ม-สิ้นสุด" };
    payload = {
      ...common,
      event_type: value(formData, "event_type") || "general",
      mode: value(formData, "mode") || "onsite",
      starts_at: startsAt,
      ends_at: endsAt,
      organizer_unit_id: nullable(formData, "organizer_unit_id"),
      partner_organization_id: nullable(formData, "partner_organization_id"),
      country_id: nullable(formData, "country_id"),
      location_th: nullable(formData, "location_th"),
      registration_url: nullable(formData, "registration_url"),
      detail_th: nullable(formData, "content_th"),
      participant_count: Number(value(formData, "participant_count")) || 0,
    };
  } else if (moduleValue === "news") {
    payload = {
      ...common,
      category: nullable(formData, "category"),
      summary_th: nullable(formData, "summary_th"),
      content_th: nullable(formData, "content_th"),
      published_at: nullable(formData, "published_at"),
    };
  } else {
    payload = {
      ...common,
      category: nullable(formData, "category"),
      resource_type: value(formData, "resource_type") || "article",
      summary_th: nullable(formData, "summary_th"),
      content_th: nullable(formData, "content_th"),
      external_url: nullable(formData, "external_url"),
      published_at: nullable(formData, "published_at"),
    };
  }

  const supabase = await createClient();
  const query = id
    ? supabase.from(config.table).update({ ...payload, updated_by: access.user_id }).eq("id", id).select("id").single()
    : supabase.from(config.table).insert({ ...payload, created_by: access.user_id }).select("id").single();
  const { data, error } = await query;
  if (error) return { error: `บันทึกข้อมูลไม่สำเร็จ: ${error.message}` };
  const savedId = (data as { id: string }).id;
  revalidatePath(config.route);
  revalidatePath(`${config.route}/${savedId}/edit`);
  revalidatePath("/");
  return { success: true, id: savedId };
}
