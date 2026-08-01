import ExcelJS from "exceljs";

const LEGACY_PUBLIC_API =
  "https://script.google.com/macros/s/AKfycbx84FaCV07b_uiuBDYK-bjbD422BrwRI3OF7kC1BnviBc5SqGOyADK03KTLkDXn678-/exec";

type LegacyTravelDto = {
  travel_id: string;
  project_name: string;
  purpose: string;
  country: {
    iso2: string;
    country_name_th: string;
    country_name_en: string;
  };
  city: string;
  start_date: string;
  end_date: string;
  fiscal_year: number;
  status: string;
  participant_count: number;
};

type CountryReference = {
  id: string;
  iso2: string;
  name_th: string;
  name_en: string;
};

type PersonReference = {
  id: string;
  person_type: "student" | "staff";
  source_identifier: string | null;
  first_name_th: string | null;
  last_name_th: string | null;
  full_name_th: string | null;
  organization_unit_id: string | null;
  program_or_position: string | null;
};

type TravelReportParticipant = {
  fullName: string;
  projectName: string;
  purpose: string;
  endDate: string;
  countryName: string;
};

export type LegacyTravelPreviewRow = {
  rowNumber: number;
  sourceKey: string;
  status: "valid" | "warning" | "invalid";
  changeAction: "insert" | "update";
  label: string;
  messages: string[];
  sourceData: LegacyTravelDto;
  normalizedData: {
    legacyId: string;
    projectName: string;
    purpose: string;
    countryId: string | null;
    countryNameSnapshot: string;
    city: string;
    ownerUnitId: string | null;
    startDate: string;
    endDate: string;
    fiscalYear: number;
    sourceStatus: string;
    participantCount: number;
    participants: Array<{
      personId: string | null;
      personSource: "student" | "staff";
      fullNameSnapshot: string;
      organizationUnitIdSnapshot: string | null;
      positionSnapshot: string;
    }>;
  };
};

export type LegacyTravelPreview = {
  sourceFile: string;
  total: number;
  valid: number;
  warning: number;
  invalid: number;
  inserts: number;
  updates: number;
  participants: number;
  linkedParticipants: number;
  rows: LegacyTravelPreviewRow[];
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[.,()[\]{}'"’“”\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excelDate(value: ExcelJS.CellValue) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text =
    typeof value === "object" && value && "text" in value
      ? String(value.text)
      : String(value || "").trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return text;
  const year = Number(match[3]);
  const christianYear = year >= 2400 ? year - 543 : year;
  return `${christianYear.toString().padStart(4, "0")}-${match[2].padStart(
    2,
    "0",
  )}-${match[1].padStart(2, "0")}`;
}

async function fetchLegacyTravelData() {
  const response = await fetch(
    `${LEGACY_PUBLIC_API}?action=v2.public.travel.list`,
    { cache: "no-store", signal: AbortSignal.timeout(60_000) },
  );
  if (!response.ok) throw new Error(`ระบบเดิมตอบกลับ HTTP ${response.status}`);
  const body = (await response.json()) as {
    success: boolean;
    data: LegacyTravelDto[];
    error?: string;
  };
  if (!body.success || !Array.isArray(body.data)) {
    throw new Error(body.error || "อ่านข้อมูลการเดินทางจากระบบเดิมไม่สำเร็จ");
  }
  return body.data;
}

async function readTravelReport(file: File) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet("Sheet") || workbook.worksheets[0];
  if (!sheet) throw new Error("ไม่พบ worksheet รายงานการเดินทาง");
  const participants: TravelReportParticipant[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const fullName = row.getCell(2).text.trim();
    const projectName = row.getCell(3).text.trim();
    if (!fullName && !projectName) continue;
    participants.push({
      fullName,
      projectName,
      purpose: row.getCell(4).text.trim(),
      endDate: excelDate(row.getCell(5).value),
      countryName: row.getCell(6).text.trim(),
    });
  }
  return participants;
}

