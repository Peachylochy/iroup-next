"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ContactFormState = {
  error?: string;
  success?: boolean;
  id?: string;
  updatedAt?: string;
};

const value = (formData: FormData, name: string) => {
  const item = formData.get(name);
  return typeof item === "string" ? item.trim() : "";
};

const values = (formData: FormData, name: string) =>
  formData
    .getAll(name)
    .filter((item): item is string => typeof item === "string")
    .flatMap((item) => item.split(/[;\n]/))
    .map((item) => item.trim())
    .filter(Boolean);

function contactError(error: { message: string; details?: string | null }) {
  if (error.message.includes("PARTNER_CONTACT_VALIDATION_FAILED")) {
    return error.details || "กรุณากรอกชื่อผู้ติดต่อและองค์กร";
  }
  if (error.message.includes("PARTNER_CONTACT_CONFLICT")) {
    return "ข้อมูลนี้ถูกแก้ไขจากที่อื่นแล้ว กรุณารีเฟรชและตรวจสอบอีกครั้ง";
  }
  if (error.message.includes("PARTNER_CONTACT_FORBIDDEN")) {
    return "คุณไม่มีสิทธิ์จัดการข้อมูลผู้ติดต่อ";
  }
  return "บันทึกข้อมูลผู้ติดต่อไม่สำเร็จ กรุณาลองอีกครั้ง";
}

export async function savePartnerContact(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const supabase = await createClient();
  const methods = [
    ...values(formData, "email").map((item, index) => ({
      method_type: "email",
      value: item,
      label: "อีเมล",
      is_primary: index === 0,
    })),
    ...values(formData, "phone").map((item, index) => ({
      method_type: "phone",
      value: item,
      label: "โทรศัพท์",
      is_primary: index === 0,
    })),
    ...values(formData, "messaging").map((item, index) => ({
      method_type: "messaging",
      value: item,
      label: "ช่องทางแชต",
      is_primary: index === 0,
    })),
  ];

  const { data, error } = await supabase.rpc("partner_contact_save", {
    target_contact_id: value(formData, "contact_id") || null,
    expected_updated_at: value(formData, "updated_at") || null,
    payload: {
      partner_organization_id: value(formData, "partner_organization_id"),
      full_name: value(formData, "full_name"),
      position_title: value(formData, "position_title"),
      department: value(formData, "department"),
      expertise_areas: value(formData, "expertise_areas")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      relationship_level: value(formData, "relationship_level") || "unrated",
      preferred_language: value(formData, "preferred_language"),
      last_contacted_on: value(formData, "last_contacted_on"),
      internal_note: value(formData, "internal_note"),
      active: formData.get("active") === "on",
      methods,
    },
  });

  if (error) return { error: contactError(error) };
  const saved = data as { id: string; updated_at: string };
  revalidatePath("/mou/contacts");
  revalidatePath(`/mou/contacts/${saved.id}/edit`);
  return { success: true, id: saved.id, updatedAt: saved.updated_at };
}
