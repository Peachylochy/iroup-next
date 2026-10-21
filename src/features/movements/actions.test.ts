import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, createClient, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveStaffMovement } from "./actions";

const manualParticipant = {
  person_id: null,
  full_name_snapshot: "Manual traveler",
  organization_unit_id_snapshot: null,
  organization_unit_name_snapshot: "External unit",
  position_snapshot: "Visiting researcher",
  participant_role: "ผู้เดินทาง",
};
const grant = { budget_type: "grant", source_name: "Faculty", amount: 100, currency: "THB", note: "Approved allocation" };

function draftForm() {
  const form = new FormData();
  form.set("movement_module", "travel");
  form.set("movement_id", "existing-movement");
  form.set("updated_at", "2026-10-20T08:00:00Z");
  form.set("project_name", " Official travel ");
  form.set("start_date", "2026-10-21");
  form.set("participants_json", JSON.stringify([manualParticipant]));
  form.set("funding_json", JSON.stringify([grant]));
  return form;
}

describe("saveStaffMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ rpc });
    rpc.mockResolvedValue({ data: { id: "existing-movement" }, error: null });
  });

  it.each([
    ["participants_json", "{"],
    ["participants_json", "{}"],
    ["participants_json", "null"],
    ["funding_json", "["],
    ["funding_json", "{}"],
    ["funding_json", ""],
  ])("rejects malformed %s before it can clear saved children (%s)", async (field, value) => {
    const form = draftForm();
    form.set(field, value);

    expect(await saveStaffMovement({}, form)).toHaveProperty("error");
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["participants_json", "funding_json"])("rejects missing %s before contacting the database", async (field) => {
    const form = draftForm();
    form.delete(field);

    expect(await saveStaffMovement({}, form)).toHaveProperty("error");
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["travel", "staff_official_travel"],
    ["staff-mobility", "staff_mobility"],
  ])("preserves valid manual participant and funding data in the %s save", async (module, category) => {
    const form = draftForm();
    form.set("movement_module", module);
    form.set("intent", "review");

    expect(await saveStaffMovement({}, form)).toEqual({ success: true, id: "existing-movement" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("staff_movement_save", {
      target_movement_id: "existing-movement",
      expected_updated_at: "2026-10-20T08:00:00Z",
      requested_category: category,
      payload: expect.objectContaining({ project_name: "Official travel", fiscal_year: "2570" }),
      participants: [manualParticipant],
      funding: [grant],
      submit_for_review: true,
    });
    expect(revalidatePath.mock.calls).toEqual([
      [`/${module}`], [`/${module}/existing-movement`], [`/${module}/existing-movement/edit`],
    ]);
  });

  it("allows explicitly empty arrays for an intentional draft edit", async () => {
    const form = draftForm();
    form.set("participants_json", "[]");
    form.set("funding_json", "[]");

    expect(await saveStaffMovement({}, form)).toHaveProperty("success", true);
    expect(rpc).toHaveBeenCalledWith("staff_movement_save", expect.objectContaining({
      participants: [], funding: [], submit_for_review: false,
    }));
  });
});
