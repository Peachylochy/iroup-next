import { NextResponse } from "next/server";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { masterEntities, previewMasterImport, type MasterEntity, type MasterPreviewRow } from "@/features/master-import/master-import-preview";

export const runtime = "nodejs";
const chunk = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

async function getExisting() {
  const supabase = await createClient();
  const [countries, units, partners, people] = await Promise.all([
    supabase.from("countries").select("iso2"), supabase.from("organization_units").select("code"), supabase.from("partner_organizations").select("legacy_id"), supabase.from("people").select("person_type, source_identifier").not("source_identifier", "is", null),
  ]);
  if (countries.error || units.error || partners.error || people.error) throw new Error("อ่านข้อมูล master ปัจจุบันไม่สำเร็จ");
  return { countries: new Set(countries.data.map((row) => row.iso2)), units: new Set(units.data.flatMap((row) => row.code ? [row.code] : [])), partners: new Set(partners.data.flatMap((row) => row.legacy_id ? [row.legacy_id] : [])), students: new Set(people.data.filter((row) => row.person_type === "student").map((row) => row.source_identifier!)), staff: new Set(people.data.filter((row) => row.person_type === "staff").map((row) => row.source_identifier!)) };
}

export async function POST(request: Request) {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) return NextResponse.json({ error: "Master import ใช้ได้เฉพาะ System Admin" }, { status: 403 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "กรุณาเลือกไฟล์ .xlsx" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 15 MB" }, { status: 400 });
  let createdBatchId: string | null = null;
  try {
    const preview = await previewMasterImport(file, await getExisting());
    const intent = String(form.get("intent") || "preview");
    if (intent !== "stage") return NextResponse.json(preview);
    const selected = new Set(form.getAll("entities").filter((value): value is MasterEntity => masterEntities.includes(value as MasterEntity)));
    if (!selected.size) return NextResponse.json({ error: "เลือกอย่างน้อยหนึ่งชุดข้อมูล master" }, { status: 400 });
    const rows = preview.rows.filter((row) => selected.has(row.entity));
    const supabase = await createClient();
    const counts = { total_rows: rows.length, valid_rows: rows.filter((row) => row.status === "valid").length, warning_rows: rows.filter((row) => row.status === "warning").length, invalid_rows: rows.filter((row) => row.status === "invalid").length, duplicate_rows: 0 };
    const { data: batch, error: batchError } = await supabase.from("import_batches").insert({ module: "settings", import_kind: "master_data", source_file_name: file.name, status: "validating", created_by: access.user_id, ...counts }).select("id").single();
    if (batchError || !batch) throw new Error(batchError?.message || "สร้าง staging batch ไม่สำเร็จ");
    createdBatchId = batch.id;
    for (const group of chunk(rows, 500)) {
      const offset = rows.indexOf(group[0]);
      const { error } = await supabase.from("import_rows").insert(group.map((row: MasterPreviewRow, index) => ({ batch_id: batch.id, row_number: offset + index + 1, status: row.status, master_entity: row.entity, source_key: row.sourceKey, change_action: row.changeAction, source_data: row.sourceData, normalized_data: row.normalizedData, validation_messages: row.messages })));
      if (error) throw new Error(error.message);
    }
    const { error: updateError } = await supabase.from("import_batches").update({ status: "ready" }).eq("id", batch.id);
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ ...preview, batchId: batch.id, stagedRows: rows.length });
  } catch (error) {
    if (createdBatchId) {
      const supabase = await createClient();
      await supabase.from("import_batches").delete().eq("id", createdBatchId);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ" }, { status: 400 });
  }
}
