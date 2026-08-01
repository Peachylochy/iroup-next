import { createClient } from "@/lib/supabase/server";

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
  updated_at: string;
  partner_organizations: {
    name_th: string | null;
    name_en: string | null;
    countries: { name_th: string; name_en: string } | null;
  } | null;
  partner_contact_methods: ContactMethod[];
};

export type ContactFormOptions = {
  partners: Array<{
    id: string;
    name_th: string | null;
    name_en: string | null;
    countries: { name_th: string; name_en: string } | null;
  }>;
};

const contactSelect = `
  id, partner_organization_id, full_name, position_title, department,
  expertise_areas, relationship_level, preferred_language, internal_note,
  last_contacted_on, active, updated_at,
  partner_organizations(name_th, name_en, countries(name_th, name_en)),
  partner_contact_methods(id, method_type, value, label, is_primary)
`;

export async function getPartnerContacts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_contacts")
    .select(contactSelect)
    .is("deleted_at", null)
    .order("full_name");
  if (error) throw new Error(`Unable to load partner contacts: ${error.message}`);
  return (data ?? []) as unknown as PartnerContact[];
}

export async function getPartnerContact(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_contacts")
    .select(contactSelect)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Unable to load partner contact: ${error.message}`);
  return data as unknown as PartnerContact | null;
}

export async function getContactFormOptions(): Promise<ContactFormOptions> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_organizations")
    .select("id, name_th, name_en, countries(name_th, name_en)")
    .eq("active", true)
    .order("name_en");
  if (error) throw new Error(`Unable to load partner organizations: ${error.message}`);
  return { partners: (data ?? []) as unknown as ContactFormOptions["partners"] };
}
