import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  rowId: z.string().uuid().optional(),
  all: z.boolean().optional(),
  decision: z.enum(["approved", "skipped", "needs_fix"]),
  reviewNote: z.string().trim().max(1000).optional(),
}).refine((value) => value.rowId || value.all, "rowId or all is required");

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access?.modules.mobility?.import) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ตรวจ staging Mobility" }, { status: 403 });
  }
  const { batchId } = await params;
  const supabase = await createClient();
  const [batchResult, rowsResult] = await Promise.all([
    supabase.from("import_batches")
      .select("id, source_file_name, status, total_rows, valid_rows, warning_rows, invalid_rows, committed_at, created_at")
      .eq("id", batchId)
      .eq("module", "mobility")
      .eq("import_kind", "module_data")
      .single(),
    supabase.from("import_rows")
      .select("id, row_number, status, source_key, change_action, review_status, review_note, normalized_data, validation_messages, target_record_id")
      .eq("batch_id", batchId)
      .order("row_number"),
  ]);
  if (batchResult.error || !batchResult.data) {
    return NextResponse.json({ error: "ไม่พบ staging batch นี้" }, { status: 404 });
  }
  if (rowsResult.error) return NextResponse.json({ error: rowsResult.error.message }, { status: 400 });
  return NextResponse.json({ batch: batchResult.data, rows: rowsResult.data ?? [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access?.modules.mobility?.import) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ตรวจ staging Mobility" }, { status: 403 });
  }
  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลผลการตรวจไม่ถูกต้อง" }, { status: 400 });
  const { batchId } = await params;
  const payload = parsed.data;
  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase.from("import_batches")
    .select("status, committed_at")
    .eq("id", batchId)
    .eq("module", "mobility")
    .eq("import_kind", "module_data")
    .single();
  if (batchError || !batch) return NextResponse.json({ error: "ไม่พบ staging batch นี้" }, { status: 404 });
  if (batch.status !== "ready" || batch.committed_at) {
    return NextResponse.json({ error: "batch นี้ถูกนำเข้าแล้วหรือยังไม่พร้อมตรวจ" }, { status: 409 });
  }

  const update = {
    review_status: payload.decision,
    review_note: payload.reviewNote || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: access.user_id,
    ...(payload.decision === "skipped" ? { change_action: "skip" } : {}),
  };
  let query = supabase.from("import_rows").update(update).eq("batch_id", batchId);
  if (payload.all) {
    query = query.in("status", ["valid", "warning"]).neq("change_action", "skip");
  } else {
    query = query.eq("id", payload.rowId!);
  }
  const { data, error } = await query.select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
