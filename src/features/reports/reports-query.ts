import { createClient } from "@/lib/supabase/server";

export type PortalReportData = {
  generatedAt: string;
  totals: {
    mou: number;
    studentMobility: number;
    staffMobility: number;
    travel: number;
    contacts: number;
    scholarships: number;
    events: number;
    news: number;
    knowledge: number;
  };
  movementByCountry: Array<{ country: string; count: number }>;
  movementByUnit: Array<{ unit: string; count: number }>;
  workflow: Array<{ status: string; count: number }>;
};

type MovementRow = {
  category: "student_mobility" | "staff_mobility" | "staff_official_travel";
  country_name_snapshot: string | null;
  workflow_status: string;
  organization_units:
    | { name_th: string | null }
    | Array<{ name_th: string | null }>
    | null;
};

function countBy(values: string[]) {
  return Array.from(
    values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map<string, number>()),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
}

export async function getPortalReportData(): Promise<PortalReportData> {
  const supabase = await createClient();
  const [
    agreements,
    movements,
    contacts,
    scholarships,
    events,
    news,
    knowledge,
  ] = await Promise.all([
    supabase.from("agreements").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("movement_cases")
      .select("category, country_name_snapshot, workflow_status, organization_units(name_th)")
      .is("deleted_at", null),
    supabase.from("partner_contacts").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("scholarships").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("events").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("news_articles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("knowledge_items").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const errors = [
    agreements.error,
    movements.error,
    contacts.error,
    scholarships.error,
    events.error,
    news.error,
    knowledge.error,
  ].filter(Boolean);
  if (errors.length) throw new Error("Unable to load portal report data");

  const movementRows = (movements.data ?? []) as unknown as MovementRow[];
  const categoryCount = (category: MovementRow["category"]) =>
    movementRows.filter((row) => row.category === category).length;
  const countries = countBy(
    movementRows.map((row) => row.country_name_snapshot || "ยังไม่ระบุประเทศ"),
  ).slice(0, 10);
  const units = countBy(
    movementRows.map((row) => {
      const unit = Array.isArray(row.organization_units)
        ? row.organization_units[0]
        : row.organization_units;
      return unit?.name_th || "ยังไม่ระบุหน่วยงาน";
    }),
  ).slice(0, 10);
  const workflow = countBy(
    movementRows.map((row) => row.workflow_status),
  );

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      mou: agreements.count || 0,
      studentMobility: categoryCount("student_mobility"),
      staffMobility: categoryCount("staff_mobility"),
      travel: categoryCount("staff_official_travel"),
      contacts: contacts.count || 0,
      scholarships: scholarships.count || 0,
      events: events.count || 0,
      news: news.count || 0,
      knowledge: knowledge.count || 0,
    },
    movementByCountry: countries.map(({ name, count }) => ({ country: name, count })),
    movementByUnit: units.map(({ name, count }) => ({ unit: name, count })),
    workflow: workflow.map(({ name, count }) => ({ status: name, count })),
  };
}
