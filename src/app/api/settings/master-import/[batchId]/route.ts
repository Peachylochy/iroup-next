import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  rowId: z.string().uuid(),
  decision: z.enum(["approved", "skipped", "needs_fix"]),
  reviewNote: z.string().trim().max(1000).optional(),
  nameTh: z.string().trim().max(500).optional(),
  nameEn: z.string().trim().max(500).optional(),
});

function canSaveName(entity: string | null, nameTh?: string, nameEn?: string) {
  if (entity === "organization_unit") return Boolean(nameTh);
  return Boolean(nameTh || nameEn);
}

export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) return NextResponse.json({ error: "เฉพาะ System Admin" }, { status: 403 });
  const { batchId } = await params;
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "issues";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = 30;
  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase.from("import_batches")
    .select("id, source_file_name, status, total_rows, valid_rows, warning_rows, invalid_rows, duplicate_rows, committed_at, created_at")
    .eq("id", batchId).eq("import_kind", "master_data").single();
  if (batchError || !batch) return NextResponse.json({ error: "ไม่พบ staging batch นี้" }, { status: 404 });

  let rowsQuery = supabase.from("import_rows").select("id, row_number, status, master_entity, source_key, change_action, review_status, review_note, source_data, normalized_data, validation_messages", { count: "exact" }).eq("batch_id", batchId).order("row_number");
  // Existing keys are normal upserts for a master-data import. Only invalid
  // rows need an officer's action before the batch is ready to commit.
  if (filter === "issues") rowsQuery = rowsQuery.eq("status", "invalid").in("review_status", ["pending", "needs_fix"]);
  if (filter === "warning") rowsQuery = rowsQuery.eq("status", "warning");
  if (filter === "invalid") rowsQuery = rowsQuery.eq("status", "invalid").in("review_status", ["pending", "needs_fix"]);
  if (filter === "approved") rowsQuery = rowsQuery.eq("review_status", "approved");
  if (filter === "skipped") rowsQuery = rowsQuery.eq("review_status", "skipped");
  const { data: rows, error: rowsError, count } = await rowsQuery.range((page - 1) * pageSize, page * pageSize - 1);
  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 400 });
  return NextResponse.json({ batch, rows: rows || [], total: count || 0, page, pageSize, filter });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) return NextResponse.json({ error: "เฉพาะ System Admin" }, { status: 403 });
  const { batchId } = await params;
  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "รูปแบบข้อมูลตรวจทานไม่ถูกต้อง" }, { status: 400 });
  const payload = parsed.data;
  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase.from("import_batches")
    .select("status, committed_at")
    .eq("id", batchId).eq("import_kind", "master_data").single();
  if (batchError || !batch) return NextResponse.json({ error: "ไม่พบ staging batch นี้" }, { status: 404 });
  if (batch.status !== "ready" || batch.committed_at) return NextResponse.json({ error: "batch นี้ถูกนำเข้าแล้วหรือยังไม่พร้อมแก้ไข" }, { status: 409 });
  const { data: row, error: readError } = await supabase.from("import_rows")
    .select("id, status, master_entity, normalized_data, change_action")
    .eq("id", payload.rowId).eq("batch_id", batchId).single();
  if (readError || !row) return NextResponse.json({ error: "ไม่พบแถวที่ต้องการตรวจทาน" }, { status: 404 });

  const normalized = { ...((row.normalized_data || {}) as Record<string, unknown>) };
  if (row.master_entity === "country") { normalized.name_th = payload.nameTh || normalized.name_th || ""; normalized.name_en = payload.nameEn || normalized.name_en || ""; }
  if (row.master_entity === "organization_unit") { normalized.name_th = payload.nameTh || normalized.name_th || ""; normalized.name_en = payload.nameEn || normalized.name_en || null; }
  if (row.master_entity === "partner_organization") { normalized.name_th = payload.nameTh || normalized.name_th || null; normalized.name_en = payload.nameEn || normalized.name_en || ""; }
  if (row.master_entity === "student" || row.master_entity === "staff") { normalized.full_name_th = payload.nameTh || normalized.full_name_th || ""; normalized.full_name_en = payload.nameEn || normalized.full_name_en || null; }
  const corrected = canSaveName(row.master_entity, String(normalized.name_th || normalized.full_name_th || ""), String(normalized.name_en || normalized.full_name_en || ""));
  if (payload.decision === "approved" && row.status === "invalid" && !corrected) return NextResponse.json({ error: "กรอกชื่อที่ใช้ในระบบก่อนอนุมัติรายการที่ไม่ผ่าน" }, { status: 400 });

  const update: Record<string, unknown> = { review_status: payload.decision, review_note: payload.reviewNote || null, reviewed_at: new Date().toISOString(), reviewed_by: access.user_id };
  if (payload.decision === "skipped") update.change_action = "skip";
  if (payload.decision === "approved" && row.status === "invalid") { update.status = "valid"; update.change_action = "insert"; update.validation_messages = []; update.normalized_data = normalized; }
  if (payload.decision === "approved" && row.status !== "invalid") update.normalized_data = normalized;
  const { data, error } = await supabase.from("import_rows").update(update).eq("id", row.id).select("id, status, review_status, change_action").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (update.status) {
    // Supabase data reads are page-limited. Use exact count headers so a large
    // batch does not silently make its summary look like the first 1,000 rows.
    const statuses = ["valid", "warning", "invalid", "duplicate"] as const;
    const counted = await Promise.all(statuses.map(async (status) => {
      const { count, error: countError } = await supabase.from("import_rows").select("id", { count: "exact", head: true }).eq("batch_id", batchId).eq("status", status);
      return { status, count: count || 0, error: countError };
    }));
    const countError = counted.find((item) => item.error)?.error;
    if (countError) return NextResponse.json({ error: countError.message }, { status: 400 });
    const counts = Object.fromEntries(counted.map((item) => [item.status, item.count]));
    const { error: batchError } = await supabase.from("import_batches").update({
      valid_rows: counts.valid || 0,
      warning_rows: counts.warning || 0,
      invalid_rows: counts.invalid || 0,
      duplicate_rows: counts.duplicate || 0,
    }).eq("id", batchId);
    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 400 });
  }
  return NextResponse.json({ row: data, message: "บันทึกผลการตรวจทานใน staging แล้ว — master data ยังไม่เปลี่ยน" });
}
