"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PartnerFormState = { error?: string; id?: string; updatedAt?: string; success?: boolean; message?: string };

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
  revalidatePath(`/mou/organizations/${saved.id}`);
  revalidatePath(`/mou/organizations/${saved.id}/edit`);
  return { success: true, id: saved.id, updatedAt: saved.updated_at };
}

export async function savePartnerContactAction(
  _previous: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  const contactId = value(formData, "contact_id");
  const organizationId = value(formData, "partner_organization_id");
  const fullName = value(formData, "full_name");
  const positionTitle = value(formData, "position_title");
  const department = value(formData, "department");
  const relationshipLevel = value(formData, "relationship_level") || "unrated";
  const email = value(formData, "email");
  const phone = value(formData, "phone");
  const internalNote = value(formData, "internal_note");

  if (!fullName) {
    return { error: "กรุณากรอกชื่อ-นามสกุลผู้ติดต่อ" };
  }
  if (!organizationId) {
    return { error: "กรุณาระบุองค์กรคู่สัญญา" };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return { error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  let targetContactId = contactId;

  if (contactId) {
    const { error: updateErr } = await supabase
      .from("partner_contacts")
      .update({
        full_name: fullName,
        position_title: positionTitle || null,
        department: department || null,
        relationship_level: relationshipLevel as "unrated" | "low" | "medium" | "high",
        internal_note: internalNote || null,
        updated_at: new Date().toISOString(),
        updated_by: userData.user.id,
      })
      .eq("id", contactId);

    if (updateErr) return { error: `ไม่สามารถอัปเดตข้อมูลผู้ติดต่อ: ${updateErr.message}` };
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("partner_contacts")
      .insert({
        partner_organization_id: organizationId,
        full_name: fullName,
        position_title: positionTitle || null,
        department: department || null,
        relationship_level: relationshipLevel as "unrated" | "low" | "medium" | "high",
        internal_note: internalNote || null,
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) return { error: `ไม่สามารถเพิ่มผู้ติดต่อ: ${insertErr?.message}` };
    targetContactId = inserted.id;
  }

  // Update/Insert Email Method if present
  if (email && targetContactId) {
    await supabase.from("partner_contact_methods").upsert(
      {
        partner_contact_id: targetContactId,
        method_type: "email",
        value: email,
        is_primary: true,
        created_by: userData.user.id,
      },
      { onConflict: "partner_contact_id, method_type, lower(value)" },
    );
  }

  // Update/Insert Phone Method if present
  if (phone && targetContactId) {
    await supabase.from("partner_contact_methods").upsert(
      {
        partner_contact_id: targetContactId,
        method_type: "phone",
        value: phone,
        is_primary: true,
        created_by: userData.user.id,
      },
      { onConflict: "partner_contact_id, method_type, lower(value)" },
    );
  }

  revalidatePath(`/mou/organizations/${organizationId}`);
  revalidatePath("/mou/contacts");
  return { success: true, message: "บันทึกข้อมูลผู้ติดต่อเรียบร้อยแล้ว" };
}

export async function deletePartnerContactAction(contactId: string, organizationId: string): Promise<PartnerFormState> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return { error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  const { error } = await supabase
    .from("partner_contacts")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userData.user.id,
    })
    .eq("id", contactId);

  if (error) return { error: `ลบผู้ติดต่อไม่สำเร็จ: ${error.message}` };

  revalidatePath(`/mou/organizations/${organizationId}`);
  revalidatePath("/mou/contacts");
  return { success: true, message: "ลบผู้ติดต่อเรียบร้อยแล้ว" };
}

export async function logPartnerInteractionAction(
  _previous: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  const contactId = value(formData, "partner_contact_id");
  const organizationId = value(formData, "partner_organization_id");
  const occurredOn = value(formData, "occurred_on") || new Date().toISOString().slice(0, 10);
  const interactionType = value(formData, "interaction_type") || "meeting";
  const context = value(formData, "context");
  const note = value(formData, "note");

  if (!contactId || !context) {
    return { error: "กรุณาระบุผู้ติดต่อและรายละเอียดบริบทการประสานงาน" };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return { error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  const { error } = await supabase.from("partner_contact_interactions").insert({
    partner_contact_id: contactId,
    occurred_on: occurredOn,
    interaction_type: interactionType,
    context: context,
    note: note || null,
    created_by: userData.user.id,
  });

  if (error) return { error: `ไม่สามารถบันทึกประวัติการประสานงาน: ${error.message}` };

  // Update last_contacted_on for the contact
  await supabase
    .from("partner_contacts")
    .update({ last_contacted_on: occurredOn })
    .eq("id", contactId);

  revalidatePath(`/mou/organizations/${organizationId}`);
  return { success: true, message: "บันทึกประวัติการประสานงานเรียบร้อยแล้ว" };
}
