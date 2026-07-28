import { createClient } from "@/lib/supabase/server";

export type MovementCategory =
  | "student_exchange"
  | "staff_exchange"
  | "staff_official_travel";

export type MovementDirection = "inbound" | "outbound";

export type WorkflowStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "completed"
  | "cancelled";

export type MovementCase = {
  id: string;
  category: MovementCategory;
  direction: MovementDirection;
  title_th: string;
  title_en: string | null;
  partner_organization_id: string | null;
  owner_unit_id: string | null;
  activity_type: string | null;
  mobility_mode: string | null;
  participant_group: string | null;
  study_level: string | null;
  approval_reference: string | null;
  start_date: string | null;
  end_date: string | null;
  workflow_status: WorkflowStatus;
  created_at: string;
  updated_at: string;
  partner_organizations?: {
    id: string;
    name_th: string | null;
    name_en: string | null;
    countries?: Array<{ name_th: string; name_en: string }>;
  } | null;
  organization_units?: {
    id: string;
    name_th: string;
    code: string;
  } | null;
  movement_participants?: Array<{
    id: string;
    full_name_snapshot: string;
    participant_role: string | null;
  }>;
  movement_funding?: Array<{
    id: string;
    amount: number;
    currency: string;
    budget_types?: { name_th: string } | null;
  }>;
};

export type MobilityFormOptions = {
  partners: Array<{ id: string; name_th: string | null; name_en: string | null }>;
  units: Array<{ id: string; name_th: string; code: string }>;
  budgetTypes: Array<{ id: string; name_th: string }>;
};

export async function getMovementCases(category?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("movement_cases")
    .select(
      "id, category, direction, title_th, title_en, partner_organization_id, owner_unit_id, activity_type, mobility_mode, participant_group, study_level, approval_reference, start_date, end_date, workflow_status, created_at, updated_at, partner_organizations(id, name_th, name_en, countries(name_th, name_en)), organization_units!movement_cases_owner_unit_id_fkey(id, name_th, code), movement_participants(id, full_name_snapshot, participant_role), movement_funding(id, amount, currency, budget_types(name_th))",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (category && (category === "student_exchange" || category === "staff_exchange" || category === "staff_official_travel")) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load movement cases: ${error.message}`);
  }

  return (data ?? []) as unknown as MovementCase[];
}

export async function getMovementCaseById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movement_cases")
    .select(
      "id, category, direction, title_th, title_en, partner_organization_id, owner_unit_id, activity_type, mobility_mode, participant_group, study_level, approval_reference, start_date, end_date, workflow_status, created_at, updated_at, partner_organizations(id, name_th, name_en, countries(name_th, name_en)), organization_units!movement_cases_owner_unit_id_fkey(id, name_th, code), movement_participants(id, full_name_snapshot, participant_role), movement_funding(id, amount, currency, budget_types(name_th))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load movement case: ${error.message}`);
  }

  return (data ?? null) as unknown as MovementCase | null;
}

export async function getMobilityFormOptions(): Promise<MobilityFormOptions> {
  const supabase = await createClient();
  const [partnersRes, unitsRes, budgetTypesRes] = await Promise.all([
    supabase
      .from("partner_organizations")
      .select("id, name_th, name_en")
      .eq("active", true)
      .order("name_en"),
    supabase
      .from("organization_units")
      .select("id, name_th, code")
      .eq("active", true)
      .order("name_th"),
    supabase
      .from("budget_types")
      .select("id, name_th")
      .eq("active", true)
      .order("name_th"),
  ]);

  return {
    partners: partnersRes.data ?? [],
    units: unitsRes.data ?? [],
    budgetTypes: budgetTypesRes.data ?? [],
  };
}
