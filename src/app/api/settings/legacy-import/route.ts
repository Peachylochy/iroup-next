import { NextResponse } from "next/server";

import {
  createLegacyMouPreview,
  fetchLegacyMouData,
} from "@/features/legacy-import/legacy-public-import";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function loadPreview() {
  const supabase = await createClient();
  const [sourceRows, countries, units, partners, agreements] = await Promise.all([
    fetchLegacyMouData(),
    supabase
      .from("countries")
      .select("id, iso2, name_th, name_en, continent_code")
      .eq("active", true),
    supabase
      .from("organization_units")
      .select("id, code, name_th, name_en")
      .eq("active", true),
    supabase
      .from("partner_organizations")
      .select("id, name_th, name_en")
      .eq("active", true),
    supabase.from("agreements").select("legacy_id").not("legacy_id", "is", null),
  ]);
  const error = countries.error || units.error || partners.error || agreements.error;
  if (error) throw new Error(error.message);
  return createLegacyMouPreview(sourceRows, {
    countries: countries.data || [],
    units: units.data || [],
    partners: partners.data || [],
    existingLegacyIds: new Set(
      (agreements.data || []).flatMap((item) => (item.legacy_id ? [item.legacy_id] : [])),
    ),
  });
}

export async function GET() {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) {
    return NextResponse.json(
      { error: "นำเข้าข้อมูลระบบเดิมได้เฉพาะ System Admin" },
      { status: 403 },
    );
  }
  try {
    return NextResponse.json(await loadPreview());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อ่านข้อมูลระบบเดิมไม่สำเร็จ" },
      { status: 400 },
    );
  }
}

export async function POST() {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) {
    return NextResponse.json(
      { error: "นำเข้าข้อมูลระบบเดิมได้เฉพาะ System Admin" },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  let batchId: string | null = null;
  try {
    const preview = await loadPreview();
    if (preview.invalid > 0) {
      return NextResponse.json(
        { error: `ยังมี ${preview.invalid} รายการที่จับคู่กับ Data Master ไม่ได้` },
        { status: 400 },
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        module: "mou",
        import_kind: "module_data",
        source_file_name: "legacy-public-mou-api.json",
        source_file_path: "v2.public.mou.list",
        status: "validating",
        total_rows: preview.total,
        valid_rows: preview.valid,
        warning_rows: preview.rows.filter((row) => row.status === "warning").length,
        invalid_rows: preview.invalid,
        duplicate_rows: 0,
        created_by: access.user_id,
      })
      .select("id")
      .single();
    if (batchError || !batch) {
      throw new Error(batchError?.message || "สร้าง MOU staging batch ไม่สำเร็จ");
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
        review_note: "ตรวจจับคู่กับ Data Master อัตโนมัติจาก public API เดิม",
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
      { error: error instanceof Error ? error.message : "สร้าง staging ไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
