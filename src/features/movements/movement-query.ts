import { createClient } from "@/lib/supabase/server";
import type { WorkflowStatus } from "@/features/mobility/mobility-query";
import {
  staffMovementModules,
  type StaffMovementModule,
} from "./config";

export type StaffMovementRecord = {
  id: string;
  project_name: string;
  title_en: string | null;
  purpose: string | null;
  direction: "inbound" | "outbound" | "bilateral" | "not_applicable";
  country_id: string | null;
  country_name_snapshot: string | null;
  city: string | null;
  partner_organization_id: string | null;
  partner_name_snapshot: string | null;
  owner_unit_id: string | null;
  activity_type: string | null;
  mobility_mode: string | null;
  approval_reference: string | null;
  start_date: string | null;
  end_date: string | null;
  departure_at: string | null;
  return_at: string | null;
  fiscal_year: number | null;
  status: "planned" | "ongoing" | "completed" | "cancelled";
  workflow_status: WorkflowStatus;
  participant_count: number;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
  organization_units: { name_th: string; name_en: string | null } | null;
  countries: { name_th: string; name_en: string } | null;
  partner_organizations: { name_th: string | null; name_en: string } | null;
  movement_participants: Array<{
    id: string;
    person_id: string | null;
    person_source: "student" | "staff" | "external" | "manual";
    full_name_snapshot: string;
    organization_unit_id_snapshot: string | null;
    organization_unit_name_snapshot: string | null;
    position_snapshot: string | null;
    participant_role: string | null;
  }>;
  movement_funding: Array<{
    id: string;
    budget_type: string;
    source_name: string | null;
    amount: number | null;
    currency: string;
    note: string | null;
  }>;
  movement_workflow_events: Array<{
    id: string;
    action: string;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    created_at: string;
  }>;
};

export type StaffMovementListItem = Omit<
  StaffMovementRecord,
  | "movement_participants"
  | "movement_funding"
  | "movement_workflow_events"
  | "countries"
  | "partner_organizations"
  | "internal_note"
  | "created_at"
>;

export async function getStaffMovements(module: StaffMovementModule) {
  const supabase = await createClient();
  const { category } = staffMovementModules[module];
  const { data, error } = await supabase
    .from("movement_cases")
    .select(
      "id, project_name, title_en, purpose, direction, country_id, country_name_snapshot, city, partner_organization_id, partner_name_snapshot, owner_unit_id, activity_type, mobility_mode, approval_reference, start_date, end_date, departure_at, return_at, fiscal_year, status, workflow_status, participant_count, updated_at, organization_units(name_th, name_en)",
    )
    .eq("category", category)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load ${module}: ${error.message}`);
  return (data ?? []) as unknown as StaffMovementListItem[];
}

export async function getStaffMovement(
  module: StaffMovementModule,
  id: string,
) {
  const supabase = await createClient();
  const { category } = staffMovementModules[module];
  const { data, error } = await supabase
    .from("movement_cases")
    .select(
      `id, project_name, title_en, purpose, direction, country_id, country_name_snapshot, city,
       partner_organization_id, partner_name_snapshot, owner_unit_id, activity_type, mobility_mode,
       approval_reference, start_date, end_date, departure_at, return_at, fiscal_year, status,
       workflow_status, participant_count, internal_note, created_at, updated_at,
       organization_units(name_th, name_en), countries(name_th, name_en),
       partner_organizations(name_th, name_en),
       movement_participants(id, person_id, person_source, full_name_snapshot,
         organization_unit_id_snapshot, organization_unit_name_snapshot, position_snapshot,
         participant_role),
       movement_funding(id, budget_type, source_name, amount, currency, note),
       movement_workflow_events(id, action, from_status, to_status, note, created_at)`,
    )
    .eq("id", id)
    .eq("category", category)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Unable to load ${module} record: ${error.message}`);
  return data as unknown as StaffMovementRecord | null;
}
