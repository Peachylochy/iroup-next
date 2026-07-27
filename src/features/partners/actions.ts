"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PartnerFormState = { error?: string; id?: string; updatedAt?: string; success?: boolean };

const value = (formData: FormData, name: string) => {
  const item = formData.get(name);
  return typeof item === "string" ? item.trim() : "";
};

function errorMessage(error: { message: string; details?: string | null }) {
  if (error.message.includes("PARTNER_ORGANIZATION_DUPLICATE")) return "พบองค์กรชื่อเดียวกันแล้ว กรุณาตรวจสอบและใช้รายการเดิม";
  if (error.message.includes("PARTNER_ORGANIZATION_VALIDATION_FAILED")) return error.details || "กรุณากรอกข้อมูลองค์กรให้ครบ";
  if (error.message.includes("PARTNER_ORGANIZATION_CONFLICT")) return "ข้อมูลนี้ถูกแก้ไขจากที่อื่นแล้ว กรุณารีเฟรชหน้า";
  if (error.message.includes("PARTNER_ORGANIZATION_FORBIDDEN")) return "คุณไม่มีสิทธิ์จัดการข้อมูลองค์กร";
  return "บันทึกข้อมูลองค์กรไม่สำเร็จ กรุณาลองอีกครั้ง";
}

export async function savePartnerOrganization(
  _previous: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  const id = value(formData, "partner_id") || null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("partner_organization_save", {
    target_partner_id: id,
    expected_updated_at: value(formData, "updated_at") || null,
    payload: {
      name_th: value(formData, "name_th"),
      name_en: value(formData, "name_en"),
      organization_type: value(formData, "organization_type"),
      country_id: value(formData, "country_id"),
      city: value(formData, "city"),
      website_url: value(formData, "website_url"),
      verification_status: value(formData, "verification_status"),
      source_note: value(formData, "source_note"),
    },
  });
  if (error) return { error: errorMessage(error) };
  const saved = data as { id: string; updated_at: string };
  revalidatePath("/mou");
  revalidatePath("/mou/organizations");
  revalidatePath(`/mou/organizations/${saved.id}/edit`);
  return { success: true, id: saved.id, updatedAt: saved.updated_at };
}
