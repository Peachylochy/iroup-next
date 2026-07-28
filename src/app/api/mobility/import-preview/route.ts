import { NextResponse } from "next/server";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { previewStudentMobilityImport } from "@/features/mobility/student-mobility-import-preview";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getCurrentUserAccess();
  if (!access?.modules.mobility?.import) return NextResponse.json({ error: "คุณไม่มีสิทธิ์นำเข้าข้อมูล Mobility" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "กรุณาเลือกไฟล์ .xlsx" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 });
  const supabase = await createClient();
  const [countries, units, partners] = await Promise.all([
    supabase.from("countries").select("iso2, name_th, name_en").eq("active", true),
    supabase.from("organization_units").select("code, name_th, name_en").eq("active", true),
    supabase.from("partner_organizations").select("legacy_id, name_th, name_en").eq("active", true),
  ]);
  if (countries.error || units.error || partners.error) return NextResponse.json({ error: "อ่านข้อมูลอ้างอิงจากระบบไม่สำเร็จ" }, { status: 500 });
  try {
    return NextResponse.json(await previewStudentMobilityImport(file, { countries: countries.data, units: units.data, partners: partners.data }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ" }, { status: 400 });
  }
}
