import { describe, expect, it } from "vitest";

import { deriveThaiFiscalYear } from "./fiscal-year";

describe("deriveThaiFiscalYear", () => {
  it("uses the current Buddhist year before October", () => {
    expect(deriveThaiFiscalYear("2026-08-10")).toBe("2569");
  });

  it("rolls into the next fiscal year from October", () => {
    expect(deriveThaiFiscalYear("2026-10-01")).toBe("2570");
  });

  it("rejects incomplete or invalid date values", () => {
    expect(deriveThaiFiscalYear("")).toBe("");
    expect(deriveThaiFiscalYear("2026-13-01")).toBe("");
    expect(deriveThaiFiscalYear("10/08/2026")).toBe("");
  });
});