export async function previewLegacyTravelImport(
  file: File,
  countries: CountryReference[],
  people: PersonReference[],
  existingLegacyIds: Set<string>,
): Promise<LegacyTravelPreview> {
  const [sourceRows, reportParticipants] = await Promise.all([
    fetchLegacyTravelData(),
    readTravelReport(file),
  ]);
  const countryByIso2 = new Map(
    countries.map((country) => [country.iso2.trim().toUpperCase(), country]),
  );
  const peopleByName = people
    .map((person) => ({
      person,
      key: normalize(`${person.first_name_th || ""} ${person.last_name_th || ""}`),
    }))
    .filter((item) => item.key);
  const matchPerson = (fullName: string) => {
    const key = normalize(fullName);
    return peopleByName.find((item) => key.endsWith(item.key))?.person;
  };
  const projectsByExactKey = new Map(
    sourceRows.map((item) => [
      `${normalize(item.project_name)}|${item.end_date}`,
      item,
    ]),
  );
  const projectsByName = new Map<string, LegacyTravelDto[]>();
  for (const item of sourceRows) {
    const key = normalize(item.project_name);
    projectsByName.set(key, [...(projectsByName.get(key) || []), item]);
  }
  const participantsByTravelId = new Map<string, TravelReportParticipant[]>();
  for (const participant of reportParticipants) {
    const exact = projectsByExactKey.get(
      `${normalize(participant.projectName)}|${participant.endDate}`,
    );
    const sameName = projectsByName.get(normalize(participant.projectName)) || [];
    const movement = exact || (sameName.length === 1 ? sameName[0] : undefined);
    if (!movement) continue;
    participantsByTravelId.set(movement.travel_id, [
      ...(participantsByTravelId.get(movement.travel_id) || []),
      participant,
    ]);
  }

  const rows = sourceRows.map((source, index): LegacyTravelPreviewRow => {
    const country = countryByIso2.get(source.country?.iso2?.toUpperCase());
    const reportRows = participantsByTravelId.get(source.travel_id) || [];
    const participants = reportRows.map((participant) => {
      const person = matchPerson(participant.fullName);
      return {
        personId: person?.id || null,
        personSource: person?.person_type || ("staff" as const),
        fullNameSnapshot: participant.fullName,
        organizationUnitIdSnapshot: person?.organization_unit_id || null,
        positionSnapshot: person?.program_or_position || "",
      };
    });
    const messages: string[] = [];
    const warnings: string[] = [];
    if (!source.travel_id) messages.push("ไม่พบรหัสการเดินทางเดิม");
    if (!source.project_name) messages.push("ไม่พบชื่อโครงการ");
    if (!country) messages.push("จับคู่ประเทศกับ Data Master ไม่ได้");
    if (!source.start_date || !source.end_date) messages.push("ช่วงวันเดินทางไม่ครบ");
    if (participants.length !== Number(source.participant_count || 0)) {
      messages.push(
        `จำนวนผู้เดินทางจากรายงาน ${participants.length} ไม่ตรงกับ API ${source.participant_count}`,
      );
    }
    const unlinked = participants.filter((participant) => !participant.personId).length;
    if (unlinked > 0) {
      warnings.push(`${unlinked} คนไม่พบใน Data Master จึงเก็บชื่อ snapshot`);
    }
    const unitIds = [
      ...new Set(
        participants.flatMap((participant) =>
          participant.organizationUnitIdSnapshot
            ? [participant.organizationUnitIdSnapshot]
            : [],
        ),
      ),
    ];

    return {
      rowNumber: index + 1,
      sourceKey: source.travel_id,
      status: messages.length ? "invalid" : warnings.length ? "warning" : "valid",
      changeAction: existingLegacyIds.has(source.travel_id) ? "update" : "insert",
      label: source.project_name,
      messages: [...messages, ...warnings],
      sourceData: source,
      normalizedData: {
        legacyId: source.travel_id,
        projectName: source.project_name,
        purpose: source.purpose || "",
        countryId: country?.id || null,
        countryNameSnapshot:
          source.country?.country_name_th || country?.name_th || "",
        city: source.city || "",
        ownerUnitId: unitIds.length === 1 ? unitIds[0] : null,
        startDate: source.start_date || "",
        endDate: source.end_date || "",
        fiscalYear: Number(source.fiscal_year) || 0,
        sourceStatus: source.status || "completed",
        participantCount: Number(source.participant_count) || participants.length,
        participants,
      },
    };
  });

  const allParticipants = rows.flatMap((row) => row.normalizedData.participants);
  return {
    sourceFile: file.name,
    total: rows.length,
    valid: rows.filter((row) => row.status === "valid").length,
    warning: rows.filter((row) => row.status === "warning").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    inserts: rows.filter((row) => row.changeAction === "insert").length,
    updates: rows.filter((row) => row.changeAction === "update").length,
    participants: allParticipants.length,
    linkedParticipants: allParticipants.filter((participant) => participant.personId)
      .length,
    rows,
  };
}
