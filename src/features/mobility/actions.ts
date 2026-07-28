"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type MobilityFormState = {
  error?: string;
  id?: string;
  success?: boolean;
  message?: string;
};

const movementCaseSchema = z.object({
  id: z.string().optional(),
  category: z.enum(["student_exchange", "staff_exchange", "staff_official_travel"]).default("student_exchange"),
  direction: z.enum(["inbound", "outbound"]).default("outbound"),
  title_th: z.string().min(1, "กรุณากรอกชื่อโครงการ/การเดินทาง (ภาษาไทย)"),
  title_en: z.string().optional(),
  partner_organization_id: z.string().optional(),
  owner_unit_id: z.string().optional(),
  activity_type: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  participants_count: z.string().optional(),
  funding_amount: z.string().optional(),
  budget_type_id: z.string().optional(),
});

export async function saveMovementCaseAction(
  _previous: MobilityFormState,
  formData: FormData,
): Promise<MobilityFormState> {
  const rawData = Object.fromEntries(formData.entries());
  // Convert empty strings to undefined for optional fields to pass Zod validation
  const cleanedData = Object.fromEntries(
    Object.entries(rawData).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? undefined : v])
  );

  const parsed = movementCaseSchema.safeParse(cleanedData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง" };
  }

  const {
    id,
    category,
    direction,
    title_th: titleTh,
    title_en: titleEn,
    partner_organization_id: partnerOrganizationId,
    owner_unit_id: ownerUnitId,
    activity_type: activityType,
    start_date: startDate,
    end_date: endDate,
    participants_count: participantsCountStr,
    funding_amount: fundingAmountStr,
    budget_type_id: budgetTypeId,
  } = parsed.data;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return { error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  let movementId = id;

  if (id) {
    const { error: updateErr } = await supabase
      .from("movement_cases")
      .update({
        category: category as "student_exchange" | "staff_exchange" | "staff_official_travel",
        direction: direction as "inbound" | "outbound",
        title_th: titleTh,
        title_en: titleEn || null,
        partner_organization_id: partnerOrganizationId || null,
        owner_unit_id: ownerUnitId || null,
        activity_type: activityType || null,
        start_date: startDate || null,
        end_date: endDate || null,
        updated_at: new Date().toISOString(),
        updated_by: userData.user.id,
      })
      .eq("id", id);

    if (updateErr) {
      return { error: `ไม่สามารถบันทึกรายการได้: ${updateErr.message}` };
    }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("movement_cases")
      .insert({
        category: category as "student_exchange" | "staff_exchange" | "staff_official_travel",
        direction: direction as "inbound" | "outbound",
        title_th: titleTh,
        title_en: titleEn || null,
        partner_organization_id: partnerOrganizationId || null,
        owner_unit_id: ownerUnitId || null,
        activity_type: activityType || null,
        start_date: startDate || null,
        end_date: endDate || null,
        workflow_status: "approved",
        created_by: userData.user.id,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      return { error: `ไม่สามารถเพิ่มรายการได้: ${insertErr?.message}` };
    }
    movementId = inserted.id;
  }

  // Handle funding amount if provided
  const fundingAmount = parseFloat(fundingAmountStr || "");
  if (!isNaN(fundingAmount) && fundingAmount > 0 && movementId) {
    await supabase.from("movement_funding").insert({
      movement_id: movementId,
      amount: fundingAmount,
      currency: "THB",
      budget_type_id: budgetTypeId || "00000000-0000-0000-0000-000000000001",
      created_by: userData.user.id,
    });
  }

  // Handle participant sample count record if provided
  const participantCount = parseInt(participantsCountStr || "", 10);
  if (!isNaN(participantCount) && participantCount > 0 && movementId) {
    const participants = Array.from({ length: Math.min(participantCount, 5) }, (_, i) => ({
      movement_id: movementId,
      person_source: category === "student_exchange" ? "student" : "staff",
      full_name_snapshot: `ผู้เข้าร่วมรายการที่ ${i + 1}`,
      participant_role: category === "student_exchange" ? "นิสิตแลกเปลี่ยน" : "บุคลากรผู้เดินทาง",
      created_by: userData.user.id,
    }));
    await supabase.from("movement_participants").insert(participants);
  }

  revalidatePath("/mobility");
  revalidatePath("/");
  return { success: true, id: movementId, message: "บันทึกรายการ Mobility / การเดินทางเรียบร้อยแล้ว" };
}

export async function deleteMovementCaseAction(id: string): Promise<MobilityFormState> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return { error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" };
  }

  const { error } = await supabase
    .from("movement_cases")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userData.user.id,
    })
    .eq("id", id);

  if (error) {
    return { error: `ลบรายการไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/mobility");
  return { success: true, message: "ลบรายการเรียบร้อยแล้ว" };
}
