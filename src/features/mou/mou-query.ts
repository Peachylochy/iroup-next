import { createClient } from "@/lib/supabase/server";

export type MouAgreement = {
  id: string;
  agreement_number: string | null;
  title_th: string;
  title_en: string | null;
  agreement_type: string;
  start_date: string;
  end_date: string | null;
  fiscal_year: number;
  status: "draft" | "active" | "expired" | "terminated";
  publication_status: "draft" | "published" | "archived";
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
      "id, agreement_number, title_th, title_en, agreement_type, start_date, end_date, fiscal_year, status, publication_status, updated_at, agreement_partners(is_lead, partner_organizations(name_th, name_en))",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Unable to read MOU agreements: " + error.message);
  }

  return (data ?? []) as MouAgreement[];
}
