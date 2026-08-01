import type { ModuleKey } from "@/lib/auth/access";

export type StaffMovementModule = "staff-mobility" | "travel";
export type StaffMovementCategory = "staff_mobility" | "staff_official_travel";

export const staffMovementModules: Record<
  StaffMovementModule,
  {
    category: StaffMovementCategory;
    permission: ModuleKey;
    route: string;
    title: string;
    itemLabel: string;
    description: string;
  }
> = {
  "staff-mobility": {
    category: "staff_mobility",
    permission: "mobility",
    route: "/staff-mobility",
    title: "Mobility บุคลากร",
    itemLabel: "Mobility บุคลากร",
    description:
      "จัดการโครงการแลกเปลี่ยน อบรม วิจัย และกิจกรรม Mobility ของบุคลากร",
  },
  travel: {
    category: "staff_official_travel",
    permission: "travel",
    route: "/travel",
    title: "เดินทางไปปฏิบัติงาน",
    itemLabel: "การเดินทาง",
    description:
      "จัดการคำสั่งและประวัติการเดินทางไปประชุม อบรม ปฏิบัติงาน และราชการของบุคลากร",
  },
};
