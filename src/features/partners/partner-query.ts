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
  countries: Array<{ name_th: string; name_en: string }>;
};

export type PartnerFormOptions = {
  countries: Array<{ id: string; name_th: string; name_en: string }>;
};

export async function getPartnerOrganizations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_organizations")
    .select("id, name_th, name_en, organization_type, country_id, city, website_url, verification_status, source_note, active, updated_at, countries(name_th, name_en)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Unable to load partner organizations: ${error.message}`);
  return (data ?? []) as PartnerOrganization[];
}

export async function getPartnerOrganization(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_organizations")
    .select("id, name_th, name_en, organization_type, country_id, city, website_url, verification_status, source_note, active, updated_at, countries(name_th, name_en)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Unable to load partner organization: ${error.message}`);
  return data as PartnerOrganization | null;
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
