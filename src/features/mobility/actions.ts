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
  try { const parsed: unknown = JSON.parse(text(data, name)); return Array.isArray(parsed) ? parsed : null; } catch { return null; }
}

function mobilityError(error: { message: string; details?: string | null }) {
  if (error.message.includes("STUDENT_MOBILITY_VALIDATION_FAILED")) return error.details || "กรุณากรอกข้อมูล Mobility ให้ครบก่อนดำเนินการต่อ";
  if (error.message.includes("STUDENT_MOBILITY_CONFLICT")) return "ข้อมูลนี้ถูกแก้ไขจากที่อื่นแล้ว กรุณารีเฟรชหน้าและตรวจสอบอีกครั้ง";
  if (error.message.includes("STUDENT_MOBILITY_FORBIDDEN")) return "คุณไม่มีสิทธิ์ดำเนินการกับ Mobility นิสิตรายการนี้";
  if (error.message.includes("STUDENT_MOBILITY_INVALID_TRANSITION")) return "สถานะปัจจุบันไม่รองรับการดำเนินการนี้";
  return "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง";
}

export async function submitMobilityForm(_previous: MobilityFormState, formData: FormData): Promise<MobilityFormState> {
  const participants = parseArray(formData, "participants_json");
  const funding = parseArray(formData, "funding_json");
  if (participants === null || funding === null) {
    return { error: "รูปแบบข้อมูลผู้เดินทางหรืองบประมาณไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองอีกครั้ง" };
  }
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
  const submitForReview = text(formData, "intent") === "review";
  const { data: savedData, error: saveError } = await supabase.rpc("student_mobility_save", {
    target_movement_id: id,
    expected_updated_at: updatedAt,
    payload,
    participants,
    funding,
    submit_for_review: submitForReview,
  });
  if (saveError) return { error: mobilityError(saveError) };
  const saved = savedData as { id: string; updated_at: string };
  revalidatePath("/mobility"); revalidatePath(`/mobility/${saved.id}`); revalidatePath(`/mobility/${saved.id}/edit`);
  return { success: submitForReview ? "review" : "draft", id: saved.id, updatedAt: saved.updated_at };
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
