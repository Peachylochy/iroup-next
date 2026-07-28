import ExcelJS from "exceljs";

export const masterEntities = ["country", "organization_unit", "partner_organization", "student", "staff"] as const;
export type MasterEntity = (typeof masterEntities)[number];
type SourceRow = Record<string, string>;
type Existing = { countries: Set<string>; units: Set<string>; partners: Set<string>; students: Set<string>; staff: Set<string> };
export type MasterPreviewRow = { entity: MasterEntity; rowNumber: number; sourceKey: string; label: string; status: "valid" | "warning" | "invalid" | "duplicate"; changeAction: "insert" | "update" | "skip"; messages: string[]; sourceData: Record<string, string>; normalizedData: Record<string, unknown> };
export type MasterImportPreview = { sourceFile: string; rows: MasterPreviewRow[]; summary: Record<MasterEntity, { total: number; insert: number; update: number; skip: number; invalid: number }> };

function readRows(sheet: ExcelJS.Worksheet) {
  const headers = Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(1).getCell(index + 1).text.trim());
  const rows: SourceRow[] = [];
  sheet.eachRow((row, number) => { if (number > 1) { const item: SourceRow = { __row: String(number) }; headers.forEach((header, index) => item[header] = row.getCell(index + 1).text.trim()); rows.push(item); } });
  return rows;
}
const bool = (value: string) => !["0", "false", "no", "inactive", "in_active"].includes(value.trim().toLowerCase());
const clean = (value: string | undefined) => (value || "").trim();
const label = (row: SourceRow) => clean(row.full_name_th) || clean(row.org_name_en) || clean(row.country_name_th) || clean(row.unit_name_th) || clean(row.iso2) || clean(row.student_id) || clean(row.staff_id);

function makeRow(entity: MasterEntity, row: SourceRow, existing: Existing): MasterPreviewRow | null {
  const key = entity === "country" ? clean(row.iso2).toUpperCase() : entity === "organization_unit" ? clean(row.unit_code).toUpperCase() : entity === "partner_organization" ? clean(row.partner_org_id) : entity === "student" ? clean(row.student_id) : clean(row.staff_id);
  if (!key) return null;
  const requiredName = entity === "country" ? clean(row.country_name_en) || clean(row.country_name_th) : entity === "organization_unit" ? clean(row.unit_name_th) : entity === "partner_organization" ? clean(row.org_name_en) || clean(row.org_name_th) : clean(row.full_name_th) || clean(row.full_name_en);
  const status = requiredName ? "valid" : "invalid";
  const seen = entity === "country" ? existing.countries.has(key) : entity === "organization_unit" ? existing.units.has(key) : entity === "partner_organization" ? existing.partners.has(key) : entity === "student" ? existing.students.has(key) : existing.staff.has(key);
  const normalizedData = entity === "country" ? { iso2: key, iso3: clean(row.iso3).toUpperCase(), name_th: clean(row.country_name_th), name_en: clean(row.country_name_en), search_alias: [clean(row.country_id), key, clean(row.iso3), clean(row.country_name_th), clean(row.country_name_en)].filter(Boolean), active: bool(row.active) } : entity === "organization_unit" ? { code: key, name_th: clean(row.unit_name_th), name_en: clean(row.unit_name_en) || null, unit_type: clean(row.unit_type) || null, parent_source_id: clean(row.parent_unit_id) || null, active: bool(row.active) } : entity === "partner_organization" ? { legacy_id: key, name_th: clean(row.org_name_th) || null, name_en: clean(row.org_name_en), organization_type: clean(row.org_type) || null, country_source_id: clean(row.country_id) || null, website_url: clean(row.website) || null, active: bool(row.status) } : { person_type: entity, source_identifier: key, prefix_th: clean(row.prefix_th) || null, first_name_th: clean(row.first_name_th) || null, last_name_th: clean(row.last_name_th) || null, full_name_th: clean(row.full_name_th) || clean(row.full_name_en), full_name_en: clean(row.full_name_en) || null, gender: clean(row.gender) || null, unit_source_id: clean(row.unit_id) || null, program_or_position: clean(entity === "student" ? row.program_th : row.position) || null, source_system: clean(row.source_system) || "legacy_master", active: bool(row.active) };
  return { entity, rowNumber: Number(row.__row), sourceKey: key, label: label(row), status: status === "invalid" ? "invalid" : seen ? "warning" : "valid", changeAction: status === "invalid" ? "skip" : seen ? "update" : "insert", messages: status === "invalid" ? ["ขาดชื่อที่ใช้สร้างข้อมูล"] : seen ? ["พบรหัสต้นทางในระบบแล้ว — จะเสนอเป็นการอัปเดต"] : [], sourceData: row, normalizedData };
}

export async function previewMasterImport(file: File, existing: Existing): Promise<MasterImportPreview> {
  const book = new ExcelJS.Workbook(); await book.xlsx.load((await file.arrayBuffer()) as never);
  const config: Array<[MasterEntity, string]> = [["country", "COUNTRY_MASTER"], ["organization_unit", "UP_UNIT_MASTER"], ["partner_organization", "PARTNER_ORG_MASTER"], ["student", "PERSON_STUDENT"], ["staff", "PERSON_STAFF"]];
  const rows = config.flatMap(([entity, name]) => { const sheet = book.getWorksheet(name); if (!sheet) return []; return readRows(sheet).map((row) => makeRow(entity, row, existing)).filter((row): row is MasterPreviewRow => Boolean(row)); });
  const summary = Object.fromEntries(masterEntities.map((entity) => { const set = rows.filter((row) => row.entity === entity); return [entity, { total: set.length, insert: set.filter((row) => row.changeAction === "insert").length, update: set.filter((row) => row.changeAction === "update").length, skip: set.filter((row) => row.status === "duplicate").length, invalid: set.filter((row) => row.status === "invalid").length }]; })) as MasterImportPreview["summary"];
  return { sourceFile: file.name, rows, summary };
}
