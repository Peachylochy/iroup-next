import { NextResponse } from "next/server";

import { previewLegacyContactImport } from "@/features/legacy-import/legacy-contact-import";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) {
    return NextResponse.json(
      { error: "นำเข้าผู้ติดต่อได้เฉพาะ System Admin" },
      { status: 403 },
    );
  }
  const form = await request.formData();
  const file = form.get("file");
  const intent = String(form.get("intent") || "preview");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "กรุณาเลือกไฟล์ .xlsx" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 });
  }

  const supabase = await createClient();
  let batchId: string | null = null;
  try {
    const [partners, contacts] = await Promise.all([
      supabase
        .from("partner_organizations")
        .select("id, name_th, name_en")
        .eq("active", true),
      supabase
        .from("partner_contacts")
        .select("partner_organization_id, full_name")
        .is("deleted_at", null),
    ]);
    if (partners.error || contacts.error) {
      throw new Error(partners.error?.message || contacts.error?.message);
    }
    const preview = await previewLegacyContactImport(
      file,
      partners.data || [],
      contacts.data || [],
    );
    if (intent !== "stage") return NextResponse.json(preview);
    if (preview.invalid > 0) {
      return NextResponse.json(
        { error: `ยังมี ${preview.invalid} รายการที่ต้องแก้ก่อนสร้าง staging` },
        { status: 400 },
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        module: "mou",
        import_kind: "module_data",
        source_file_name: file.name,
        source_file_path: "legacy_partner_contacts",
        status: "validating",
        total_rows: preview.total,
        valid_rows: preview.valid,
        warning_rows: preview.warning,
        invalid_rows: preview.invalid,
        duplicate_rows: preview.duplicateRows,
        created_by: access.user_id,
      })
      .select("id")
      .single();
    if (batchError || !batch) {
      throw new Error(batchError?.message || "สร้าง contact staging ไม่สำเร็จ");
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
        review_note: "ตรวจจับคู่องค์กรกับ Data Master แล้ว",
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
      { error: error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
