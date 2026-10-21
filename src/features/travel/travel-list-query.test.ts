import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTravelListState } from "./travel-list-state";
import { getTravelList } from "./travel-list-query";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const emptyResult = {
  rows: [], total: 0, page: 1, pageSize: 20,
  summary: { total: 0, active: 0, underReview: 0 },
  filters: { countries: [], units: [], years: [] },
};
const row = {
  id: "b1500000-0000-0000-0000-000000000001", project_name: "Travel", title_en: null,
  country_name: null, partner_name: null, owner_unit_name: null, start_date: null,
  end_date: null, fiscal_year: null, workflow_status: "draft", participant_count: 0,
  updated_at: "2026-10-21T00:00:00+00:00",
};

describe("getTravelList", () => {
  beforeEach(() => rpc.mockReset());

  it("sends normalized URL filters to a single bounded RPC and preserves its clamped page", async () => {
    rpc.mockResolvedValue({ data: emptyResult, error: null });
    const state = parseTravelListState({ q: "  ทดสอบ %_  ", status: "draft", country: "b1200000-0000-0000-0000-000000000001", year: "2570", sort: "start_asc", page: "999" });
    expect(await getTravelList(state)).toEqual(emptyResult);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("travel_list_v2", {
      p_q: "ทดสอบ %_", p_status: "draft", p_country: "b1200000-0000-0000-0000-000000000001",
      p_unit: null, p_year: 2570, p_sort: "start_asc", p_page: 999,
    });
  });

  it("uses null for unset UUID and year filters", async () => {
    rpc.mockResolvedValue({ data: emptyResult, error: null });
    await getTravelList(parseTravelListState({}));
    expect(rpc).toHaveBeenCalledWith("travel_list_v2", expect.objectContaining({ p_country: null, p_unit: null, p_year: null }));
  });

  it("surfaces database failures instead of presenting a misleading empty list", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "TRAVEL_LIST_FORBIDDEN" } });
    await expect(getTravelList(parseTravelListState({}))).rejects.toThrow("TRAVEL_LIST_FORBIDDEN");
  });

  it.each([null, { ...emptyResult, rows: Array.from({ length: 21 }, () => row) },
    { ...emptyResult, pageSize: 100 }, { ...emptyResult, filters: null }, { ...emptyResult, page: 0 },
    { ...emptyResult, summary: { total: 0, active: "0", underReview: 0 } },
    { ...emptyResult, rows: [{ ...row, internal_note: "private" }] },
    { ...emptyResult, rows: [{ ...row, workflow_status: "unknown" }] },
    { ...emptyResult, rows: [{ ...row, participant_count: -1 }] },
    { ...emptyResult, filters: { ...emptyResult.filters, countries: [{ id: "x", label: "country", private_data: "private" }] } }])(
    "fails closed for an invalid or unbounded response: %j", async (data) => {
      rpc.mockResolvedValue({ data, error: null });
      await expect(getTravelList(parseTravelListState({}))).rejects.toThrow("Invalid Travel list response");
    },
  );

  it("accepts the complete minimal list row without fetching private detail fields", async () => {
    const result = { ...emptyResult, rows: [row], total: 1, summary: { total: 1, active: 0, underReview: 0 } };
    rpc.mockResolvedValue({ data: result, error: null });
    expect(await getTravelList(parseTravelListState({}))).toEqual(result);
  });
});
