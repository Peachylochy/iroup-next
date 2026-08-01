import { createClient } from "@/lib/supabase/server";

import { contentModules, type ContentModule } from "./config";

export type ContentRecord = {
  id: string;
  title_th: string;
  title_en?: string | null;
  category?: string | null;
  resource_type?: string | null;
  event_type?: string | null;
  scholarship_type?: string | null;
  summary_th?: string | null;
  content_th?: string | null;
  internal_note?: string | null;
  publication_status: "draft" | "published" | "archived";
  public_visible: boolean;
  pinned: boolean;
  updated_at: string;
  published_at?: string | null;
  publish_date?: string | null;
  open_date?: string | null;
  close_date?: string | null;
  detail_url?: string | null;
  apply_url?: string | null;
  audience?: "student" | "staff" | "both" | "external";
  funding_type?: string | null;
  study_level?: string | null;
  partner_organization_id?: string | null;
  country_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  mode?: "onsite" | "online" | "hybrid";
  location_th?: string | null;
  registration_url?: string | null;
  participant_count?: number;
  organizer_unit_id?: string | null;
  external_url?: string | null;
};

export type ContentFormOptions = {
  countries: Array<{ id: string; name_th: string; name_en: string }>;
  partners: Array<{ id: string; name_th: string | null; name_en: string | null }>;
  units: Array<{ id: string; name_th: string; code: string | null }>;
};

export async function getContentRecords(module: ContentModule) {
  const supabase = await createClient();
  const config = contentModules[module];
  const { data, error } = await supabase
    .from(config.table)
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load ${module}: ${error.message}`);
  return (data ?? []) as unknown as ContentRecord[];
}

export async function getContentRecord(module: ContentModule, id: string) {
  const supabase = await createClient();
  const config = contentModules[module];
  const { data, error } = await supabase
    .from(config.table)
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Unable to load ${module} record: ${error.message}`);
  return data as unknown as ContentRecord | null;
}

export async function getContentFormOptions(): Promise<ContentFormOptions> {
  const supabase = await createClient();
  const [countries, partners, units] = await Promise.all([
    supabase.from("countries").select("id, name_th, name_en").eq("active", true).order("name_th"),
    supabase.from("partner_organizations").select("id, name_th, name_en").eq("active", true).order("name_en"),
    supabase.from("organization_units").select("id, name_th, code").eq("active", true).order("name_th"),
  ]);
  if (countries.error || partners.error || units.error) {
    throw new Error("Unable to load content form master data");
  }
  return {
    countries: countries.data ?? [],
    partners: partners.data ?? [],
    units: units.data ?? [],
  };
}
