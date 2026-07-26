import type { CurrentUserAccess, ModuleKey } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export type DashboardSnapshot = {
  agreements: number;
  mobility: number;
  officialTravel: number;
  partnerContacts: number;
  connected: true;
};

function canView(access: CurrentUserAccess, module: ModuleKey) {
  return Boolean(access.modules[module]?.view);
}

export async function getDashboardSnapshot(
  access: CurrentUserAccess,
): Promise<DashboardSnapshot> {
  const supabase = await createClient();

  const agreementsPromise = canView(access, "mou")
    ? supabase.from("agreements").select("*", { count: "exact", head: true })
    : Promise.resolve({ count: 0, error: null });
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

  const [agreements, mobility, travel, contacts] = await Promise.all([
    agreementsPromise,
    mobilityPromise,
    travelPromise,
    contactsPromise,
  ]);

  const firstError = [
    agreements.error,
    mobility.error,
    travel.error,
    contacts.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(`Unable to read dashboard summary: ${firstError.message}`);
  }

  return {
    agreements: agreements.count ?? 0,
    mobility: mobility.count ?? 0,
    officialTravel: travel.count ?? 0,
    partnerContacts: contacts.count ?? 0,
    connected: true,
  };
}
