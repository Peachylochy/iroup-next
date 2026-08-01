import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ confirmation: z.literal("IMPORT LEGACY MOU") });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const access = await getCurrentUserAccess();
  if (!access?.roles.includes("system_admin")) {
    return NextResponse.json(
      { error: "นำเข้าข้อมูลระบบเดิมได้เฉพาะ System Admin" },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "พิมพ์ IMPORT LEGACY MOU เพื่อยืนยัน" },
      { status: 400 },
    );
  }

  const { batchId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_legacy_mou_import_batch", {
    target_batch_id: batchId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ result: data });
}
