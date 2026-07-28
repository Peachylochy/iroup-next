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
    partner_name_th_snapshot: string | null;
    partner_name_en_snapshot: string | null;
    country_name_th_snapshot: string | null;
    country_name_en_snapshot: string | null;
    partner_organizations: {
      name_th: string | null;
      name_en: string;
      countries: {
        iso2: string;
        name_th: string;
        name_en: string;
        continent_code: string | null;
      } | null;
    } | null;
  }>;
  agreement_units: Array<{
    is_owner: boolean;
    organization_units: {
      id: string;
      name_th: string;
      name_en: string | null;
      code: string | null;
    } | null;
  }>;
};

export async function getMouAgreements() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agreements")
    .select(
      `
      id, agreement_number, title_th, title_en, agreement_type,
      signed_date, start_date, end_date, fiscal_year, status,
      publication_status, workflow_status, internal_note, updated_at,
      agreement_partners (
        is_lead, partner_name_th_snapshot, partner_name_en_snapshot,
        country_name_th_snapshot, country_name_en_snapshot,
        partner_organizations (
          name_th, name_en,
          countries (
            iso2, name_th, name_en, continent_code
          )
        )
      ),
      agreement_units (
        is_owner,
        organization_units (
          id, name_th, name_en, code
        )
      )
      `,
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Unable to read MOU agreements: " + error.message);
  }

  return (data ?? []) as unknown as MouAgreement[];
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

export type MouFormAgreement = Omit<MouAgreement, "agreement_partners" | "agreement_units"> & {
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

export type MouDetail = {
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
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  agreement_partners: Array<{
    partner_organization_id: string;
    is_lead: boolean;
    partner_name_th_snapshot: string | null;
    partner_name_en_snapshot: string | null;
    country_name_th_snapshot: string | null;
    country_name_en_snapshot: string | null;
    partner_organizations: {
      id: string;
      name_th: string | null;
      name_en: string;
      verification_status: string;
      countries: { name_th: string; name_en: string } | null;
    } | null;
  }>;
  agreement_units: Array<{
    organization_unit_id: string;
    is_owner: boolean;
    organization_units: {
      id: string;
      name_th: string;
      name_en: string | null;
      code: string | null;
    } | null;
  }>;
  record_assets: Array<{
    id: string;
    asset_id: string;
    created_at: string;
    assets: {
      id: string;
      storage_bucket: string;
      storage_path: string;
      original_file_name: string;
      mime_type: string | null;
      size_bytes: number | null;
      created_at: string;
    };
  }>;
  agreement_workflow_events: Array<{
    id: string;
    action: string;
    from_status: string | null;
    to_status: string;
    note: string | null;
    created_at: string;
    profiles: {
      display_name: string | null;
      email: string;
    } | null;
  }>;
};

export async function getMouDetail(id: string): Promise<MouDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agreements")
    .select(
      `
      id, agreement_number, title_th, title_en, agreement_type,
      signed_date, start_date, end_date, fiscal_year, status,
      publication_status, workflow_status, internal_note, created_at, updated_at, deleted_at,
      agreement_partners (
        partner_organization_id, is_lead, partner_name_th_snapshot, partner_name_en_snapshot,
        country_name_th_snapshot, country_name_en_snapshot,
        partner_organizations (
          id, name_th, name_en, verification_status, countries (name_th, name_en)
        )
      ),
      agreement_units (
        organization_unit_id, is_owner,
        organization_units (
          id, name_th, name_en, code
        )
      ),
      record_assets (
        id, asset_id, created_at,
        assets (
          id, storage_bucket, storage_path, original_file_name, mime_type, size_bytes, created_at
        )
      ),
      agreement_workflow_events (
        id, action, from_status, to_status, note, created_at,
        profiles (
          display_name, email
        )
      )
      `,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "agreement_workflow_events", ascending: false })
    .maybeSingle();

  if (error) throw new Error(`Unable to load MOU detail: ${error.message}`);
  if (!data) return null;

  return data as unknown as MouDetail;
}
