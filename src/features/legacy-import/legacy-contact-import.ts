import ExcelJS from "exceljs";

type PartnerReference = {
  id: string;
  name_th: string | null;
  name_en: string | null;
};

type ExistingContact = {
  partner_organization_id: string;
  full_name: string;
};

export type LegacyContactPreviewRow = {
  rowNumber: number;
  sourceKey: string;
  status: "valid" | "warning" | "invalid";
  changeAction: "insert" | "update";
  label: string;
  organizationName: string;
  messages: string[];
  sourceData: Record<string, string | number | null>;
  normalizedData: {
    partnerOrganizationId: string | null;
    fullName: string;
    positionTitle: string;
    department: string;
    expertiseAreas: string[];
    relationshipLevel: "unrated" | "low" | "medium" | "high";
    preferredLanguage: string;
    internalNote: string;
    lastContactedOn: string;
    contactMethods: Array<{ method_type: "email" | "phone"; value: string }>;
  };
};

export type LegacyContactPreview = {
  sourceFile: string;
  total: number;
  valid: number;
  warning: number;
  invalid: number;
  inserts: number;
  updates: number;
  rows: LegacyContactPreviewRow[];
};

function normalizeName(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[.,()[\]{}'"’“”\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(row: ExcelJS.Row, column: number) {
  return row.getCell(column).text.trim();
}

function parseThaiDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  const year = Number(match[3]);
  const christianYear = year >= 2400 ? year - 543 : year;
  const month = Number(match[2]);
  const day = Number(match[1]);
  if (
    christianYear < 1900 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }
  return `${christianYear.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function relationshipLevel(value: string) {
  const normalized = value.trim().toLocaleLowerCase("th");
  if (normalized.includes("สูง") || normalized === "high") return "high" as const;
  if (normalized.includes("กลาง") || normalized === "medium") return "medium" as const;
  if (normalized.includes("ต่ำ") || normalized === "low") return "low" as const;
  return "unrated" as const;
}

function methods(email: string, phone: string) {
  const result: Array<{ method_type: "email" | "phone"; value: string }> = [];
  if (email.trim()) result.push({ method_type: "email", value: email.trim() });
  if (phone.trim()) result.push({ method_type: "phone", value: phone.trim() });
  return result;
}

export async function previewLegacyContactImport(
  file: File,
  partners: PartnerReference[],
  existingContacts: ExistingContact[],
): Promise<LegacyContactPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet =
    workbook.worksheets.find((item) => item.name.includes("Contact")) ||
    workbook.worksheets[0];
  if (!sheet) throw new Error("ไม่พบ worksheet รายชื่อ Contact");

  const partnerByName = new Map<string, PartnerReference>();
  for (const partner of partners) {
    for (const name of [partner.name_th, partner.name_en]) {
      const key = normalizeName(name);
      if (key && !partnerByName.has(key)) partnerByName.set(key, partner);
    }
  }
  const existing = new Set(
    existingContacts.map(
      (item) =>
        `${item.partner_organization_id}:${normalizeName(item.full_name)}`,
    ),
  );

  const rows: LegacyContactPreviewRow[] = [];
  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const fullName = cellText(row, 2);
    const organizationName = cellText(row, 4);
    if (!fullName && !organizationName) continue;

    const positionTitle = cellText(row, 3);
    const country = cellText(row, 5);
    const continent = cellText(row, 6);
    const organizationType = cellText(row, 7);
    const expertise = cellText(row, 8);
    const email = cellText(row, 9);
    const phone = cellText(row, 10);
    const meetingOpportunity = cellText(row, 11);
    const rawLastContacted = cellText(row, 12);
    const rawRelationship = cellText(row, 13);
    const note = cellText(row, 14);
    const partner = partnerByName.get(normalizeName(organizationName));
    const messages: string[] = [];
    const warnings: string[] = [];
    if (!fullName) messages.push("ไม่พบชื่อผู้ติดต่อ");
    if (!organizationName) messages.push("ไม่พบชื่อองค์กร");
    if (!partner) messages.push("จับคู่องค์กรกับ Data Master ไม่ได้");
    if (!email && !phone) warnings.push("ไม่มีอีเมลหรือโทรศัพท์");
    const lastContactedOn = parseThaiDate(rawLastContacted);
    if (rawLastContacted && !lastContactedOn) warnings.push("รูปแบบวันที่ติดต่อล่าสุดไม่ถูกต้อง");
    const internalNote = [
      meetingOpportunity ? `พบในโอกาส/การเดินทาง: ${meetingOpportunity}` : "",
      note,
      country ? `ประเทศจากไฟล์เดิม: ${country}` : "",
      continent ? `ทวีปจากไฟล์เดิม: ${continent}` : "",
      organizationType ? `ประเภทองค์กร: ${organizationType}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const key = partner
      ? `${partner.id}:${normalizeName(fullName)}`
      : `missing:${rowNumber}`;

    rows.push({
      rowNumber: rows.length + 1,
      sourceKey: String(cellText(row, 1) || rowNumber),
      status: messages.length ? "invalid" : warnings.length ? "warning" : "valid",
      changeAction: existing.has(key) ? "update" : "insert",
      label: fullName,
      organizationName,
      messages: [...messages, ...warnings],
      sourceData: {
        sequence: cellText(row, 1),
        full_name: fullName,
        position_title: positionTitle,
        organization_name: organizationName,
        country,
        continent,
        organization_type: organizationType,
        expertise,
        email,
        phone,
        meeting_opportunity: meetingOpportunity,
        last_contacted_on: rawLastContacted,
        relationship_level: rawRelationship,
        note,
      },
      normalizedData: {
        partnerOrganizationId: partner?.id || null,
        fullName,
        positionTitle,
        department: "",
        expertiseAreas: expertise
          .split(/[,;、\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
        relationshipLevel: relationshipLevel(rawRelationship),
        preferredLanguage: "",
        internalNote,
        lastContactedOn,
        contactMethods: methods(email, phone),
      },
    });
  }

  return {
    sourceFile: file.name,
    total: rows.length,
    valid: rows.filter((row) => row.status === "valid").length,
    warning: rows.filter((row) => row.status === "warning").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    inserts: rows.filter((row) => row.changeAction === "insert").length,
    updates: rows.filter((row) => row.changeAction === "update").length,
    rows,
  };
}
