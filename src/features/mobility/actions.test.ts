import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, createClient, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { submitMobilityForm } from "./actions";

function draftForm() {
  const form = new FormData();
  form.set("mobility_id", "existing-movement");
  form.set("updated_at", "2026-10-20T08:00:00Z");
  form.set("project_name", " Exchange project ");
  form.set("start_date", "2026-10-21");
  form.set("participants_json", JSON.stringify([{ full_name_snapshot: "Student A" }]));
  form.set("funding_json", JSON.stringify([{ budget_type: "grant", amount: 100 }]));
  return form;
}

describe("submitMobilityForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ rpc });
    rpc.mockResolvedValue({ data: { id: "existing-movement", updated_at: "2026-10-21T08:00:00Z" }, error: null });
  });

  it.each(["draft", "review"] as const)("saves the complete %s form with one atomic request", async (intent) => {
    const form = draftForm();
    form.set("intent", intent);

    const result = await submitMobilityForm({}, form);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("student_mobility_save", {
      target_movement_id: "existing-movement",
      expected_updated_at: "2026-10-20T08:00:00Z",
      payload: expect.objectContaining({ project_name: "Exchange project", fiscal_year: "2570" }),
      participants: [{ full_name_snapshot: "Student A" }],
      funding: [{ budget_type: "grant", amount: 100 }],
      submit_for_review: intent === "review",
    });
    expect(result).toEqual({ success: intent, id: "existing-movement", updatedAt: "2026-10-21T08:00:00Z" });
    expect(revalidatePath.mock.calls).toEqual([
      ["/mobility"], ["/mobility/existing-movement"], ["/mobility/existing-movement/edit"],
    ]);
  });

  it("keeps a failed review save as an error and does not invalidate saved views", async () => {
    const form = draftForm();
    form.set("intent", "review");
    rpc.mockResolvedValue({ data: null, error: { message: "STUDENT_MOBILITY_VALIDATION_FAILED", details: "Add at least one participant." } });

    expect(await submitMobilityForm({}, form)).toEqual({ error: "Add at least one participant." });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["participants_json", "{"],
    ["participants_json", "{}"],
    ["funding_json", "null"],
    ["funding_json", ""],
  ])("rejects invalid %s before it can clear existing rows (%s)", async (field, value) => {
    const form = draftForm();
    form.set(field, value);

    expect(await submitMobilityForm({}, form)).toHaveProperty("error");
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("allows intentional empty participant and funding arrays in a draft", async () => {
    const form = draftForm();
    form.set("participants_json", "[]");
    form.set("funding_json", "[]");

    expect(await submitMobilityForm({}, form)).toHaveProperty("success", "draft");
    expect(rpc).toHaveBeenCalledWith("student_mobility_save", expect.objectContaining({ participants: [], funding: [] }));
  });
});
