import ExcelJS from "exceljs";

type Row = Record<string, string>;
type Lookup = {
  countries: Array<{ id: string; iso2: string; name_th: string; name_en: string }>;
  units: Array<{ id: string; code: string | null; name_th: string; name_en: string | null }>;
  partners: Array<{ id: string; legacy_id: string | null; name_th: string | null; name_en: string | null }>;
};

export type StudentMobilityImportReferenceOptions = Lookup;

export type StudentMobilityImportParticipant = {
  legacyParticipantId: string;
  sourceIdentifier: string;
  fullNameSnapshot: string;
  genderSnapshot: string;
  programOrPositionSnapshot: string;
  participantRole: string;
  sourceUnitId: string;
  organizationUnitIdSnapshot: string | null;
};

export type StudentMobilityNormalizedData = {
  legacyId: string;
  projectName: string;
  purpose: string;
  direction: "inbound" | "outbound" | "bilateral" | "not_applicable";
  countryId: string | null;
  countryNameSnapshot: string | null;
  city: string | null;
  partnerOrganizationId: string | null;
  partnerNameSnapshot: string | null;
  ownerUnitId: string | null;
  participantGroup: string | null;
  studyLevel: string | null;
  startDate: string | null;
  endDate: string | null;
  fiscalYear: number | null;
  sourceStatus: string;
  publicVisible: boolean;
  participants: StudentMobilityImportParticipant[];
};

export type StudentMobilityImportRow = {
  sourceRow: number;
  legacyProjectId: string;
  projectName: string;
  institutionName: string;
  startDate: string;
  endDate: string;
  studentParticipants: number;
  staffParticipants: number;
  sourceCountry: { id: string; name: string; iso2: string } | null;
  sourceUnit: { id: string; name: string; code: string } | null;
  needsCountryMapping: boolean;
  needsUnitMapping: boolean;
  needsPartnerMapping: boolean;
  suggestedCountryId: string | null;
  suggestedUnitId: string | null;
  suggestedPartnerId: string | null;
  result: "ready" | "warning" | "error";
  messages: string[];
  sourceData: Record<string, unknown>;
  normalizedData: StudentMobilityNormalizedData;
};

export type StudentMobilityImportPreview = {
  sourceFile: string;
  totalProjects: number;
  readyProjects: number;
  warningProjects: number;
  errorProjects: number;
  studentParticipants: number;
  excludedStaffParticipants: number;
  referenceOptions: StudentMobilityImportReferenceOptions;
  rows: StudentMobilityImportRow[];
};

const truthy = new Set(["1", "true", "yes"]);
const normalize = (value: string | null | undefined) => (value || "").trim().toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "");
const nullable = (value: string | undefined) => value?.trim() || null;

function isoDate(value: string | undefined) {
  if (!value?.trim()) return null;
  const direct = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (direct) return direct[0];
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

function direction(value: string): StudentMobilityNormalizedData["direction"] {
  return value === "inbound" || value === "outbound" || value === "bilateral" ? value : "not_applicable";
}

function rowsFromSheet(sheet: ExcelJS.Worksheet) {
  const headers = Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(1).getCell(index + 1).text.trim());
  const rows: Row[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const item: Row = { __row: String(number) };
    headers.forEach((header, index) => { item[header] = row.getCell(index + 1).text.trim(); });
    if (item[headers[0]]) rows.push(item);
  });
  return rows;
}

