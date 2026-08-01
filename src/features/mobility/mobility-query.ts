import { createClient } from "@/lib/supabase/server";

export type WorkflowStatus = "draft" | "under_review" | "approved" | "active" | "completed" | "cancelled" | "archived";

export type StudentMobility = {
  id: string;
  project_name: string;
  title_en: string | null;
  purpose: string | null;
  direction: "inbound" | "outbound" | "bilateral" | "not_applicable";
  country_name_snapshot: string | null;
  partner_name_snapshot: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  departure_at: string | null;
  return_at: string | null;
  fiscal_year: number | null;
  status: "planned" | "ongoing" | "completed" | "cancelled";
  workflow_status: WorkflowStatus;
  participant_count: number;
  updated_at: string;
  owner_unit_id: string | null;
  organization_units: { name_th: string; name_en: string | null } | null;
};

export type MobilityFormOptions = {
  countries: Array<{ id: string; name_th: string; name_en: string }>;
  partners: Array<{ id: string; name_th: string | null; name_en: string; country_id: string | null }>;
  units: Array<{ id: string; name_th: string; name_en: string | null }>;
};

export type MobilityFormRecord = Omit<StudentMobility, "organization_units"> & {
  country_id: string | null;
  partner_organization_id: string | null;
  owner_unit_id: string | null;
  activity_type: string | null;
  mobility_mode: string | null;
  participant_group: string | null;
  study_level: string | null;
  approval_reference: string | null;
  internal_note: string | null;
  movement_participants: Array<{
    id: string;
    person_id: string | null;
    person_source: "student" | "staff" | "external" | "manual";
    full_name_snapshot: string;
    organization_unit_id_snapshot: string | null;
    organization_unit_name_snapshot: string | null;
    student_id_snapshot: string | null;
    faculty_snapshot: string | null;
    study_program_snapshot: string | null;
    study_level_snapshot: string | null;
    participant_role: string | null;
  }>;
  movement_funding: Array<{ id: string; budget_type: string; source_name: string | null; amount: number | null; currency: string }>;
};

export type MobilityDetail = MobilityFormRecord & {
  created_at: string;
  movement_participants: Array<{
    id: string;
    person_id: string | null;
    person_source: "student" | "staff" | "external" | "manual";
    full_name_snapshot: string;
    organization_unit_id_snapshot: string | null;
    organization_unit_name_snapshot: string | null;
    student_id_snapshot: string | null;
    faculty_snapshot: string | null;
    study_program_snapshot: string | null;
    study_level_snapshot: string | null;
    participant_role: string | null;
  }>;
  movement_funding: Array<{
    id: string;
    budget_type: string;
    source_name: string | null;
    amount: number | null;
    currency: string;
  }>;
  movement_workflow_events: Array<{
    id: string;
    action: string;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    created_at: string;
    profiles: { display_name: string | null; email: string } | null;
  }>;
  countries: { name_th: string; name_en: string } | null;
  partner_organizations: { name_th: string | null; name_en: string } | null;
  organization_units: { name_th: string; name_en: string | null } | null;
};

export async function getStudentMobilities(): Promise<StudentMobility[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movement_cases")
    .select("id, project_name, title_en, purpose, direction, country_name_snapshot, partner_name_snapshot, city, start_date, end_date, departure_at, return_at, fiscal_year, status, workflow_status, participant_count, updated_at, owner_unit_id, organization_units(name_th, name_en)")
    .eq("category", "student_mobility")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load student mobility: ${error.message}`);
  return (data ?? []) as unknown as StudentMobility[];
}

export async function getMobilityFormOptions(): Promise<MobilityFormOptions> {
  const supabase = await createClient();
  const [countries, partners, units] = await Promise.all([
    supabase.from("countries").select("id, name_th, name_en").order("name_th"),
    supabase.from("partner_organizations").select("id, name_th, name_en, country_id").eq("active", true).order("name_en"),
    supabase.from("organization_units").select("id, name_th, name_en").eq("active", true).order("name_th"),
  ]);
  if (countries.error || partners.error || units.error) throw new Error("Unable to load mobility form options.");
  return { countries: countries.data, partners: partners.data, units: units.data };
}

export async function getMobilityForForm(id: string): Promise<MobilityFormRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movement_cases")
    .select("id, project_name, title_en, purpose, direction, country_id, country_name_snapshot, partner_organization_id, partner_name_snapshot, city, owner_unit_id, activity_type, mobility_mode, participant_group, study_level, approval_reference, start_date, end_date, departure_at, return_at, fiscal_year, status, workflow_status, participant_count, internal_note, updated_at, movement_participants(id, person_id, person_source, full_name_snapshot, organization_unit_id_snapshot, organization_unit_name_snapshot, student_id_snapshot, faculty_snapshot, study_program_snapshot, study_level_snapshot, participant_role), movement_funding(id, budget_type, source_name, amount, currency)")
    .eq("id", id).eq("category", "student_mobility").is("deleted_at", null).maybeSingle();
  if (error) throw new Error(`Unable to load student mobility: ${error.message}`);
  return data as MobilityFormRecord | null;
}

export async function getMobilityDetail(id: string): Promise<MobilityDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movement_cases")
    .select(`id, project_name, title_en, purpose, direction, country_id, country_name_snapshot, partner_organization_id, partner_name_snapshot, city, owner_unit_id, activity_type, mobility_mode, participant_group, study_level, approval_reference, start_date, end_date, departure_at, return_at, fiscal_year, status, workflow_status, participant_count, internal_note, updated_at, created_at,
      countries(name_th, name_en), partner_organizations(name_th, name_en), organization_units(name_th, name_en),
      movement_participants(id, person_id, person_source, full_name_snapshot, organization_unit_id_snapshot, organization_unit_name_snapshot, student_id_snapshot, faculty_snapshot, study_program_snapshot, study_level_snapshot, participant_role),
      movement_funding(id, budget_type, source_name, amount, currency),
      movement_workflow_events(id, action, from_status, to_status, note, created_at, profiles(display_name, email))`)
    .eq("id", id).eq("category", "student_mobility").maybeSingle();
  if (error) throw new Error(`Unable to load student mobility detail: ${error.message}`);
  return data as unknown as MobilityDetail | null;
}
