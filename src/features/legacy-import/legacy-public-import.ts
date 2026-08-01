const LEGACY_PUBLIC_API =
  "https://script.google.com/macros/s/AKfycbx84FaCV07b_uiuBDYK-bjbD422BrwRI3OF7kC1BnviBc5SqGOyADK03KTLkDXn678-/exec";

export type LegacyMouDto = {
  mou_id: string;
  partner_org_name: string;
  partner_org_name_en: string;
  country: {
    iso2: string;
    iso3: string;
    country_name_th: string;
    country_name_en: string;
  };
  continent?: {
    continent_en?: string;
    continent_th?: string;
  };
  unit: {
    unit_code: string;
    unit_name_th: string;
    unit_name_en: string;
  };
  mou_type: string;
  start_date: string;
  end_date: string;
  fiscal_year: number;
  status: string;
};

type LegacyResponse<T> = {
  success: boolean;
  data: T[];
  error?: string;
};

export type LegacyReferenceData = {
  countries: Array<{
    id: string;
    iso2: string;
    name_th: string;
    name_en: string;
    continent_code: string | null;
  }>;
  units: Array<{
    id: string;
    code: string | null;
    name_th: string;
    name_en: string | null;
  }>;
  partners: Array<{
    id: string;
    name_th: string | null;
    name_en: string | null;
  }>;
  existingLegacyIds: Set<string>;
};

export type LegacyMouPreviewRow = {
  rowNumber: number;
  sourceKey: string;
  status: "valid" | "warning" | "invalid";
  changeAction: "insert" | "update";
  label: string;
  messages: string[];
  sourceData: LegacyMouDto;
  normalizedData: {
    legacyId: string;
    titleTh: string;
    titleEn: string;
    agreementType: string;
    startDate: string;
    endDate: string;
    fiscalYear: number;
    sourceStatus: string;
    partnerOrganizationId: string | null;
    partnerNameTh: string;
    partnerNameEn: string;
    countryId: string | null;
    countryNameTh: string;
    countryNameEn: string;
    continentCode: string | null;
    ownerUnitId: string | null;
  };
};

export type LegacyMouPreview = {
  source: string;
  total: number;
  valid: number;
  invalid: number;
  inserts: number;
  updates: number;
  rows: LegacyMouPreviewRow[];
};

function normalizeName(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[.,()[\]{}'"’“”\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function continentCode(value: string | undefined) {
  const codes: Record<string, string> = {
    africa: "AF",
    asia: "AS",
    europe: "EU",
    "north america": "NA",
    oceania: "OC",
    "south america": "SA",
  };
  return codes[normalizeName(value)] || null;
}

export async function fetchLegacyMouData() {
  const url = `${LEGACY_PUBLIC_API}?action=v2.public.mou.list`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`ระบบเดิมตอบกลับ HTTP ${response.status}`);
  const body = (await response.json()) as LegacyResponse<LegacyMouDto>;
  if (!body.success || !Array.isArray(body.data)) {
    throw new Error(body.error || "อ่านข้อมูล MOU จากระบบเดิมไม่สำเร็จ");
  }
  return body.data;
}

export function createLegacyMouPreview(
  sourceRows: LegacyMouDto[],
  reference: LegacyReferenceData,
): LegacyMouPreview {
  const countries = new Map(
    reference.countries.map((item) => [item.iso2.trim().toUpperCase(), item]),
  );
  const units = new Map(
    reference.units.flatMap((item) =>
      item.code ? [[item.code.trim().toUpperCase(), item] as const] : [],
    ),
  );
  const partnersByName = new Map<string, (typeof reference.partners)[number]>();
  for (const partner of reference.partners) {
    for (const name of [partner.name_th, partner.name_en]) {
      const key = normalizeName(name);
      if (key && !partnersByName.has(key)) partnersByName.set(key, partner);
    }
  }

  const rows = sourceRows.map((source, index): LegacyMouPreviewRow => {
    const country = countries.get(source.country?.iso2?.trim().toUpperCase());
    const unit = units.get(source.unit?.unit_code?.trim().toUpperCase());
    const partner =
      partnersByName.get(normalizeName(source.partner_org_name)) ||
      partnersByName.get(normalizeName(source.partner_org_name_en));
    const messages: string[] = [];
    if (!source.mou_id?.trim()) messages.push("ไม่พบรหัส MOU จากระบบเดิม");
    if (!source.partner_org_name?.trim() && !source.partner_org_name_en?.trim()) {
      messages.push("ไม่พบชื่อองค์กรคู่ความร่วมมือ");
    }
    const warnings: string[] = [];
    if (!partner) warnings.push("จะสร้างองค์กรคู่ความร่วมมือใหม่จากข้อมูลระบบเดิม");
    if (!country) messages.push("จับคู่ประเทศกับ Data Master ไม่ได้");
    if (!unit) messages.push("จับคู่หน่วยงาน ม.พะเยา กับ Data Master ไม่ได้");
    if (!source.start_date?.trim()) messages.push("ไม่พบวันเริ่มต้น");

    const partnerName = source.partner_org_name?.trim() || source.partner_org_name_en?.trim();
    return {
      rowNumber: index + 1,
      sourceKey: source.mou_id,
      status: messages.length ? "invalid" : warnings.length ? "warning" : "valid",
      changeAction: reference.existingLegacyIds.has(source.mou_id) ? "update" : "insert",
      label: partnerName,
      messages: [...messages, ...warnings],
      sourceData: source,
      normalizedData: {
        legacyId: source.mou_id,
        titleTh: partnerName,
        titleEn: source.partner_org_name_en?.trim() || partnerName,
        agreementType: source.mou_type?.trim() || "MOU",
        startDate: source.start_date || "",
        endDate: source.end_date || "",
        fiscalYear: Number(source.fiscal_year) || 0,
        sourceStatus: source.status || "draft",
        partnerOrganizationId: partner?.id || null,
        partnerNameTh: source.partner_org_name?.trim() || partnerName,
        partnerNameEn: source.partner_org_name_en?.trim() || partnerName,
        countryId: country?.id || null,
        countryNameTh: source.country?.country_name_th || country?.name_th || "",
        countryNameEn: source.country?.country_name_en || country?.name_en || "",
        continentCode: country?.continent_code || continentCode(source.continent?.continent_en),
        ownerUnitId: unit?.id || null,
      },
    };
  });

  return {
    source: "iROUP เดิม · v2.public.mou.list",
    total: rows.length,
    valid: rows.filter((row) => row.status !== "invalid").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    inserts: rows.filter((row) => row.changeAction === "insert").length,
    updates: rows.filter((row) => row.changeAction === "update").length,
    rows,
  };
}
