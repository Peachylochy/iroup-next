import { NextResponse } from "next/server";

import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const access = await getCurrentUserAccess();
  if (!access || !hasWorkspaceAccess(access) || (!access.modules.mobility?.view && !access.modules.travel?.view)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ค้นหาข้อมูลบุคคล" }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "staff" ? "staff" : "student";
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (query.length < 2) return NextResponse.json({ results: [] });

  const escaped = query.replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", " ");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, person_type, source_identifier, full_name_th, full_name_en, organization_unit_id, program_or_position, organization_units(name_th)")
    .eq("person_type", type)
    .eq("active", true)
    .or(`source_identifier.ilike.%${escaped}%,full_name_th.ilike.%${escaped}%,full_name_en.ilike.%${escaped}%`)
    .order("full_name_th")
    .limit(20);

  if (error) {
    console.error("Unable to search people master", error);
    return NextResponse.json({ error: "ค้นหารายชื่อไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({
    results: (data ?? []).map((person) => {
      const unit = Array.isArray(person.organization_units) ? person.organization_units[0] : person.organization_units;
      return {
        id: person.id,
        personType: person.person_type,
        sourceIdentifier: person.source_identifier,
        fullNameTh: person.full_name_th,
        fullNameEn: person.full_name_en,
        organizationUnitId: person.organization_unit_id,
        organizationUnitName: unit?.name_th ?? null,
        programOrPosition: person.program_or_position,
      };
    }),
  });
}
