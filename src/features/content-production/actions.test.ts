import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute, revalidatePath } = vi.hoisted(() => ({ execute: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("./content-production", () => ({ ContentProduction: { execute } }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { executeContentCommand } from "./actions";

const command = { op: "open", kind: "news", record_id: null, title_th: "ข่าวใหม่", idempotency_key: "653d3866-4dbe-486b-83fb-83b9cda641a3" };
const result = { work_item_id: "653d3866-4dbe-486b-83fb-83b9cda641a4", record_id: "653d3866-4dbe-486b-83fb-83b9cda641a5", row_version: 1 };

function form(value: unknown = command) {
  const data = new FormData();
  data.set("command", JSON.stringify(value));
  return data;
}

describe("executeContentCommand server action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    execute.mockResolvedValue(result);
  });

  it.each([undefined, "{", "", "x".repeat(160001)])("rejects missing, malformed, or oversized JSON without accessing the database", async (raw) => {
    const data = new FormData();
    if (raw !== undefined) data.set("command", raw);
    expect(await executeContentCommand({}, data)).toMatchObject({ code: "CONTENT_INVALID", error: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { ...command, kind: "knowledge" }, { ...command, title_th: " " }, { ...command, actor_id: "forged" }])("rejects malformed command shapes before execution (%j)", async (value) => {
    expect(await executeContentCommand({}, form(value))).toMatchObject({ code: "CONTENT_INVALID", error: expect.any(String) });
    expect(execute).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("passes the validated command once and revalidates only the affected content routes after success", async () => {
    expect(await executeContentCommand({}, form())).toEqual({ success: true, result });
    expect(execute).toHaveBeenCalledExactlyOnceWith(command);
    expect(revalidatePath.mock.calls).toEqual([["/content-production", "layout"], ["/news"], ["/scholarships"]]);
  });

  it.each([
    ["AUTH_REQUIRED", "CONTENT_FORBIDDEN"], ["PROFILE_INACTIVE", "CONTENT_FORBIDDEN"], ["FORBIDDEN", "CONTENT_FORBIDDEN"],
    ["NOT_FOUND", "CONTENT_NOT_FOUND"], ["POLICY_VIOLATION", "CONTENT_INVALID"],
    ["IDEMPOTENCY_CONFLICT", "CONTENT_IDEMPOTENCY_CONFLICT"], ["STALE_REVISION", "CONTENT_CONFLICT"],
    ["SOURCE_REQUIRED", "CONTENT_SOURCE_REQUIRED"], ["SOURCE_STALE", "CONTENT_STALE"],
    ["STALE_VERSION", "CONTENT_STALE"], ["STALE_SNAPSHOT", "CONTENT_STALE"],
    ["MISSING_LOCALE", "CONTENT_LOCALE_REQUIRED"], ["DEADLINE_AMBIGUOUS", "CONTENT_DEADLINE_REQUIRED"],
    ["INVALID_TRANSITION", "CONTENT_TRANSITION_INVALID"],
  ])("maps database outcome %s to safe Thai action outcome %s", async (databaseCode, expectedCode) => {
    execute.mockRejectedValue(new Error(`Database error ${databaseCode}; private SQL context must not reach the client`));
    const state = await executeContentCommand({}, form());
    expect(state).toMatchObject({ code: expectedCode, error: expect.stringMatching(/[ก-๙]/) });
    expect(state.success).toBeUndefined();
    expect(state.error).not.toContain("private SQL context");
    expect(state.error).not.toContain(databaseCode);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["CONTENT_CONFLICT", "CONTENT_SOURCE_REQUIRED", "CONTENT_TRANSITION_INVALID"])("also accepts a stable application outcome %s without leaking implementation details", async (code) => {
    execute.mockRejectedValue(new Error(`${code}: private record details`));
    expect(await executeContentCommand({}, form())).toMatchObject({ code, error: expect.stringMatching(/[ก-๙]/) });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([new Error("Unexpected SQL failure: private record detail"), new Error("NOT_FOUND_IN_SOME_OTHER_CODE"), { message: "FORBIDDEN: not an Error object" }])("hides unknown errors and does not confuse partial error-code substrings with typed outcomes", async (error) => {
    execute.mockRejectedValue(error);
    const state = await executeContentCommand({}, form());
    expect(state).toMatchObject({ code: "CONTENT_FAILED", error: expect.stringMatching(/[ก-๙]/) });
    expect(state.error).not.toContain("private record");
    expect(state.error).not.toContain("NOT_FOUND");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
