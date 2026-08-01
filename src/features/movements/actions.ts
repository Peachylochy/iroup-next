"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveThaiFiscalYear } from "@/features/mobility/fiscal-year";
import {
  staffMovementModules,
  type StaffMovementModule,
} from "./config";

export type StaffMovementFormState = {
  error?: string;
  success?: boolean;
  id?: string;
};

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

function parseArray(formData: FormData, name: string) {
  try {
    const parsed: unknown = JSON.parse(text(formData, name));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function message(error: { message: string; details?: string | null }) {
  if (error.message.includes("VALIDATION_FAILED")) {
    return error.details || "กรุณาตรวจสอบข้อมูลที่จำเป็นให้ครบถ้วน";
  }
  if (error.message.includes("CONFLICT")) {
    return "ข้อมูลถูกแก้ไขจากที่อื่นแล้ว กรุณารีเฟรชและตรวจสอบอีกครั้ง";
  }
  if (error.message.includes("FORBIDDEN")) {
    return "บัญชีนี้ไม่มีสิทธิ์ดำเนินการกับรายการนี้";
  }
  if (error.message.includes("INVALID_TRANSITION")) {
    return error.details || "สถานะปัจจุบันไม่รองรับการดำเนินการนี้";
  }
  return "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง";
}

export async function saveStaffMovement(
  _previous: StaffMovementFormState,
  formData: FormData,
): Promise<StaffMovementFormState> {
  const movementModule = text(formData, "movement_module") as StaffMovementModule;
  const config = staffMovementModules[movementModule];
  if (!config) return { error: "ไม่พบโมดูลการเดินทาง" };

  const startDate = text(formData, "start_date");
  const payload = {
    project_name: text(formData, "project_name"),
    title_en: text(formData, "title_en"),
    purpose: text(formData, "purpose"),
    direction: text(formData, "direction"),
    country_id: text(formData, "country_id"),
    city: text(formData, "city"),
    partner_organization_id: text(formData, "partner_organization_id"),
    owner_unit_id: text(formData, "owner_unit_id"),
    activity_type: text(formData, "activity_type"),
    mobility_mode: text(formData, "mobility_mode"),
    approval_reference: text(formData, "approval_reference"),
    start_date: startDate,
    end_date: text(formData, "end_date"),
    departure_at: text(formData, "departure_at"),
    return_at: text(formData, "return_at"),
    fiscal_year:
      text(formData, "fiscal_year") || deriveThaiFiscalYear(startDate),
    internal_note: text(formData, "internal_note"),
  };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_movement_save", {
    target_movement_id: text(formData, "movement_id") || null,
    expected_updated_at: text(formData, "updated_at") || null,
    requested_category: config.category,
    payload,
    participants: parseArray(formData, "participants_json"),
    funding: parseArray(formData, "funding_json"),
    submit_for_review: text(formData, "intent") === "review",
  });
  if (error) return { error: message(error) };

  const saved = data as { id: string };
  revalidatePath(config.route);
  revalidatePath(`${config.route}/${saved.id}`);
  revalidatePath(`${config.route}/${saved.id}/edit`);
  return { success: true, id: saved.id };
}

export async function transitionStaffMovement(
  module: StaffMovementModule,
  id: string,
  expectedUpdatedAt: string,
  action: "return_to_draft" | "approve" | "activate" | "complete",
  note = "",
) {
  const config = staffMovementModules[module];
  if (!config) return { error: "ไม่พบโมดูลการเดินทาง" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_movement_transition", {
    target_movement_id: id,
    expected_updated_at: expectedUpdatedAt,
    requested_action: action,
    transition_note: note,
  });
  if (error) return { error: message(error) };
  revalidatePath(config.route);
  revalidatePath(`${config.route}/${id}`);
  return {};
}
