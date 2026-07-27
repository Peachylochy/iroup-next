import { createClient } from "@/lib/supabase/server";

export type MouAgreement = {
  id: string;
  agreement_number: string | null;
  title_th: string;
  title_en: string | null;
  agreement_type: string | null;
  signed_date: string | null;
  start_date: string | null;
  end_date: string | null;
  fiscal_year: number | null;
  status: "draft" | "active" | "expiring" | "expired" | "terminated";
  publication_status: "draft" | "published" | "archived";
  workflow_status:
    | "draft"
    | "under_review"
    | "approved"
    | "active"
    | "completed"
    | "cancelled"
    | "archived";
  internal_note: string | null;
  updated_at: string;
  agreement_partners: Array<{
    is_lead: boolean;
    partner_organizations: Array<{
      name_th: string | null;
      name_en: string;
    }>;
  }>;
};

export async function getMouAgreements() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agreements")
    .select(
      "id, agreement_number, title_th, title_en, agreement_type, signed_date, start_date, end_date, fiscal_year, status, publication_status, workflow_status, internal_note, updated_at, agreement_partners(is_lead, partner_organizations(name_th, name_en))",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Unable to read MOU agreements: " + error.message);
  }

  return (data ?? []) as MouAgreement[];
}

export type MouFormOptions = {
  partners: Array<{
    id: string;
    name_th: string | null;
    name_en: string | null;
    countries: { name_th: string; name_en: string } | null;
  }>;
  units: Array<{ id: string; name_th: string; name_en: string | null }>;
};

export type MouFormAgreement = Omit<MouAgreement, "agreement_partners"> & {
  agreement_partners: Array<{
    is_lead: boolean;
    partner_organization_id: string;
  }>;
  agreement_units: Array<{
    is_owner: boolean;
    organization_unit_id: string;
  }>;
};

export async function getMouFormOptions(): Promise<MouFormOptions> {
  const supabase = await createClient();
  const [partnersResult, unitsResult] = await Promise.all([
    supabase
      .from("partner_organizations")
      .select("id, name_th, name_en, countries(name_th, name_en)")
      .eq("active", true)
      .order("name_en"),
    supabase
      .from("organization_units")
      .select("id, name_th, name_en")
      .eq("active", true)
      .order("name_th"),
  ]);

  if (partnersResult.error || unitsResult.error) {
    throw new Error(
      `Unable to load MOU form options: ${partnersResult.error?.message ?? unitsResult.error?.message}`,
    );
  }

  const partners = partnersResult.data.map((partner) => {
    const country = Array.isArray(partner.countries)
      ? partner.countries[0] ?? null
      : partner.countries;

    return {
      id: partner.id,
      name_th: partner.name_th,
      name_en: partner.name_en,
      countries: country ? { name_th: country.name_th, name_en: country.name_en } : null,
    };
  }) as MouFormOptions["partners"];

  return { partners, units: unitsResult.data };
}

export async function getMouAgreementForForm(id: string): Promise<MouFormAgreement | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agreements")
    .select(
      "id, agreement_number, title_th, title_en, agreement_type, signed_date, start_date, end_date, fiscal_year, status, publication_status, workflow_status, internal_note, updated_at, agreement_partners(is_lead, partner_organization_id), agreement_units(is_owner, organization_unit_id)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`Unable to load MOU: ${error.message}`);
  return data as MouFormAgreement | null;
}
