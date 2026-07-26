import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  ContactRound,
  FileClock,
  FilePenLine,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  Plane,
  Settings,
  UsersRound,
} from "lucide-react";

export const navigationGroups = [
  {
    label: "ภาพรวม",
    href: "#main",
    icon: LayoutDashboard,
    active: true,
  },
  {
    label: "ความร่วมมือและ MOU",
    href: "#module-overview",
    icon: Handshake,
    children: [
      {
        label: "องค์กรคู่ความร่วมมือ",
        href: "#module-overview",
        icon: UsersRound,
      },
      {
        label: "ผู้ติดต่อองค์กรต่างประเทศ",
        href: "#module-overview",
        icon: ContactRound,
        internal: true,
      },
    ],
  },
  {
    label: "การเดินทางและ Mobility",
    href: "#priority-work",
    icon: Plane,
    children: [
      {
        label: "Mobility นิสิต",
        href: "#module-overview",
        icon: GraduationCap,
      },
      {
        label: "Mobility บุคลากร",
        href: "#module-overview",
        icon: UsersRound,
      },
      {
        label: "เดินทางไปปฏิบัติงาน",
        href: "#module-overview",
        icon: BriefcaseBusiness,
      },
    ],
  },
  {
    label: "ทุนการศึกษา",
    href: "#activity",
    icon: GraduationCap,
  },
  { label: "กิจกรรม", href: "#activity", icon: CalendarDays },
  { label: "ข่าวประชาสัมพันธ์", href: "#activity", icon: Megaphone },
  { label: "คลังความรู้", href: "#activity", icon: BookOpenText },
  { label: "รายงาน", href: "#module-overview", icon: MapPinned },
  { label: "ตั้งค่าระบบ", href: "#main", icon: Settings },
] as const;

export const priorityItems = [
  {
    title: "MOU ใกล้หมดอายุ",
    description: "ความร่วมมือที่จะหมดอายุภายใน 90 วัน",
    count: 8,
    status: "เร่งด่วน",
    due: "30 มิ.ย. 2569",
    tone: "critical",
    icon: FileClock,
  },
  {
    title: "แบบร่างรอตรวจ",
    description: "เอกสาร MOU และข้อตกลงที่รอตรวจสอบ",
    count: 5,
    status: "รอดำเนินการ",
    due: "15 มิ.ย. 2569",
    tone: "warning",
    icon: FilePenLine,
  },
  {
    title: "การเดินทางรอเอกสาร",
    description: "รายการที่เอกสารประกอบยังไม่ครบถ้วน",
    count: 7,
    status: "รอดำเนินการ",
    due: "20 มิ.ย. 2569",
    tone: "warning",
    icon: Plane,
  },
  {
    title: "ผู้ติดต่อที่ควรติดตาม",
    description: "ผู้ติดต่อที่ไม่ได้ติดต่อเกิน 180 วัน",
    count: 12,
    status: "ควรดำเนินการ",
    due: "30 มิ.ย. 2569",
    tone: "attention",
    icon: ContactRound,
  },
] as const;

export const moduleSummaries = [
  {
    label: "ความร่วมมือและ MOU",
    value: 124,
    unit: "ฉบับ",
    detail: "ใช้งานอยู่ 78 · ใกล้หมดอายุ 18",
    icon: Handshake,
  },
  {
    label: "Mobility",
    value: 156,
    unit: "รายการ",
    detail: "กำลังดำเนินการ 68 · เสร็จสิ้นแล้ว 88",
    icon: GraduationCap,
  },
  {
    label: "เดินทางไปปฏิบัติงาน",
    value: 64,
    unit: "รายการ",
    detail: "รอดำเนินการ 21 · เสร็จสิ้นแล้ว 43",
    icon: Plane,
  },
  {
    label: "ผู้ติดต่อองค์กรต่างประเทศ",
    value: 58,
    unit: "ราย",
    detail: "18 ประเทศ · ข้อมูลภายในเท่านั้น",
    icon: ContactRound,
    internal: true,
  },
] as const;

export const recentActivities = [
  {
    time: "10:42",
    title: "อัปเดตสถานะ MOU",
    detail: "เปลี่ยนสถานะเป็น “ใช้งานอยู่”",
    module: "ความร่วมมือและ MOU",
    icon: Handshake,
  },
  {
    time: "09:15",
    title: "สร้างรายการเดินทางไปปฏิบัติงาน",
    detail: "ประเมินเอกสาร ณ ประเทศญี่ปุ่น",
    module: "เดินทางไปปฏิบัติงาน",
    icon: Plane,
  },
  {
    time: "เมื่อวาน 16:30",
    title: "ส่งแบบร่าง MOU ให้ตรวจสอบ",
    detail: "Memorandum of Understanding",
    module: "ความร่วมมือและ MOU",
    icon: FilePenLine,
  },
  {
    time: "เมื่อวาน 11:08",
    title: "เพิ่มผู้ติดต่อองค์กรต่างประเทศ",
    detail: "บันทึกไว้ในฐานข้อมูลภายใน",
    module: "ผู้ติดต่อองค์กรต่างประเทศ",
    icon: ContactRound,
    internal: true,
  },
] as const;

export const upcomingItems = [
  {
    day: "31",
    month: "พ.ค.",
    time: "09:00",
    title: "กำหนดส่งแบบร่าง MOU",
    module: "ความร่วมมือและ MOU",
  },
  {
    day: "05",
    month: "มิ.ย.",
    time: "13:30",
    title: "กำหนดส่งเอกสารประกอบการเดินทาง",
    module: "เดินทางไปปฏิบัติงาน",
  },
  {
    day: "10",
    month: "มิ.ย.",
    time: "10:00",
    title: "กำหนดส่งรายงานผลการเดินทาง",
    module: "เดินทางไปปฏิบัติงาน",
  },
  {
    day: "15",
    month: "มิ.ย.",
    time: "16:00",
    title: "กำหนดอัปเดตข้อมูลผู้ติดต่อ",
    module: "ผู้ติดต่อองค์กรต่างประเทศ",
    internal: true,
  },
] as const;

export const quickCreateItems = [
  { label: "เพิ่ม MOU", icon: Handshake },
  { label: "เพิ่ม Mobility", icon: GraduationCap },
  { label: "เพิ่มการเดินทาง", icon: Plane },
  { label: "เพิ่มผู้ติดต่อ", icon: ContactRound, internal: true },
] as const;
