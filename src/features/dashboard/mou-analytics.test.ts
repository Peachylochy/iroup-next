import { describe, expect, it } from "vitest";

import { buildMouAnalytics, type MouAnalyticsSource } from "./mou-analytics";

const baseAgreement: MouAnalyticsSource = {
  id: "mou-1",
  title_th: "ความร่วมมือทดสอบ",
  title_en: null,
  status: "active",
  workflow_status: "active",
  end_date: "2026-08-15",
  agreement_partners: [{
    is_lead: true,
    partner_name_th_snapshot: "มหาวิทยาลัยทดสอบ",
    partner_name_en_snapshot: null,
    country_name_th_snapshot: "ญี่ปุ่น",
    country_name_en_snapshot: null,
  }],
  agreement_units: [{
    is_owner: true,
    organization_units: { name_th: "กองบริการการศึกษา", name_en: null },
  }],
};

describe("buildMouAnalytics", () => {
  it("derives the 90-day renewal queue without treating no-end-date MOU as expired", () => {
    const analytics = buildMouAnalytics(
      [
        baseAgreement,
        { ...baseAgreement, id: "mou-2", end_date: null },
        { ...baseAgreement, id: "mou-3", status: "expired", end_date: "2026-07-01" },
        { ...baseAgreement, id: "mou-4", workflow_status: "under_review", end_date: "2026-12-01" },
      ],
      new Date("2026-07-28T12:00:00.000Z"),
    );

    expect(analytics).toMatchObject({
      total: 4,
      active: 3,
      expiring: 1,
      expired: 1,
      underReview: 1,
    });
    expect(analytics.renewals[0]).toMatchObject({ id: "mou-1", daysRemaining: 18 });
    expect(analytics.ownerUnits).toEqual([{ name: "กองบริการการศึกษา", count: 4 }]);
  });
});