export async function previewStudentMobilityImport(file: File, lookup: Lookup): Promise<StudentMobilityImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await file.arrayBuffer()) as never);
  const projectSheet = workbook.getWorksheet("MOBILITY_PROJECT");
  const participantSheet = workbook.getWorksheet("MOBILITY_PARTICIPANT");
  const countrySheet = workbook.getWorksheet("COUNTRY_MASTER");
  const unitSheet = workbook.getWorksheet("UP_UNIT_MASTER");
  if (!projectSheet || !participantSheet || !countrySheet || !unitSheet) {
    throw new Error("ไฟล์นี้ต้องมีชีต MOBILITY_PROJECT, MOBILITY_PARTICIPANT, COUNTRY_MASTER และ UP_UNIT_MASTER");
  }

  const projects = rowsFromSheet(projectSheet).filter((row) => !truthy.has((row.is_deleted || "").toLowerCase()));
  const participants = rowsFromSheet(participantSheet).filter((row) => !truthy.has((row.is_deleted || "").toLowerCase()));
  const countries = new Map(rowsFromSheet(countrySheet).map((row) => [row.country_id, row]));
  const units = new Map(rowsFromSheet(unitSheet).map((row) => [row.unit_id, row]));
  const peopleByProject = new Map<string, Row[]>();
  for (const participant of participants) {
    const group = peopleByProject.get(participant.mobility_id) || [];
    group.push(participant); peopleByProject.set(participant.mobility_id, group);
  }

  const targetCountryByIso2 = new Map(lookup.countries.map((country) => [country.iso2.toUpperCase(), country]));
  const targetUnitByCode = new Map(lookup.units.flatMap((unit) => unit.code ? [[unit.code.toUpperCase(), unit] as const] : []));
  const targetPartnerByKey = new Map(lookup.partners.flatMap((partner) =>
    [partner.name_th, partner.name_en, partner.legacy_id]
      .map((value) => normalize(value))
      .filter(Boolean)
      .map((key) => [key, partner] as const),
  ));
  const rows = projects.map((project) => {
    const linked = peopleByProject.get(project.mobility_id) || [];
    const students = linked.filter((person) => person.participant_type === "student");
    const staff = linked.filter((person) => person.participant_type === "staff");
    const sourceCountry = countries.get(project.country_id);
    const sourceUnit = units.get(project.up_unit_id);
    const matchedCountry = sourceCountry?.iso2 ? targetCountryByIso2.get(sourceCountry.iso2.toUpperCase()) : undefined;
    const matchedUnit = sourceUnit?.unit_code ? targetUnitByCode.get(sourceUnit.unit_code.toUpperCase()) : undefined;
    const matchedPartner = targetPartnerByKey.get(normalize(project.institution_name));
    const messages: string[] = [];
    if (!project.project_name) messages.push("ไม่มีชื่อโครงการ");
    if (!project.start_date) messages.push("ไม่มีวันเริ่มเดินทาง");
    if (!students.length) messages.push("ไม่พบผู้เข้าร่วมนิสิต");
    const needsCountryMapping = !matchedCountry;
    const needsUnitMapping = !matchedUnit;
    const needsPartnerMapping = Boolean(project.institution_name && !matchedPartner);
    if (needsCountryMapping) messages.push("ยังจับคู่ประเทศกับฐานใหม่ไม่ได้");
    if (needsUnitMapping) messages.push("ยังจับคู่หน่วยงาน ม.พะเยากับฐานใหม่ไม่ได้");
    if (needsPartnerMapping) messages.push("ยังไม่พบองค์กรคู่ความร่วมมือในฐานใหม่");
    if (staff.length) messages.push(`มีบุคลากร ${staff.length} คน — ไม่รวมใน Mobility นิสิต`);
    const errors = messages.filter((message) => /ไม่มี|ยังจับคู่/.test(message));
    const normalizedParticipants = students.map((person) => {
      const participantSourceUnit = units.get(person.unit_id_snapshot);
      const participantTargetUnit = participantSourceUnit?.unit_code
        ? targetUnitByCode.get(participantSourceUnit.unit_code.toUpperCase())
        : undefined;
      return {
        legacyParticipantId: person.participant_id,
        sourceIdentifier: person.person_id,
        fullNameSnapshot: person.full_name_snapshot,
        genderSnapshot: person.gender_snapshot,
        programOrPositionSnapshot: person.program_or_position_snapshot,
        participantRole: person.role || "นิสิต",
        sourceUnitId: person.unit_id_snapshot,
        organizationUnitIdSnapshot: participantTargetUnit?.id ?? null,
      } satisfies StudentMobilityImportParticipant;
    });
    const countryName = sourceCountry
      ? sourceCountry.country_name_th || sourceCountry.country_name_en || sourceCountry.country_name || sourceCountry.iso2 || null
      : null;
    return {
      sourceRow: Number(project.__row),
      legacyProjectId: project.mobility_id,
      projectName: project.project_name,
      institutionName: project.institution_name,
      startDate: project.start_date,
      endDate: project.end_date,
      studentParticipants: students.length,
      staffParticipants: staff.length,
      sourceCountry: sourceCountry ? {
        id: project.country_id || sourceCountry.country_id || "",
        name: sourceCountry.country_name_th || sourceCountry.country_name_en || sourceCountry.country_name || sourceCountry.iso2 || "ไม่ระบุประเทศ",
        iso2: sourceCountry.iso2 || "",
      } : null,
      sourceUnit: sourceUnit ? {
        id: project.up_unit_id || sourceUnit.unit_id || "",
        name: sourceUnit.unit_name_th || sourceUnit.unit_name_en || sourceUnit.unit_name || sourceUnit.unit_code || "ไม่ระบุหน่วยงาน",
        code: sourceUnit.unit_code || "",
      } : null,
      needsCountryMapping,
      needsUnitMapping,
      needsPartnerMapping,
      suggestedCountryId: matchedCountry?.id ?? null,
      suggestedUnitId: matchedUnit?.id ?? null,
      suggestedPartnerId: matchedPartner?.id ?? null,
      result: errors.length ? "error" : messages.length ? "warning" : "ready",
      messages,
      sourceData: {
        project,
        participants: students,
      },
      normalizedData: {
        legacyId: project.mobility_id,
        projectName: project.project_name,
        purpose: project.purpose,
        direction: direction(project.direction),
        countryId: matchedCountry?.id ?? null,
        countryNameSnapshot: countryName,
        city: nullable(project.city),
        partnerOrganizationId: matchedPartner?.id ?? null,
        partnerNameSnapshot: nullable(project.institution_name),
        ownerUnitId: matchedUnit?.id ?? null,
        participantGroup: nullable(project.participant_group),
        studyLevel: nullable(project.level),
        startDate: isoDate(project.start_date),
        endDate: isoDate(project.end_date),
        fiscalYear: Number(project.fiscal_year) || null,
        sourceStatus: project.status,
        publicVisible: truthy.has(project.public_visible.toLowerCase()),
        participants: normalizedParticipants,
      },
    } satisfies StudentMobilityImportRow;
  });
  return {
    sourceFile: file.name,
    totalProjects: rows.length,
    readyProjects: rows.filter((row) => row.result === "ready").length,
    warningProjects: rows.filter((row) => row.result === "warning").length,
    errorProjects: rows.filter((row) => row.result === "error").length,
    studentParticipants: rows.reduce((total, row) => total + row.studentParticipants, 0),
    excludedStaffParticipants: rows.reduce((total, row) => total + row.staffParticipants, 0),
    referenceOptions: lookup,
    rows,
  };
}
