import type {
  AppRole,
  ModuleKey,
  ModulePermission,
  PermissionAction,
} from "@/lib/auth/access";

export const managedModuleKeys = [
  "mou",
  "mobility",
  "travel",
  "scholarship",
  "events",
  "news",
  "knowledge",
  "reports",
  "settings",
] as const satisfies readonly ModuleKey[];

export type ManagedUser = {
  id: string;
  email: string;
  display_name: string;
  active: boolean;
  created_at: string;
  role: AppRole | null;
  modules: Record<ModuleKey, ModulePermission>;
};

export type UserDirectory = {
  users: ManagedUser[];
};

export const roleOptions: Array<{
  value: AppRole | "";
  label: string;
  description: string;
}> = [
  {
    value: "",
    label: "ยังไม่กำหนดสิทธิ์",
    description: "เข้าสู่ระบบได้ แต่ยังเข้าใช้งานพื้นที่ภายในไม่ได้",
  },
  {
    value: "viewer",
    label: "ผู้ดูข้อมูล",
    description: "ดูเฉพาะโมดูลที่ได้รับมอบหมาย",
  },
  {
    value: "editor",
    label: "เจ้าหน้าที่ผู้แก้ไขข้อมูล",
    description: "ทำงานตามโมดูลและการดำเนินการที่ได้รับมอบหมาย",
  },
  {
    value: "office_admin",
    label: "ผู้ดูแลสำนักงาน",
    description: "ดูแลข้อมูลและการดำเนินงานทุกโมดูล",
  },
  {
    value: "system_admin",
    label: "ผู้ดูแลระบบ",
    description: "สิทธิ์สูงสุด รวมถึงผู้ใช้และการตั้งค่าระบบ",
  },
];

export const moduleLabels: Record<ModuleKey, string> = {
  mou: "ความร่วมมือและ MOU",
  mobility: "Mobility",
  travel: "เดินทางไปปฏิบัติงาน",
  scholarship: "ทุนการศึกษา",
  events: "กิจกรรม",
  news: "ข่าวประชาสัมพันธ์",
  knowledge: "คลังความรู้",
  reports: "รายงาน",
  settings: "ตั้งค่าระบบ",
};

export const permissionActions: Array<{
  key: PermissionAction;
  label: string;
}> = [
  { key: "view", label: "ดู" },
  { key: "create", label: "เพิ่ม" },
  { key: "update", label: "แก้ไข" },
  { key: "publish", label: "เผยแพร่" },
  { key: "delete", label: "ลบ" },
  { key: "import", label: "นำเข้า" },
];

export function getRoleLabel(role: AppRole | null) {
  return (
    roleOptions.find((option) => option.value === (role ?? ""))?.label ??
    "ยังไม่กำหนดสิทธิ์"
  );
}
