import type { ModuleKey } from "@/lib/auth/access";

export type ContentModule = "scholarship" | "events" | "news" | "knowledge";

export const contentModules: Record<ContentModule, {
  module: ModuleKey;
  table: "scholarships" | "events" | "news_articles" | "knowledge_items";
  route: string;
  title: string;
  itemLabel: string;
  description: string;
}> = {
  scholarship: {
    module: "scholarship",
    table: "scholarships",
    route: "/scholarships",
    title: "ทุนการศึกษา",
    itemLabel: "ทุน",
    description: "จัดการประกาศทุน กลุ่มเป้าหมาย ช่วงรับสมัคร และลิงก์สมัคร",
  },
  events: {
    module: "events",
    table: "events",
    route: "/events",
    title: "กิจกรรม",
    itemLabel: "กิจกรรม",
    description: "จัดการกิจกรรม กำหนดการ สถานที่ และข้อมูลลงทะเบียน",
  },
  news: {
    module: "news",
    table: "news_articles",
    route: "/news",
    title: "ข่าวประชาสัมพันธ์",
    itemLabel: "ข่าว",
    description: "จัดทำข่าวภายในและรายการที่เลือกเผยแพร่บน Public Portal",
  },
  knowledge: {
    module: "knowledge",
    table: "knowledge_items",
    route: "/knowledge",
    title: "คลังความรู้",
    itemLabel: "รายการความรู้",
    description: "รวบรวมคู่มือ บทความ เอกสารอ้างอิง และลิงก์ความรู้",
  },
};

export function isContentModule(value: string): value is ContentModule {
  return value in contentModules;
}
