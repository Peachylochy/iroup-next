import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const commitSchema = z.object({
  confirmation: z.literal("IMPORT MASTER"),
});

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) {
    return NextResponse.json({ error: "เฉพาะ System Admin" }, { status: 403 });
  }

  const payload = commitSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "พิมพ์ IMPORT MASTER เพื่อยืนยันการนำเข้าข้อมูล" }, { status: 400 });
  }

  const { batchId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_master_import_batch", { target_batch_id: batchId });

  if (error) {
    const status = error.code === "42501" ? 403 : error.message.includes("NOT_FOUND") ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ result: data });
}
