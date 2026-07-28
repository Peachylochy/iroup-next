import type { MouAgreement } from "./mou-query";

export type CountryStat = {
  iso2: string;
  nameTh: string;
  nameEn: string;
  continentCode: string;
  totalMous: number;
  activeMous: number;
  agreements: MouAgreement[];
};

export type FacultyStat = {
  unitId: string;
  nameTh: string;
  nameEn: string | null;
  code: string | null;
  totalMous: number;
  ownerCount: number;
};

export type ContinentStat = {
  code: string;
  nameTh: string;
  nameEn: string;
  totalMous: number;
  countryCount: number;
};

const continentMap: Record<string, { th: string; en: string }> = {
  AS: { th: "เอเชีย", en: "Asia" },
  EU: { th: "ยุโรป", en: "Europe" },
  NA: { th: "อเมริกาเหนือ", en: "North America" },
  SA: { th: "อเมริกาใต้", en: "South America" },
  OC: { th: "ออสเตรเลีย/โอเชียเนีย", en: "Oceania" },
  AF: { th: "แอฟริกา", en: "Africa" },
};

export function processMouAnalytics(agreements: MouAgreement[]) {
  const countryMap = new Map<string, CountryStat>();
  const facultyMap = new Map<string, FacultyStat>();
  const continentMapStats = new Map<string, { totalMous: number; countries: Set<string> }>();

  agreements.forEach((item) => {
    // Process Countries from agreement partners
    item.agreement_partners.forEach((partner) => {
      const org = partner.partner_organizations;
      const countryObj = org?.countries;
      const iso2 = countryObj?.iso2 || "TH"; // default or fallback
      const nameTh = partner.country_name_th_snapshot || countryObj?.name_th || "ประเทศไทย";
      const nameEn = partner.country_name_en_snapshot || countryObj?.name_en || "Thailand";
      const continentCode = countryObj?.continent_code || "AS";

      if (!countryMap.has(iso2)) {
        countryMap.set(iso2, {
          iso2,
          nameTh,
          nameEn,
          continentCode,
          totalMous: 0,
          activeMous: 0,
          agreements: [],
        });
      }

      const stat = countryMap.get(iso2)!;
      if (!stat.agreements.some((a) => a.id === item.id)) {
        stat.totalMous += 1;
        if (item.status === "active") stat.activeMous += 1;
        stat.agreements.push(item);
      }

      // Process Continents
      if (!continentMapStats.has(continentCode)) {
        continentMapStats.set(continentCode, { totalMous: 0, countries: new Set() });
      }
      const cStat = continentMapStats.get(continentCode)!;
      cStat.countries.add(iso2);
    });

    // Process Faculties / Units from agreement units
    item.agreement_units.forEach((unit) => {
      const orgUnit = unit.organization_units;
      if (!orgUnit) return;

      if (!facultyMap.has(orgUnit.id)) {
        facultyMap.set(orgUnit.id, {
          unitId: orgUnit.id,
          nameTh: orgUnit.name_th,
          nameEn: orgUnit.name_en,
          code: orgUnit.code,
          totalMous: 0,
          ownerCount: 0,
        });
      }

      const fStat = facultyMap.get(orgUnit.id)!;
      fStat.totalMous += 1;
      if (unit.is_owner) fStat.ownerCount += 1;
    });
  });

  // Calculate continent totals
  continentMapStats.forEach((val, code) => {
    const cAgreements = agreements.filter((item) =>
      item.agreement_partners.some(
        (p) => p.partner_organizations?.countries?.continent_code === code,
      ),
    );
    val.totalMous = cAgreements.length;
  });

  const countryStats = Array.from(countryMap.values()).sort(
    (a, b) => b.totalMous - a.totalMous,
  );

  const facultyStats = Array.from(facultyMap.values()).sort(
    (a, b) => b.totalMous - a.totalMous,
  );

  const continentStats: ContinentStat[] = Object.keys(continentMap).map((code) => {
    const info = continentMap[code];
    const statData = continentMapStats.get(code);
    return {
      code,
      nameTh: info.th,
      nameEn: info.en,
      totalMous: statData?.totalMous || 0,
      countryCount: statData?.countries.size || 0,
    };
  });

  return {
    countryStats,
    facultyStats,
    continentStats,
  };
}
