import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const commitSchema = z.object({ confirmation: z.literal("IMPORT MOBILITY") });

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access?.modules.mobility?.import) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์นำเข้าข้อมูล Mobility" }, { status: 403 });
  }
  const parsed = commitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "พิมพ์ IMPORT MOBILITY เพื่อยืนยัน" }, { status: 400 });
  }
  const { batchId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_student_mobility_import_batch", { target_batch_id: batchId });
  if (error) {
    const messages: Record<string, string> = {
      STUDENT_MOBILITY_IMPORT_REVIEW_INCOMPLETE: "กรุณาตรวจและอนุมัติหรือข้ามทุกรายการก่อนนำเข้า",
      STUDENT_MOBILITY_IMPORT_HAS_INVALID_ROWS: "ยังมีรายการที่ไม่ผ่านการตรวจ",
      STUDENT_MOBILITY_IMPORT_NOT_READY: "batch นี้นำเข้าแล้วหรือยังไม่พร้อม",
      STUDENT_MOBILITY_IMPORT_FORBIDDEN: "ไม่มีสิทธิ์นำเข้าข้อมูล Mobility",
    };
    const message = Object.entries(messages).find(([key]) => error.message.includes(key))?.[1] ?? error.message;
    return NextResponse.json({ error: message }, { status: error.code === "42501" ? 403 : 400 });
  }
  return NextResponse.json({ result: data });
}
