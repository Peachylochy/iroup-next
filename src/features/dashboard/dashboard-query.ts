import type { CurrentUserAccess, ModuleKey } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { buildMouAnalytics, type MouAnalytics, type MouAnalyticsSource } from "./mou-analytics";

export type DashboardSnapshot = {
  agreements: number;
  mobility: number;
  officialTravel: number;
  partnerContacts: number;
  attentionCount: number;
  recentActivities: Array<{
    id: string;
    title: string;
    detail: string;
    module: string;
    href: string;
    occurredAt: string;
    internal?: boolean;
  }>;
  upcomingItems: Array<{
    id: string;
    title: string;
    module: string;
    href: string;
    occursAt: string;
  }>;
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
  const recentMouPromise = canView(access, "mou")
    ? supabase
        .from("agreements")
        .select("id, title_th, title_en, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5)
    : Promise.resolve({ data: [], error: null });
  const recentMovementPromise =
    canView(access, "mobility") || canView(access, "travel")
      ? supabase
          .from("movement_cases")
          .select("id, project_name, category, updated_at")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null });
  const recentContactPromise = canView(access, "mou")
    ? supabase
        .from("partner_contacts")
        .select("id, full_name, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5)
    : Promise.resolve({ data: [], error: null });
  const upcomingEventsPromise = canView(access, "events")
    ? supabase
        .from("events")
        .select("id, title_th, starts_at")
        .is("deleted_at", null)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5)
    : Promise.resolve({ data: [], error: null });

  const [
    mouAnalyticsResult,
    mobility,
    travel,
    contacts,
    recentMou,
    recentMovement,
    recentContact,
    upcomingEvents,
  ] = await Promise.all([
    mouAnalyticsPromise,
    mobilityPromise,
    travelPromise,
    contactsPromise,
    recentMouPromise,
    recentMovementPromise,
    recentContactPromise,
    upcomingEventsPromise,
  ]);

  const firstError = [
    mouAnalyticsResult.error,
    mobility.error,
    travel.error,
    contacts.error,
    recentMou.error,
    recentMovement.error,
    recentContact.error,
    upcomingEvents.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(`Unable to read dashboard summary: ${firstError.message}`);
  }

  const mouAnalytics = canView(access, "mou")
    ? buildMouAnalytics((mouAnalyticsResult.data ?? []) as unknown as MouAnalyticsSource[])
    : null;
  const recentActivities = [
    ...(recentMou.data ?? []).map((item) => ({
      id: `mou-${item.id}`,
      title: item.title_th || item.title_en || "MOU",
      detail: "อัปเดตข้อมูล MOU",
      module: "ความร่วมมือและ MOU",
      href: `/mou/${item.id}`,
      occurredAt: item.updated_at,
    })),
    ...(recentMovement.data ?? []).map((item) => {
      const isTravel = item.category === "staff_official_travel";
      const isStaff = item.category === "staff_mobility";
      const route = isTravel ? "/travel" : isStaff ? "/staff-mobility" : "/mobility";
      return {
        id: `movement-${item.id}`,
        title: item.project_name,
        detail: "อัปเดตข้อมูลการเดินทางและ Mobility",
        module: isTravel
          ? "เดินทางไปปฏิบัติงาน"
          : isStaff
            ? "Mobility บุคลากร"
            : "Mobility นิสิต",
        href: `${route}/${item.id}`,
        occurredAt: item.updated_at,
      };
    }),
    ...(recentContact.data ?? []).map((item) => ({
      id: `contact-${item.id}`,
      title: item.full_name,
      detail: "อัปเดตผู้ติดต่อองค์กรต่างประเทศ",
      module: "ผู้ติดต่อองค์กรต่างประเทศ",
      href: `/mou/contacts/${item.id}/edit`,
      occurredAt: item.updated_at,
      internal: true,
    })),
  ]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 6);
  const upcomingItems = [
    ...(mouAnalytics?.renewals ?? []).map((item) => ({
      id: `mou-${item.id}`,
      title: item.title,
      module: "MOU ครบกำหนด",
      href: `/mou/${item.id}`,
      occursAt: item.endDate,
    })),
    ...(upcomingEvents.data ?? []).map((item) => ({
      id: `event-${item.id}`,
      title: item.title_th,
      module: "กิจกรรม",
      href: `/events/${item.id}/edit`,
      occursAt: item.starts_at,
    })),
  ]
    .sort((a, b) => Date.parse(a.occursAt) - Date.parse(b.occursAt))
    .slice(0, 6);

  return {
    agreements: mouAnalytics?.total ?? 0,
    mobility: mobility.count ?? 0,
    officialTravel: travel.count ?? 0,
    partnerContacts: contacts.count ?? 0,
    attentionCount:
      (mouAnalytics?.expiring ?? 0) + (mouAnalytics?.underReview ?? 0),
    recentActivities,
    upcomingItems,
    mouAnalytics,
    connected: true,
  };
}
