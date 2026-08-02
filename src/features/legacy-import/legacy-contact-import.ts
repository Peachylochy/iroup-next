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

type ContactMethod = {
  method_type: "email" | "phone";
  value: string;
};

type NormalizedContactData = {
  partnerOrganizationId: string | null;
  fullName: string;
  positionTitle: string;
  department: string;
  expertiseAreas: string[];
  relationshipLevel: "unrated" | "low" | "medium" | "high";
  preferredLanguage: string;
  internalNote: string;
  lastContactedOn: string;
  contactMethods: ContactMethod[];
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
  normalizedData: NormalizedContactData;
};

export type LegacyContactPreview = {
  sourceFile: string;
  total: number;
  valid: number;
  warning: number;
  invalid: number;
  inserts: number;
  updates: number;
  duplicateRows: number;
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
  const result: ContactMethod[] = [];
  if (email.trim()) result.push({ method_type: "email", value: email.trim() });
  if (phone.trim()) result.push({ method_type: "phone", value: phone.trim() });
  return result;
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim();
    if (!normalized) return false;
    const key = normalizeName(normalized);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeContactMethods(groups: ContactMethod[][]) {
  const seen = new Set<string>();
  const result: ContactMethod[] = [];
  for (const method of groups.flat()) {
    const value = method.value.trim();
    const key = `${method.method_type}:${value.toLocaleLowerCase("en")}`;
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push({ method_type: method.method_type, value });
  }
  return result;
}

function mergeTextBlocks(values: string[]) {
  return uniqueStrings(values.flatMap((value) => value.split("\n"))).join("\n");
}

function mergeDuplicateContactRows(rows: LegacyContactPreviewRow[]) {
  const groups = new Map<string, LegacyContactPreviewRow[]>();
  for (const row of rows) {
    const partnerId = row.normalizedData.partnerOrganizationId;
    const nameKey = normalizeName(row.normalizedData.fullName);
    const key = partnerId && nameKey ? `${partnerId}:${nameKey}` : `source:${row.sourceKey}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  let duplicateRows = 0;
  const mergedRows = [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    duplicateRows += group.length - 1;
    const first = group[0];
    const mergedMethods = mergeContactMethods(
      group.map((row) => row.normalizedData.contactMethods),
    );
    const mergedNotes = mergeTextBlocks(
      group.map((row) => row.normalizedData.internalNote),
    );
    const mergedExpertise = uniqueStrings(
      group.flatMap((row) => row.normalizedData.expertiseAreas),
    );
    const lastContactedOn = group
      .map((row) => row.normalizedData.lastContactedOn)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
    const relationshipLevel =
      group.find((row) => row.normalizedData.relationshipLevel === "high")?.normalizedData
        .relationshipLevel ||
      group.find((row) => row.normalizedData.relationshipLevel === "medium")?.normalizedData
        .relationshipLevel ||
      group.find((row) => row.normalizedData.relationshipLevel === "low")?.normalizedData
        .relationshipLevel ||
      "unrated";
    const sourceRows = group.map((row) => row.sourceKey).join(", ");
    const emailValues = mergedMethods
      .filter((method) => method.method_type === "email")
      .map((method) => method.value);
    const phoneValues = mergedMethods
      .filter((method) => method.method_type === "phone")
      .map((method) => method.value);

    return {
      ...first,
      sourceKey: sourceRows,
      messages: uniqueStrings(group.flatMap((row) => row.messages)),
      sourceData: {
        ...first.sourceData,
        email: emailValues.join("; "),
        phone: phoneValues.join("; "),
        note: mergeTextBlocks(group.map((row) => String(row.sourceData.note || ""))),
        source_rows: sourceRows,
      },
      normalizedData: {
        ...first.normalizedData,
        positionTitle:
          group.map((row) => row.normalizedData.positionTitle).find(Boolean) || "",
        department: group.map((row) => row.normalizedData.department).find(Boolean) || "",
        expertiseAreas: mergedExpertise,
        relationshipLevel,
        preferredLanguage:
          group.map((row) => row.normalizedData.preferredLanguage).find(Boolean) || "",
        internalNote: mergedNotes,
        lastContactedOn,
        contactMethods: mergedMethods,
      },
    };
  });

  return { rows: mergedRows, duplicateRows };
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

  const merged = mergeDuplicateContactRows(rows);
  const normalizedRows = merged.rows.map((row, index) => ({
    ...row,
    rowNumber: index + 1,
  }));

  return {
    sourceFile: file.name,
    total: normalizedRows.length,
    valid: normalizedRows.filter((row) => row.status === "valid").length,
    warning: normalizedRows.filter((row) => row.status === "warning").length,
    invalid: normalizedRows.filter((row) => row.status === "invalid").length,
    inserts: normalizedRows.filter((row) => row.changeAction === "insert").length,
    updates: normalizedRows.filter((row) => row.changeAction === "update").length,
    duplicateRows: merged.duplicateRows,
    rows: normalizedRows,
  };
}
