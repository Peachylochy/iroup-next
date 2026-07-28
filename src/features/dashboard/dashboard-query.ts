import type { CurrentUserAccess, ModuleKey } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export type DashboardSnapshot = {
  agreements: number;
  mobility: number;
  officialTravel: number;
  partnerContacts: number;
  connected: true;
  priorityItems: Array<{
    title: string;
    description: string;
    count: number;
    status: string;
    due?: string;
    tone: "critical" | "warning" | "attention";
    iconName: string;
  }>;
  recentActivities: Array<{
    id: string;
    time: string;
    title: string;
    detail: string;
    module: string;
    iconName: string;
  }>;
  upcomingItems: Array<{
    day: string;
    month: string;
    time: string;
    title: string;
    module: string;
  }>;
};

type WorkflowEventRow = {
  id: string;
  created_at: string;
  action: string;
  agreements: Array<{ title_th: string | null }>;
};

type UpcomingAgreementRow = {
  end_date: string;
  title_th: string | null;
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

  // Dynamic priority queries
  const expiringMouPromise = canView(access, "mou")
    ? supabase.from("agreements")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .not("end_date", "is", null)
    : Promise.resolve({ count: 0, error: null });

  const draftMouPromise = canView(access, "mou")
    ? supabase.from("agreements")
        .select("*", { count: "exact", head: true })
        .eq("workflow_status", "under_review")
    : Promise.resolve({ count: 0, error: null });

  const recentEventsPromise = canView(access, "mou")
    ? supabase.from("agreement_workflow_events")
        .select("id, created_at, action, from_status, to_status, agreements(title_th)")
        .order("created_at", { ascending: false })
        .limit(4)
    : Promise.resolve({ data: [], error: null });

  const upcomingMouPromise = canView(access, "mou")
    ? supabase.from("agreements")
        .select("end_date, title_th")
        .eq("status", "active")
        .not("end_date", "is", null)
        .order("end_date", { ascending: true })
        .limit(4)
    : Promise.resolve({ data: [], error: null });

  const [
    agreements, mobility, travel, contacts,
    expiringMou, draftMou, recentEvents, upcomingMou
  ] = await Promise.all([
    agreementsPromise, mobilityPromise, travelPromise, contactsPromise,
    expiringMouPromise, draftMouPromise, recentEventsPromise, upcomingMouPromise
  ]);

  const firstError = [
    agreements.error, mobility.error, travel.error, contacts.error,
    expiringMou.error, draftMou.error, recentEvents.error, upcomingMou.error
  ].find(Boolean);

  if (firstError) {
    throw new Error(`Unable to read dashboard summary: ${firstError.message}`);
  }

  const priorityItems: DashboardSnapshot["priorityItems"] = [];
  if (expiringMou.count && expiringMou.count > 0) {
    priorityItems.push({
      title: "MOU ใกล้หมดอายุ",
      description: "ความร่วมมือที่จะหมดอายุ",
      count: expiringMou.count,
      status: "เร่งด่วน",
      tone: "critical",
      iconName: "FileClock",
    });
  }
  if (draftMou.count && draftMou.count > 0) {
    priorityItems.push({
      title: "แบบร่างรอตรวจ",
      description: "เอกสาร MOU และข้อตกลงที่รอตรวจสอบ",
      count: draftMou.count,
      status: "รอดำเนินการ",
      tone: "warning",
      iconName: "FilePenLine",
    });
  }

  const recentActivities = ((recentEvents.data || []) as WorkflowEventRow[]).map((event) => {
    const date = new Date(event.created_at);
    return {
      id: event.id,
      time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
      title: event.action === "submit_for_review" ? "ส่งแบบร่าง MOU ให้ตรวจสอบ" : "อัปเดตสถานะ MOU",
      detail: event.agreements[0]?.title_th || "MOU",
      module: "ความร่วมมือและ MOU",
      iconName: "Handshake",
    };
  });

  const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const upcomingItems = ((upcomingMou.data || []) as UpcomingAgreementRow[]).map((mou) => {
    const date = new Date(mou.end_date);
    return {
      day: date.getDate().toString().padStart(2, '0'),
      month: thaiMonths[date.getMonth()],
      time: "09:00",
      title: mou.title_th || "MOU ใกล้หมดอายุ",
      module: "ความร่วมมือและ MOU",
    };
  });

  return {
    agreements: agreements.count ?? 0,
    mobility: mobility.count ?? 0,
    officialTravel: travel.count ?? 0,
    partnerContacts: contacts.count ?? 0,
    connected: true,
    priorityItems,
    recentActivities,
    upcomingItems,
  };
}
