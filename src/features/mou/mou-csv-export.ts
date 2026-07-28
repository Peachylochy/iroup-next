import type { MouAgreement } from "./mou-query";

const continentNames: Record<string, string> = {
  AS: "เอเชีย (Asia)",
  EU: "ยุโรป (Europe)",
  NA: "อเมริกาเหนือ (North America)",
  SA: "อเมริกาใต้ (South America)",
  OC: "ออสเตรเลีย/โอเชียเนีย (Oceania)",
  AF: "แอฟริกา (Africa)",
  AN: "แอนตาร์กติกา (Antarctica)",
};

const statusLabels: Record<MouAgreement["status"], string> = {
  draft: "ร่าง",
  active: "ใช้งานอยู่",
  expiring: "ใกล้หมดอายุ",
  expired: "หมดอายุ",
  terminated: "ยุติแล้ว",
};

const workflowLabels: Record<string, string> = {
  draft: "ร่างระบบ",
  under_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  active: "มีผลบังคับใช้",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  archived: "เก็บเข้าคลัง",
};

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("th-TH");
  } catch {
    return dateStr;
  }
}

export function exportMouToCsv(agreements: MouAgreement[], filenamePrefix = "mou_export") {
  const headers = [
    "เลขที่ข้อตกลง",
    "ชื่อภาษาไทย",
    "ชื่อภาษาอังกฤษ",
    "ประเภทข้อตกลง",
    "องค์กรคู่ความร่วมมือหลัก",
    "ประเทศ",
    "ทวีป",
    "คณะ/หน่วยงาน มพ. เจ้าของหลัก",
    "ปีงบประมาณไทย",
    "วันเริ่มบังคับใช้",
    "วันสิ้นสุดบังคับใช้",
    "สถานะข้อตกลง",
    "สถานะการตรวจสอบ",
  ];

  const rows = agreements.map((item) => {
    const leadPartner =
      item.agreement_partners.find((p) => p.is_lead) || item.agreement_partners[0];
    const org = leadPartner?.partner_organizations;
    const partnerName =
      leadPartner?.partner_name_en_snapshot ||
      org?.name_en ||
      leadPartner?.partner_name_th_snapshot ||
      org?.name_th ||
      "";
    const countryName =
      leadPartner?.country_name_th_snapshot || org?.countries?.name_th || "";
    const continentCode = org?.countries?.continent_code || "";
    const continentName = continentCode ? continentNames[continentCode] || continentCode : "";

    const ownerUnit =
      item.agreement_units.find((u) => u.is_owner) || item.agreement_units[0];
    const unitName = ownerUnit?.organization_units?.name_th || "";

    return [
      escapeCsvField(item.agreement_number),
      escapeCsvField(item.title_th),
      escapeCsvField(item.title_en),
      escapeCsvField(item.agreement_type || "MOU"),
      escapeCsvField(partnerName),
      escapeCsvField(countryName),
      escapeCsvField(continentName),
      escapeCsvField(unitName),
      escapeCsvField(item.fiscal_year ? `ปีงบประมาณ ${item.fiscal_year}` : ""),
      escapeCsvField(formatDate(item.start_date)),
      escapeCsvField(item.end_date ? formatDate(item.end_date) : "ไม่มีวันหมดอายุ"),
      escapeCsvField(statusLabels[item.status] || item.status),
      escapeCsvField(workflowLabels[item.workflow_status] || item.workflow_status),
    ].join(",");
  });

  // Attach UTF-8 BOM for Microsoft Excel compatibility
  const csvContent = "\uFEFF" + [headers.map(escapeCsvField).join(","), ...rows].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `${filenamePrefix}_${dateSuffix}.csv`;

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
