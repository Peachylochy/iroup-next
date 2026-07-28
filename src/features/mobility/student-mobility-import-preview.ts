import ExcelJS from "exceljs";

type Row = Record<string, string>;
type Lookup = {
  countries: Array<{ iso2: string; name_th: string; name_en: string }>;
  units: Array<{ code: string | null; name_th: string; name_en: string | null }>;
  partners: Array<{ legacy_id: string | null; name_th: string | null; name_en: string }>;
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
  result: "ready" | "warning" | "error";
  messages: string[];
};

export type StudentMobilityImportPreview = {
  sourceFile: string;
  totalProjects: number;
  readyProjects: number;
  warningProjects: number;
  errorProjects: number;
  studentParticipants: number;
  excludedStaffParticipants: number;
  rows: StudentMobilityImportRow[];
};

const truthy = new Set(["1", "true", "yes"]);
const normalize = (value: string | null | undefined) => (value || "").trim().toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "");

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

  const targetCountryIso2 = new Set(lookup.countries.map((country) => country.iso2.toUpperCase()));
  const targetUnitCodes = new Set(lookup.units.map((unit) => unit.code?.toUpperCase()).filter(Boolean));
  const targetPartners = new Set(lookup.partners.flatMap((partner) => [partner.name_th, partner.name_en, partner.legacy_id].map(normalize)).filter(Boolean));
  const rows = projects.map((project) => {
    const linked = peopleByProject.get(project.mobility_id) || [];
    const students = linked.filter((person) => person.participant_type === "student");
    const staff = linked.filter((person) => person.participant_type === "staff");
    const sourceCountry = countries.get(project.country_id);
    const sourceUnit = units.get(project.up_unit_id);
    const messages: string[] = [];
    if (!project.project_name) messages.push("ไม่มีชื่อโครงการ");
    if (!project.start_date) messages.push("ไม่มีวันเริ่มเดินทาง");
    if (!students.length) messages.push("ไม่พบผู้เข้าร่วมนิสิต");
    if (!sourceCountry?.iso2 || !targetCountryIso2.has(sourceCountry.iso2.toUpperCase())) messages.push("ยังจับคู่ประเทศกับฐานใหม่ไม่ได้");
    if (!sourceUnit?.unit_code || !targetUnitCodes.has(sourceUnit.unit_code.toUpperCase())) messages.push("ยังจับคู่หน่วยงาน ม.พะเยากับฐานใหม่ไม่ได้");
    if (project.institution_name && !targetPartners.has(normalize(project.institution_name))) messages.push("ยังไม่พบองค์กรคู่ความร่วมมือในฐานใหม่");
    if (staff.length) messages.push(`มีบุคลากร ${staff.length} คน — ไม่รวมใน Mobility นิสิต`);
    const errors = messages.filter((message) => /ไม่มี|ยังจับคู่/.test(message));
    return {
      sourceRow: Number(project.__row),
      legacyProjectId: project.mobility_id,
      projectName: project.project_name,
      institutionName: project.institution_name,
      startDate: project.start_date,
      endDate: project.end_date,
      studentParticipants: students.length,
      staffParticipants: staff.length,
      result: errors.length ? "error" : messages.length ? "warning" : "ready",
      messages,
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
    rows,
  };
}
