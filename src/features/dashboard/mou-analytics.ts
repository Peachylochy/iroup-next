export type MouAnalyticsSource = {
  id: string;
  title_th: string;
  title_en: string | null;
  status: "draft" | "active" | "expiring" | "expired" | "terminated";
  workflow_status:
    | "draft"
    | "under_review"
    | "approved"
    | "active"
    | "completed"
    | "cancelled"
    | "archived";
  end_date: string | null;
  agreement_partners: Array<{
    is_lead: boolean;
    partner_name_th_snapshot: string | null;
    partner_name_en_snapshot: string | null;
    country_name_th_snapshot: string | null;
    country_name_en_snapshot: string | null;
  }>;
  agreement_units: Array<{
    is_owner: boolean;
    organization_units: { name_th: string; name_en: string | null } | null;
  }>;
};

export type MouAnalytics = {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  underReview: number;
  renewals: Array<{
    id: string;
    title: string;
    partner: string;
    endDate: string;
    daysRemaining: number;
  }>;
  ownerUnits: Array<{ name: string; count: number }>;
  countries: Array<{ name: string; count: number }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dateAtUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function leadPartner(agreement: MouAnalyticsSource) {
  return agreement.agreement_partners.find((item) => item.is_lead) ?? agreement.agreement_partners[0];
}

function partnerName(agreement: MouAnalyticsSource) {
  const partner = leadPartner(agreement);
  return partner?.partner_name_th_snapshot || partner?.partner_name_en_snapshot || "ยังไม่ระบุองค์กรคู่ความร่วมมือ";
}

function countryName(agreement: MouAnalyticsSource) {
  const partner = leadPartner(agreement);
  return partner?.country_name_th_snapshot || partner?.country_name_en_snapshot || "ไม่ระบุประเทศ";
}

function ownerUnitName(agreement: MouAnalyticsSource) {
  const unit = agreement.agreement_units.find((item) => item.is_owner)?.organization_units ?? agreement.agreement_units[0]?.organization_units;
  return unit?.name_th || unit?.name_en || "ไม่ระบุหน่วยงาน";
}

function rankedCounts(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .toSorted((left, right) => right.count - left.count || left.name.localeCompare(right.name, "th"))
    .slice(0, 5);
}

export function buildMouAnalytics(
  agreements: MouAnalyticsSource[],
  today = new Date(),
): MouAnalytics {
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const renewalLimit = todayUtc + 90 * DAY_MS;
  const renewalItems = agreements
    .flatMap((agreement) => {
      if (agreement.status !== "active" || !agreement.end_date) return [];
      const endAt = dateAtUtc(agreement.end_date).getTime();
      if (endAt < todayUtc || endAt > renewalLimit) return [];
      return [{
        id: agreement.id,
        title: agreement.title_th || agreement.title_en || "ไม่ระบุชื่อ MOU",
        partner: partnerName(agreement),
        endDate: agreement.end_date,
        daysRemaining: Math.ceil((endAt - todayUtc) / DAY_MS),
      }];
    })
    .toSorted((left, right) => left.endDate.localeCompare(right.endDate));

  return {
    total: agreements.length,
    active: agreements.filter((agreement) => agreement.status === "active").length,
    expiring: renewalItems.length,
    expired: agreements.filter((agreement) => agreement.status === "expired").length,
    underReview: agreements.filter((agreement) => agreement.workflow_status === "under_review").length,
    renewals: renewalItems.slice(0, 5),
    ownerUnits: rankedCounts(agreements.map(ownerUnitName)),
    countries: rankedCounts(agreements.map(countryName)),
  };
}
