import { NextResponse } from "next/server";

import { previewLegacyTravelImport } from "@/features/legacy-import/legacy-travel-import";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function loadAllActivePeople(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const pageSize = 1_000;
  const people: Array<{
    id: string;
    person_type: "student" | "staff";
    source_identifier: string | null;
    first_name_th: string | null;
    last_name_th: string | null;
    full_name_th: string | null;
    organization_unit_id: string | null;
    program_or_position: string | null;
  }> = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("people")
      .select(
        "id, person_type, source_identifier, first_name_th, last_name_th, full_name_th, organization_unit_id, program_or_position",
      )
      .eq("active", true)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    people.push(...((data || []) as typeof people));
    if (!data || data.length < pageSize) break;
  }

  return people;
}

export async function POST(request: Request) {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) {
    return NextResponse.json(
      { error: "นำเข้าการเดินทางได้เฉพาะ System Admin" },
      { status: 403 },
    );
  }
  const form = await request.formData();
  const file = form.get("file");
  const intent = String(form.get("intent") || "preview");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "กรุณาเลือกไฟล์รายงาน .xlsx" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 });
  }

  const supabase = await createClient();
  let batchId: string | null = null;
  try {
    const [countries, people, movements] = await Promise.all([
      supabase
        .from("countries")
        .select("id, iso2, name_th, name_en")
        .eq("active", true),
      loadAllActivePeople(supabase),
      supabase
        .from("movement_cases")
        .select("legacy_id")
        .eq("category", "staff_official_travel")
        .not("legacy_id", "is", null),
    ]);
    const error = countries.error || movements.error;
    if (error) throw new Error(error.message);

    const preview = await previewLegacyTravelImport(
      file,
      countries.data || [],
      people,
      new Set(
        (movements.data || []).flatMap((item) =>
          item.legacy_id ? [item.legacy_id] : [],
        ),
      ),
    );
    if (intent !== "stage") return NextResponse.json(preview);
    if (preview.invalid > 0) {
      return NextResponse.json(
        { error: `ยังมี ${preview.invalid} โครงการที่ต้องแก้ก่อนสร้าง staging` },
        { status: 400 },
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        module: "travel",
        import_kind: "module_data",
        source_file_name: file.name,
        source_file_path: "legacy_staff_travel",
        status: "validating",
        total_rows: preview.total,
        valid_rows: preview.valid,
        warning_rows: preview.warning,
        invalid_rows: preview.invalid,
        duplicate_rows: 0,
        created_by: access.user_id,
      })
      .select("id")
      .single();
    if (batchError || !batch) {
      throw new Error(batchError?.message || "สร้าง travel staging ไม่สำเร็จ");
    }
    batchId = batch.id;

    const { error: rowsError } = await supabase.from("import_rows").insert(
      preview.rows.map((row) => ({
        batch_id: batch.id,
        row_number: row.rowNumber,
        status: row.status,
        source_key: row.sourceKey,
        change_action: row.changeAction,
        review_status: "approved",
        review_note:
          "ตรวจช่วงไป-กลับ จำนวนผู้เดินทาง ประเทศ และ Data Master แล้ว",
        reviewed_at: new Date().toISOString(),
        reviewed_by: access.user_id,
        source_data: row.sourceData,
        normalized_data: row.normalizedData,
        validation_messages: row.messages,
      })),
    );
    if (rowsError) throw new Error(rowsError.message);
    const { error: readyError } = await supabase
      .from("import_batches")
      .update({ status: "ready" })
      .eq("id", batch.id);
    if (readyError) throw new Error(readyError.message);
    return NextResponse.json({ batchId: batch.id, preview });
  } catch (error) {
    if (batchId) await supabase.from("import_batches").delete().eq("id", batchId);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ตรวจรายงานไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
