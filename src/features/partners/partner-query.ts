import { createClient } from "@/lib/supabase/server";

export type PartnerVerificationStatus =
  | "pending_verification"
  | "verified"
  | "incomplete";

export type PartnerOrganization = {
  id: string;
  name_th: string | null;
  name_en: string | null;
  organization_type: string | null;
  country_id: string | null;
  city: string | null;
  website_url: string | null;
  verification_status: PartnerVerificationStatus;
  source_note: string | null;
  active: boolean;
  updated_at: string;
  countries: Array<{ name_th: string; name_en: string; iso2: string }>;
};

export type ContactMethod = {
  id: string;
  method_type: "email" | "phone" | "messaging" | "social" | "website" | "other";
  value: string;
  label: string | null;
  is_primary: boolean;
};

export type PartnerContact = {
  id: string;
  partner_organization_id: string;
  full_name: string;
  position_title: string | null;
  department: string | null;
  expertise_areas: string[];
  relationship_level: "unrated" | "low" | "medium" | "high";
  preferred_language: string | null;
  internal_note: string | null;
  last_contacted_on: string | null;
  active: boolean;
  created_at: string;
  partner_organizations?: {
    name_th: string | null;
    name_en: string | null;
    countries?: Array<{ name_th: string; name_en: string }>;
  };
  partner_contact_methods?: ContactMethod[];
};

export type PartnerInteraction = {
  id: string;
  partner_contact_id: string;
  occurred_on: string | null;
  interaction_type: string | null;
  context: string | null;
  note: string | null;
  follow_up_on: string | null;
  created_at: string;
  partner_contacts?: { full_name: string };
};

export type PartnerFormOptions = {
  countries: Array<{ id: string; name_th: string; name_en: string }>;
};

export type LinkedAgreement = {
  id: string;
  agreement_number: string | null;
  title_th: string | null;
  title_en: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  fiscal_year: number | null;
};

export async function getPartnerOrganizations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_organizations")
    .select(
      "id, name_th, name_en, organization_type, country_id, city, website_url, verification_status, source_note, active, updated_at, countries(name_th, name_en, iso2)",
    )
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Unable to load partner organizations: ${error.message}`);
  return (data ?? []) as unknown as PartnerOrganization[];
}

export async function getPartnerOrganization(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_organizations")
    .select(
      "id, name_th, name_en, organization_type, country_id, city, website_url, verification_status, source_note, active, updated_at, countries(name_th, name_en, iso2)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load partner organization: ${error.message}`);
  return (data ?? null) as unknown as PartnerOrganization | null;
}

export async function getPartnerContacts(organizationId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("partner_contacts")
    .select(
      "id, partner_organization_id, full_name, position_title, department, expertise_areas, relationship_level, preferred_language, internal_note, last_contacted_on, active, created_at, partner_organizations(name_th, name_en, countries(name_th, name_en)), partner_contact_methods(id, method_type, value, label, is_primary)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("partner_organization_id", organizationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load partner contacts: ${error.message}`);
  return (data ?? []) as unknown as PartnerContact[];
}

export async function getPartnerInteractions(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_contact_interactions")
    .select(
      "id, partner_contact_id, occurred_on, interaction_type, context, note, follow_up_on, created_at, partner_contacts!inner(partner_organization_id, full_name)",
    )
    .eq("partner_contacts.partner_organization_id", organizationId)
    .order("occurred_on", { ascending: false });

  if (error) throw new Error(`Unable to load partner interactions: ${error.message}`);
  return (data ?? []) as unknown as PartnerInteraction[];
}

export async function getLinkedAgreementsForPartner(
  organizationId: string,
): Promise<LinkedAgreement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agreement_partners")
    .select(
      "agreement_id, agreements(id, agreement_number, title_th, title_en, status, start_date, end_date, fiscal_year)",
    )
    .eq("partner_organization_id", organizationId);

  if (error) throw new Error(`Unable to load linked agreements: ${error.message}`);
  const agreements = (data ?? []).flatMap((item) => item.agreements ?? []);

  return agreements as unknown as LinkedAgreement[];
}

export async function getPartnerFormOptions(): Promise<PartnerFormOptions> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("countries")
    .select("id, name_th, name_en")
    .eq("active", true)
    .order("name_en");

  if (error) throw new Error(`Unable to load countries: ${error.message}`);
  return { countries: data ?? [] };
}
