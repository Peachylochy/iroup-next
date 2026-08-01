import { NextResponse } from "next/server";
import { z } from "zod";

import { previewStudentMobilityImport } from "@/features/mobility/student-mobility-import-preview";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const mappingSchema = z.object({
  countryId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
  partnerUnknown: z.boolean().optional(),
  partnerFollowUp: z.string().trim().max(1000).optional(),
});

async function loadReferenceOptions() {
  const supabase = await createClient();
  const [countries, units, partners] = await Promise.all([
    supabase.from("countries").select("id, iso2, name_th, name_en").eq("active", true).order("name_th"),
    supabase.from("organization_units").select("id, code, name_th, name_en").eq("active", true).order("name_th"),
    supabase.from("partner_organizations").select("id, legacy_id, name_th, name_en").eq("active", true).order("name_en"),
  ]);
  if (countries.error || units.error || partners.error) throw new Error("อ่านข้อมูลอ้างอิงจากระบบไม่สำเร็จ");
  return { countries: countries.data, units: units.data, partners: partners.data };
}

export async function POST(request: Request) {
  const access = await getCurrentUserAccess();
  if (!access?.modules.mobility?.import) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์สร้าง staging ข้อมูล Mobility" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "กรุณาเลือกไฟล์ .xlsx" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 });
  }

  let mappingsPayload: unknown;
  try {
    mappingsPayload = JSON.parse(String(form.get("mappings") || "{}"));
  } catch {
    return NextResponse.json({ error: "ข้อมูล mapping ไม่ถูกต้อง" }, { status: 400 });
  }
  const mappingsResult = z.record(z.string(), mappingSchema).safeParse(mappingsPayload);
  if (!mappingsResult.success) {
    return NextResponse.json({ error: "ข้อมูล mapping ไม่ถูกต้อง" }, { status: 400 });
  }

  let createdBatchId: string | null = null;
  const supabase = await createClient();
  try {
    const preview = await previewStudentMobilityImport(file, await loadReferenceOptions());
    const mappings = mappingsResult.data;
    const normalizedRows = preview.rows.map((row) => {
      const mapping = mappings[row.legacyProjectId] ?? {};
      const normalized = {
        ...row.normalizedData,
        countryId: row.suggestedCountryId ?? mapping.countryId ?? row.normalizedData.countryId,
        ownerUnitId: row.suggestedUnitId ?? mapping.unitId ?? row.normalizedData.ownerUnitId,
        partnerOrganizationId: row.suggestedPartnerId ?? mapping.partnerId ?? row.normalizedData.partnerOrganizationId,
        internalImportNote: mapping.partnerUnknown
          ? mapping.partnerFollowUp || "ข้อมูลต้นทางยังไม่ระบุองค์กรคู่ความร่วมมือ"
          : null,
      };
      const messages = row.messages.filter((message) => {
        if (message.includes("จับคู่ประเทศ") && normalized.countryId) return false;
        if (message.includes("จับคู่หน่วยงาน") && normalized.ownerUnitId) return false;
        if (message.includes("องค์กรคู่ความร่วมมือ") && (normalized.partnerOrganizationId || mapping.partnerUnknown)) return false;
        return true;
      });
      const invalid = !normalized.projectName
        || !normalized.startDate
        || !normalized.participants.length
        || !normalized.ownerUnitId
        || ((normalized.direction === "inbound" || normalized.direction === "outbound") && !normalized.countryId);
      return {
        row,
        normalized,
        messages,
        status: invalid ? "invalid" as const : messages.length ? "warning" as const : "valid" as const,
      };
    });

    const invalidRows = normalizedRows.filter((row) => row.status === "invalid");
    if (invalidRows.length) {
      return NextResponse.json({
        error: `ยังมี ${invalidRows.length} รายการที่ต้องแก้ mapping ก่อนสร้าง staging`,
        invalidLegacyIds: invalidRows.slice(0, 10).map((row) => row.row.legacyProjectId),
      }, { status: 400 });
    }

    const legacyIds = normalizedRows.map(({ row }) => row.legacyProjectId);
    const { data: existing, error: existingError } = await supabase
      .from("movement_cases")
      .select("legacy_id")
      .eq("category", "student_mobility")
      .in("legacy_id", legacyIds);
    if (existingError) throw new Error(existingError.message);
    const existingIds = new Set((existing ?? []).map((item) => item.legacy_id));

    const counts = {
      total_rows: normalizedRows.length,
      valid_rows: normalizedRows.filter((row) => row.status === "valid").length,
      warning_rows: normalizedRows.filter((row) => row.status === "warning").length,
      invalid_rows: 0,
      duplicate_rows: 0,
    };
    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        module: "mobility",
        import_kind: "module_data",
        source_file_name: file.name,
        status: "validating",
        created_by: access.user_id,
        ...counts,
      })
      .select("id")
      .single();
    if (batchError || !batch) throw new Error(batchError?.message || "สร้าง staging batch ไม่สำเร็จ");
    createdBatchId = batch.id;

    const { error: rowsError } = await supabase.from("import_rows").insert(
      normalizedRows.map(({ row, normalized, messages, status }, index) => ({
        batch_id: batch.id,
        row_number: index + 1,
        status,
        source_key: row.legacyProjectId,
        change_action: existingIds.has(row.legacyProjectId) ? "update" : "insert",
        review_status: "pending",
        source_data: row.sourceData,
        normalized_data: normalized,
        validation_messages: messages,
      })),
    );
    if (rowsError) throw new Error(rowsError.message);

    const { error: readyError } = await supabase
      .from("import_batches")
      .update({ status: "ready" })
      .eq("id", batch.id);
    if (readyError) throw new Error(readyError.message);

    return NextResponse.json({ batchId: batch.id, stagedRows: normalizedRows.length });
  } catch (error) {
    if (createdBatchId) await supabase.from("import_batches").delete().eq("id", createdBatchId);
    console.error("Unable to stage student mobility import", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "สร้าง staging ไม่สำเร็จ" }, { status: 400 });
  }
}
