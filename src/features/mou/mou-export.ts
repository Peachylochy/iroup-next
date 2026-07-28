import type { MouAgreement } from "./mou-query";

type MouExportRow = {
  agreementNumber: string;
  title: string;
  agreementType: string;
  status: string;
  workflowStatus: string;
  fiscalYear: number | "";
  partner: string;
  country: string;
  continent: string;
  ownerUnit: string;
  signedDate: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
};

const statusLabels: Record<MouAgreement["status"], string> = {
  draft: "ร่าง",
  active: "ใช้งานอยู่",
  expiring: "ใกล้หมดอายุ",
  expired: "หมดอายุ",
  terminated: "ยุติแล้ว",
};

const workflowLabels: Record<MouAgreement["workflow_status"], string> = {
  draft: "ร่าง",
  under_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  active: "ใช้งานอยู่",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  archived: "เก็บถาวร",
};

function leadPartner(agreement: MouAgreement) {
  return (
    agreement.agreement_partners.find((partner) => partner.is_lead) ??
    agreement.agreement_partners[0]
  );
}

function ownerUnit(agreement: MouAgreement) {
  return (
    agreement.agreement_units.find((unit) => unit.is_owner)?.organization_units ??
    agreement.agreement_units[0]?.organization_units
  );
}

function toExportRows(agreements: MouAgreement[]): MouExportRow[] {
  return agreements.map((agreement) => {
    const partner = leadPartner(agreement);
    const organization = partner?.partner_organizations;
    const country = organization?.countries;
    const unit = ownerUnit(agreement);

    return {
      agreementNumber: agreement.agreement_number ?? "",
      title: agreement.title_th || agreement.title_en || "",
      agreementType: agreement.agreement_type ?? "",
      status: statusLabels[agreement.status],
      workflowStatus: workflowLabels[agreement.workflow_status],
      fiscalYear: agreement.fiscal_year ?? "",
      partner:
        partner?.partner_name_th_snapshot ??
        partner?.partner_name_en_snapshot ??
        organization?.name_th ??
        organization?.name_en ??
        "",
      country:
        partner?.country_name_th_snapshot ??
        partner?.country_name_en_snapshot ??
        country?.name_th ??
        country?.name_en ??
        "",
      continent: country?.continent_code ?? "",
      ownerUnit: unit?.name_th ?? unit?.name_en ?? "",
      signedDate: agreement.signed_date ?? "",
      startDate: agreement.start_date ?? "",
      endDate: agreement.end_date ?? "",
      updatedAt: agreement.updated_at,
    };
  });
}

const headings: Array<[keyof MouExportRow, string]> = [
  ["agreementNumber", "เลขที่ MOU"],
  ["title", "ชื่อข้อตกลง"],
  ["agreementType", "ประเภท"],
  ["status", "สถานะข้อตกลง"],
  ["workflowStatus", "สถานะงาน"],
  ["fiscalYear", "ปีงบประมาณ"],
  ["partner", "องค์กรคู่ความร่วมมือหลัก"],
  ["country", "ประเทศ"],
  ["continent", "ทวีป"],
  ["ownerUnit", "หน่วยงานเจ้าของ"],
  ["signedDate", "วันลงนาม"],
  ["startDate", "วันเริ่มมีผล"],
  ["endDate", "วันสิ้นสุด"],
  ["updatedAt", "แก้ไขล่าสุด (UTC)"],
];

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadMouCsv(agreements: MouAgreement[]) {
  const rows = toExportRows(agreements);
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const content = [
    headings.map(([, label]) => escape(label)).join(","),
    ...rows.map((row) => headings.map(([key]) => escape(row[key])).join(",")),
  ].join("\r\n");

  download(
    new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
    "iroup-mou-export.csv",
  );
}

export async function downloadMouXlsx(agreements: MouAgreement[]) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet("MOU");
  const rows = toExportRows(agreements);

  worksheet.addRow(headings.map(([, label]) => label));
  rows.forEach((row) => worksheet.addRow(headings.map(([key]) => row[key])));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: headings.length },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B21B6" } };
  worksheet.columns.forEach((column) => {
    column.width = Math.min(
      42,
      Math.max(14, ...(column.values ?? []).map((value) => String(value ?? "").length + 2)),
    );
  });

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "iroup-mou-export.xlsx",
  );
}
