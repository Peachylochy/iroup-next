"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveThaiFiscalYear } from "./fiscal-year";

export type MobilityFormState = { error?: string; success?: "draft" | "review"; id?: string; updatedAt?: string };

const text = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
};

function parseArray(data: FormData, name: string) {
  try { const parsed: unknown = JSON.parse(text(data, name)); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function mobilityError(error: { message: string; details?: string | null }) {
  if (error.message.includes("STUDENT_MOBILITY_VALIDATION_FAILED")) return error.details || "กรุณากรอกข้อมูล Mobility ให้ครบก่อนดำเนินการต่อ";
  if (error.message.includes("STUDENT_MOBILITY_CONFLICT")) return "ข้อมูลนี้ถูกแก้ไขจากที่อื่นแล้ว กรุณารีเฟรชหน้าและตรวจสอบอีกครั้ง";
  if (error.message.includes("STUDENT_MOBILITY_FORBIDDEN")) return "คุณไม่มีสิทธิ์ดำเนินการกับ Mobility นิสิตรายการนี้";
  if (error.message.includes("STUDENT_MOBILITY_INVALID_TRANSITION")) return "สถานะปัจจุบันไม่รองรับการดำเนินการนี้";
  return "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง";
}

export async function submitMobilityForm(_previous: MobilityFormState, formData: FormData): Promise<MobilityFormState> {
  const supabase = await createClient();
  const id = text(formData, "mobility_id") || null;
  const updatedAt = text(formData, "updated_at") || null;
  const startDate = text(formData, "start_date");
  const fiscalYear = text(formData, "fiscal_year") || deriveThaiFiscalYear(startDate);
  const payload = {
    project_name: text(formData, "project_name"), title_en: text(formData, "title_en"), purpose: text(formData, "purpose"),
    direction: text(formData, "direction"), country_id: text(formData, "country_id"), city: text(formData, "city"),
    partner_organization_id: text(formData, "partner_organization_id"), owner_unit_id: text(formData, "owner_unit_id"),
    activity_type: text(formData, "activity_type"), mobility_mode: text(formData, "mobility_mode"), participant_group: text(formData, "participant_group"), study_level: text(formData, "study_level"),
    approval_reference: text(formData, "approval_reference"), start_date: startDate, end_date: text(formData, "end_date"),
    departure_at: text(formData, "departure_at"), return_at: text(formData, "return_at"), fiscal_year: fiscalYear, internal_note: text(formData, "internal_note"),
  };
  const { data: savedData, error: saveError } = await supabase.rpc("student_mobility_save_draft", { target_movement_id: id, expected_updated_at: updatedAt, payload });
  if (saveError) return { error: mobilityError(saveError) };
  const saved = savedData as { id: string; updated_at: string };
  const participants = parseArray(formData, "participants_json");
  const funding = parseArray(formData, "funding_json");
  let currentUpdatedAt = saved.updated_at;
  const participantResult = await supabase.rpc("student_mobility_replace_participants", { target_movement_id: saved.id, expected_updated_at: currentUpdatedAt, participants });
  if (participantResult.error) return { error: mobilityError(participantResult.error) };
  currentUpdatedAt = (participantResult.data as { updated_at: string }).updated_at;
  const fundingResult = await supabase.rpc("student_mobility_replace_funding", { target_movement_id: saved.id, expected_updated_at: currentUpdatedAt, funding });
  if (fundingResult.error) return { error: mobilityError(fundingResult.error) };
  currentUpdatedAt = (fundingResult.data as { updated_at: string }).updated_at;
  if (text(formData, "intent") === "review") {
    const reviewResult = await supabase.rpc("student_mobility_submit_for_review", { target_movement_id: saved.id, expected_updated_at: currentUpdatedAt });
    if (reviewResult.error) return { error: mobilityError(reviewResult.error) };
    currentUpdatedAt = (reviewResult.data as { updated_at: string }).updated_at;
    revalidatePath("/mobility"); revalidatePath(`/mobility/${saved.id}`); return { success: "review", id: saved.id, updatedAt: currentUpdatedAt };
  }
  revalidatePath("/mobility"); revalidatePath(`/mobility/${saved.id}`); revalidatePath(`/mobility/${saved.id}/edit`);
  return { success: "draft", id: saved.id, updatedAt: currentUpdatedAt };
}

export type MobilityTransition = "return_to_draft" | "approve" | "activate" | "complete";

export async function transitionStudentMobility(
  id: string,
  expectedUpdatedAt: string,
  transition: MobilityTransition,
  returnNote = "",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const calls = {
    return_to_draft: () => supabase.rpc("student_mobility_return_to_draft", {
      target_movement_id: id,
      expected_updated_at: expectedUpdatedAt,
      return_note: returnNote,
    }),
    approve: () => supabase.rpc("student_mobility_approve", {
      target_movement_id: id,
      expected_updated_at: expectedUpdatedAt,
    }),
    activate: () => supabase.rpc("student_mobility_activate", {
      target_movement_id: id,
      expected_updated_at: expectedUpdatedAt,
    }),
    complete: () => supabase.rpc("student_mobility_complete", {
      target_movement_id: id,
      expected_updated_at: expectedUpdatedAt,
    }),
  };
  const { error } = await calls[transition]();
  if (error) return { error: mobilityError(error) };

  revalidatePath("/mobility");
  revalidatePath(`/mobility/${id}`);
  revalidatePath(`/mobility/${id}/edit`);
  return {};
}
