import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { previewLegacyContactImport } from "../src/features/legacy-import/legacy-contact-import";

describe("legacy contact import", () => {
  it("merges duplicate organization/name rows while preserving all methods and context", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Contact");
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow([
      1,
      "Same Contact",
      "",
      "Example University",
      "Japan",
      "Asia",
      "University",
      "research",
      "first@example.edu",
      "",
      "Faculty of Dentistry",
      "",
      "",
      "first note",
    ]);
    sheet.addRow([
      2,
      "Same Contact",
      "",
      "Example University",
      "Japan",
      "Asia",
      "University",
      "teaching",
      "second@example.edu",
      "+66 1 234 5678",
      "Faculty of Public Health",
      "",
      "",
      "second note",
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer], "contacts.xlsx");
    const preview = await previewLegacyContactImport(
      file,
      [{ id: "partner-1", name_th: null, name_en: "Example University" }],
      [],
    );

    expect(preview.total).toBe(1);
    expect(preview.duplicateRows).toBe(1);
    expect(preview.valid).toBe(1);
    expect(preview.rows[0].sourceKey).toBe("1, 2");
    expect(preview.rows[0].normalizedData.contactMethods).toEqual([
      { method_type: "email", value: "first@example.edu" },
      { method_type: "email", value: "second@example.edu" },
      { method_type: "phone", value: "+66 1 234 5678" },
    ]);
    expect(preview.rows[0].normalizedData.expertiseAreas).toEqual([
      "research",
      "teaching",
    ]);
    expect(preview.rows[0].normalizedData.internalNote).toContain(
      "Faculty of Dentistry",
    );
    expect(preview.rows[0].normalizedData.internalNote).toContain(
      "Faculty of Public Health",
    );
  });
});
