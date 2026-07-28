import type { CurrentUserAccess, ModuleKey } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { buildMouAnalytics, type MouAnalytics, type MouAnalyticsSource } from "./mou-analytics";

export type DashboardSnapshot = {
  agreements: number;
  mobility: number;
  officialTravel: number;
  partnerContacts: number;
  mouAnalytics: MouAnalytics | null;
  connected: true;
};

function canView(access: CurrentUserAccess, module: ModuleKey) {
  return Boolean(access.modules[module]?.view);
}

export async function getDashboardSnapshot(
  access: CurrentUserAccess,
): Promise<DashboardSnapshot> {
  const supabase = await createClient();

  const mouAnalyticsPromise = canView(access, "mou")
    ? supabase
        .from("agreements")
        .select(`
          id, title_th, title_en, status, workflow_status, end_date,
          agreement_partners (
            is_lead, partner_name_th_snapshot, partner_name_en_snapshot,
            country_name_th_snapshot, country_name_en_snapshot
          ),
          agreement_units (
            is_owner, organization_units (name_th, name_en)
          )
        `)
        .is("deleted_at", null)
    : Promise.resolve({ data: [], error: null });
  const mobilityPromise = canView(access, "mobility")
    ? supabase
        .from("movement_cases")
        .select("*", { count: "exact", head: true })
        .in("category", [
          "student_mobility",
          "staff_mobility",
          "visiting_delegation",
        ])
    : Promise.resolve({ count: 0, error: null });
  const travelPromise = canView(access, "travel")
    ? supabase
        .from("movement_cases")
        .select("*", { count: "exact", head: true })
        .eq("category", "staff_official_travel")
    : Promise.resolve({ count: 0, error: null });
  const contactsPromise = canView(access, "mou")
    ? supabase
        .from("partner_contacts")
        .select("*", { count: "exact", head: true })
    : Promise.resolve({ count: 0, error: null });

  const [mouAnalyticsResult, mobility, travel, contacts] = await Promise.all([
    mouAnalyticsPromise,
    mobilityPromise,
    travelPromise,
    contactsPromise,
  ]);

  const firstError = [
    mouAnalyticsResult.error,
    mobility.error,
    travel.error,
    contacts.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(`Unable to read dashboard summary: ${firstError.message}`);
  }

  const mouAnalytics = canView(access, "mou")
    ? buildMouAnalytics((mouAnalyticsResult.data ?? []) as unknown as MouAnalyticsSource[])
    : null;

  return {
    agreements: mouAnalytics?.total ?? 0,
    mobility: mobility.count ?? 0,
    officialTravel: travel.count ?? 0,
    partnerContacts: contacts.count ?? 0,
    mouAnalytics,
    connected: true,
  };
}
