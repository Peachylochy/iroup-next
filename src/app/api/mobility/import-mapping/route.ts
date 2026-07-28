import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const partnerSchema = z.object({
  kind: z.literal("partner"),
  nameTh: z.string().trim().max(500).optional(),
  nameEn: z.string().trim().max(500).optional(),
  countryId: z.string().uuid().nullable().optional(),
});

const unitSchema = z.object({
  kind: z.literal("unit"),
  code: z.string().trim().max(100).optional(),
  nameTh: z.string().trim().min(1).max(500),
  nameEn: z.string().trim().max(500).optional(),
});

const countrySchema = z.object({
  kind: z.literal("country"),
  iso2: z.string().trim().regex(/^[A-Za-z]{2}$/),
  iso3: z.string().trim().regex(/^[A-Za-z]{3}$/),
  nameTh: z.string().trim().min(1).max(500),
  nameEn: z.string().trim().min(1).max(500),
});

const payloadSchema = z.discriminatedUnion("kind", [partnerSchema, unitSchema, countrySchema]);

export async function POST(request: Request) {
  const access = await getCurrentUserAccess();
  if (!access?.modules.mobility?.import) return NextResponse.json({ error: "คุณไม่มีสิทธิ์ตรวจข้อมูลนำเข้า Mobility" }, { status: 403 });

  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลสำหรับสร้าง mapping ไม่ครบ" }, { status: 400 });
  const payload = parsed.data;
  const supabase = await createClient();

  if (payload.kind === "partner") {
    if (!access.modules.mou?.create) return NextResponse.json({ error: "คุณไม่มีสิทธิ์เพิ่มองค์กรคู่ความร่วมมือ" }, { status: 403 });
    if (!payload.nameTh && !payload.nameEn) return NextResponse.json({ error: "กรอกชื่อองค์กรภาษาไทยหรืออังกฤษอย่างน้อยหนึ่งภาษา" }, { status: 400 });
    const { data, error } = await supabase.rpc("partner_organization_save", {
      target_partner_id: null,
      expected_updated_at: null,
      payload: {
        name_th: payload.nameTh || "",
        name_en: payload.nameEn || "",
        country_id: payload.countryId || "",
        verification_status: "pending_verification",
        source_note: "สร้างจากการตรวจ mapping ข้อมูลนำเข้า Mobility นิสิต",
      },
    });
    if (error) return NextResponse.json({ error: error.message.includes("DUPLICATE") ? "พบองค์กรชื่อเดียวกันแล้ว กรุณาเลือกรายการเดิม" : "สร้างองค์กรไม่สำเร็จ" }, { status: 400 });
    const saved = data as { id: string; verification_status: string };
    return NextResponse.json({ id: saved.id, nameTh: payload.nameTh || null, nameEn: payload.nameEn || null, verificationStatus: saved.verification_status });
  }

  if (payload.kind === "country") {
    if (!access.roles.includes("system_admin")) return NextResponse.json({ error: "เฉพาะ System Admin เท่านั้นที่เพิ่มประเทศได้" }, { status: 403 });
    const { data, error } = await supabase
      .from("countries")
      .insert({
        iso2: payload.iso2.toUpperCase(),
        iso3: payload.iso3.toUpperCase(),
        name_th: payload.nameTh,
        name_en: payload.nameEn,
      })
      .select("id, iso2, iso3, name_th, name_en")
      .single();
    if (error) {
      console.error("Unable to create country from mobility import mapping", error);
      const message = error.code === "23505"
        ? "พบประเทศหรือรหัส ISO นี้แล้ว กรุณาเลือกข้อมูลเดิม"
        : error.code === "42501"
          ? "บัญชีนี้ไม่มีสิทธิ์เพิ่มประเทศ"
          : "สร้างประเทศไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ id: data.id, iso2: data.iso2, iso3: data.iso3, nameTh: data.name_th, nameEn: data.name_en });
  }

  if (!access.roles.includes("system_admin")) return NextResponse.json({ error: "เฉพาะ System Admin เท่านั้นที่เพิ่มหน่วยงาน ม.พะเยาได้" }, { status: 403 });
  const { data, error } = await supabase
    .from("organization_units")
    .insert({ code: payload.code || null, name_th: payload.nameTh, name_en: payload.nameEn || null, unit_type: "import_pending" })
    .select("id, code, name_th, name_en")
    .single();
  if (error) {
    console.error("Unable to create organization unit from mobility import mapping", error);
    const message = error.code === "23505"
      ? "พบรหัสหน่วยงานนี้แล้ว กรุณาเลือกรายการเดิม"
      : error.code === "42501"
        ? "บัญชีนี้ไม่มีสิทธิ์เพิ่มหน่วยงาน ม.พะเยา"
        : "สร้างหน่วยงานไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ id: data.id, code: data.code, nameTh: data.name_th, nameEn: data.name_en });
}
