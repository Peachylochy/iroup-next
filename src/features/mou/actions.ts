"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type MouFormState = {
  error?: string;
  success?: "draft" | "review" | "published";
  id?: string;
  updatedAt?: string;
};

function mouErrorMessage(error: { message: string; details?: string | null }) {
  if (error.message.includes("MOU_VALIDATION_FAILED")) {
    return error.details || "กรุณากรอกข้อมูล MOU ให้ครบก่อนดำเนินการต่อ";
  }
  if (error.message.includes("MOU_CONFLICT")) {
    return "ข้อมูลนี้ถูกแก้ไขจากที่อื่นแล้ว กรุณารีเฟรชหน้าและตรวจสอบอีกครั้ง";
  }
  if (error.message.includes("MOU_FORBIDDEN")) {
    return "คุณไม่มีสิทธิ์ดำเนินการนี้กับข้อมูล MOU";
  }
  if (error.message.includes("MOU_INVALID_TRANSITION")) {
    return "สถานะปัจจุบันไม่รองรับการดำเนินการนี้";
  }
  return "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อผู้ดูแลระบบ";
}

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

type RelationItem = { id: string; isLead?: boolean; isOwner?: boolean };

function relationItems(formData: FormData, name: string): RelationItem[] {
  const raw = textValue(formData, name);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string" || !item.id || seen.has(item.id)) {
        return [];
      }
      seen.add(item.id);
      return [{
        id: item.id,
        isLead: "isLead" in item && item.isLead === true,
        isOwner: "isOwner" in item && item.isOwner === true,
      }];
    });
  } catch {
    return [];
  }
}

function payloadFromForm(formData: FormData) {
  const partners = relationItems(formData, "partners_json");
  const units = relationItems(formData, "units_json");

  return {
    title_th: textValue(formData, "title_th"),
    agreement_number: textValue(formData, "agreement_number"),
    title_en: textValue(formData, "title_en"),
    agreement_type: textValue(formData, "agreement_type"),
    signed_date: textValue(formData, "signed_date"),
    start_date: textValue(formData, "start_date"),
    end_date: textValue(formData, "end_date"),
    fiscal_year: textValue(formData, "fiscal_year"),
    internal_note: textValue(formData, "internal_note"),
    partners: partners.map(({ id, isLead }) => ({ id, is_lead: isLead })),
    units: units.map(({ id, isOwner }) => ({ id, is_owner: isOwner })),
  };
}

export async function submitMouForm(
  _previous: MouFormState,
  formData: FormData,
): Promise<MouFormState> {
  const intent = textValue(formData, "intent") || "draft";
  const agreementId = textValue(formData, "agreement_id") || null;
  const expectedUpdatedAt = textValue(formData, "updated_at") || null;
  const supabase = await createClient();

  if (intent === "publish") {
    if (!agreementId || !expectedUpdatedAt) {
      return { error: "ไม่พบข้อมูล MOU สำหรับเผยแพร่" };
    }

    const { data, error } = await supabase.rpc("mou_publish", {
      target_agreement_id: agreementId,
      expected_updated_at: expectedUpdatedAt,
    });

    if (error) return { error: mouErrorMessage(error) };
    const result = data as { id: string; updated_at: string };
    revalidatePath("/mou");
    revalidatePath(`/mou/${agreementId}/edit`);
    return { success: "published", id: result.id, updatedAt: result.updated_at };
  }

  const { data: savedData, error: saveError } = await supabase.rpc("mou_save_draft", {
    target_agreement_id: agreementId,
    expected_updated_at: expectedUpdatedAt,
    payload: payloadFromForm(formData),
  });

  if (saveError) return { error: mouErrorMessage(saveError) };
  const saved = savedData as { id: string; updated_at: string };

  if (intent === "review") {
    const { data: reviewData, error: reviewError } = await supabase.rpc(
      "mou_submit_for_review",
      { target_agreement_id: saved.id, expected_updated_at: saved.updated_at },
    );

    if (reviewError) return { error: mouErrorMessage(reviewError) };
    const reviewed = reviewData as { id: string; updated_at: string };
    revalidatePath("/mou");
    revalidatePath(`/mou/${saved.id}/edit`);
    return { success: "review", id: reviewed.id, updatedAt: reviewed.updated_at };
  }

  revalidatePath("/mou");
  revalidatePath(`/mou/${saved.id}/edit`);
  return { success: "draft", id: saved.id, updatedAt: saved.updated_at };
}
