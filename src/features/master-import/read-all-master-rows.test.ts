import { describe, expect, it, vi } from "vitest";
import { readAllMasterRows } from "./read-all-master-rows";

describe("readAllMasterRows", () => {
  it("includes people past the first API page and the last partial page", async () => {
    const people = Array.from({ length: 26_037 }, (_, id) => ({ id, source_identifier: `P${id}` }));
    const readPage = vi.fn(async (from: number, to: number) => ({ data: people.slice(from, to + 1), error: null }));
    const result = await readAllMasterRows(readPage);
    expect(result).toEqual(people);
    expect(new Set(result.map((row) => row.source_identifier)).has("P26036")).toBe(true);
    expect(readPage).toHaveBeenLastCalledWith(26_037, 26_536);
  });

  it("continues after a server-capped short page without skipping records", async () => {
    const data = Array.from({ length: 12 }, (_, id) => id);
    const readPage = vi.fn(async (from: number, to: number) => ({ data: data.slice(from, Math.min(to + 1, from + 3)), error: null }));
    expect(await readAllMasterRows(readPage, 5)).toEqual(data);
    expect(readPage.mock.calls.map(([from]) => from)).toEqual([0, 3, 6, 9, 12]);
  });

  it("fails the complete preview when a later page cannot be read", async () => {
    await expect(readAllMasterRows(async (from) => from === 0
      ? { data: ["first"], error: null }
      : { data: null, error: { message: "page failed" } }, 1)).rejects.toThrow("page failed");
  });
});
