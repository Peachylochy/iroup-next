import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserAccess, createClient, from, insert, update, eq, select, single, revalidatePath } = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(), createClient: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/access", () => ({ getCurrentUserAccess }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveContentRecord } from "./actions";

describe("legacy content save boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentUserAccess.mockResolvedValue({ user_id: "test-user" });
    createClient.mockResolvedValue({ from });
    from.mockReturnValue({ insert, update });
    insert.mockReturnValue({ select });
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({ data: { id: "saved-record" }, error: null });
  });

  it.each([
    ["scholarship", ""], ["scholarship", "existing-record"], ["news", ""], ["news", "existing-record"],
  ])("blocks a stale %s form from writing or publishing canonical data (record %s)", async (module, recordId) => {
    const data = new FormData();
    data.set("content_module", module);
    data.set("record_id", recordId);
    data.set("title_th", "Attempt from an old browser tab");
    data.set("publication_status", "published");
    data.set("public_visible", "on");
    const state = await saveContentRecord({}, data);
    expect(state).toEqual({ error: "กรุณาเปิดหน้าจัดทำเนื้อหาเพื่อบันทึกฉบับใหม่และส่งตรวจ" });
    expect(getCurrentUserAccess).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([["events", "events"], ["knowledge", "knowledge_items"]])("preserves the existing %s authoring path outside Core Content", async (module, table) => {
    const data = new FormData();
    data.set("content_module", module);
    data.set("title_th", "Existing module draft");
    data.set("starts_at", "2026-11-01T09:00");
    data.set("ends_at", "2026-11-01T17:00");
    expect(await saveContentRecord({}, data)).toEqual({ success: true, id: "saved-record" });
    expect(from).toHaveBeenCalledWith(table);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title_th: "Existing module draft", publication_status: "draft", public_visible: false, created_by: "test-user" }));
  });
});
