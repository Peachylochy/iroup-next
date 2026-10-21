import { describe, expect, it } from "vitest";
import { parseTravelListState, travelListHref } from "./travel-list-state";

describe("Travel URL state", () => {
  it("uses safe defaults for malformed and prototype-key values", () => {
    expect(parseTravelListState({ status: "__proto__", sort: "constructor", country: "not-a-uuid", unit: "x", year: "2570.1", page: "2e3" }))
      .toEqual({ q: "", status: "", sort: "updated_desc", country: "", unit: "", year: "", page: 1 });
  });
  it("takes the first duplicated value and bounds long searches and page offsets", () => {
    expect(parseTravelListState({ q: [" คำค้น ", "ignored"], status: ["approved", "draft"], page: "9999999" }))
      .toMatchObject({ q: "คำค้น", status: "approved", page: 1000000 });
    expect(parseTravelListState({ q: "ก".repeat(500), page: "99999999999999999999999" })).toMatchObject({ q: "ก".repeat(200), page: 1 });
    for (const page of ["-1", "0", "1.2", "Infinity"]) expect(parseTravelListState({ page }).page).toBe(1);
  });
  it("round trips Thai and reserved characters without turning search text into URL parameters", () => {
    const state = parseTravelListState({ q: "ไทย & status=cancelled / 100% _", status: "active", country: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA", unit: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", year: "2570", sort: "start_asc", page: "3" });
    const url = new URL(travelListHref(state), "http://localhost");
    expect(parseTravelListState(Object.fromEntries(url.searchParams))).toEqual(state);
    expect(url.searchParams.getAll("status")).toEqual(["active"]);
  });
  it("does not split an emoji into invalid Unicode at the search limit", () => {
    const q = `${"ก".repeat(199)}😀ท้าย`;
    expect(parseTravelListState({ q }).q).toBe(`${"ก".repeat(199)}😀`);
  });
  it("preserves all filters while paging and omits default parameters", () => {
    const state = parseTravelListState({ q: "ประชุม", status: "draft", page: "3" });
    const url = new URL(travelListHref(state, { page: 2 }), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "ประชุม", status: "draft", page: "2" });
    expect(travelListHref(parseTravelListState({}))).toBe("/travel");
    expect(travelListHref(state, { page: 1 })).not.toContain("page=");
  });
});
