import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { commandSchema, commandResultSchema, detailSchema, listSchema } from "./schema";
import type { ContentCommand, ContentKind } from "./types";

// One server-side boundary for editorial commands and safe, bounded read models.
// Provider, upload and publication adapters are intentionally absent in this slice.
export const ContentProduction = {
  async execute(command: ContentCommand) {
    const validated = commandSchema.parse(command);
    const client = await createClient();
    const args = { p_command: validated } satisfies Database["public"]["Functions"]["content_core_execute"]["Args"];
    const { data, error } = await client.rpc("content_core_execute", args);
    if (error) throw new Error(error.message);
    return commandResultSchema.parse(data);
  },
  async inspect(query: { kind: ContentKind; record_id: string }) {
    const client = await createClient();
    const args = { p_kind: query.kind, p_record_id: query.record_id } satisfies Database["public"]["Functions"]["content_core_inspect"]["Args"];
    const { data, error } = await client.rpc("content_core_inspect", args);
    if (error) throw new Error(error.message);
    return data === null ? null : detailSchema.parse(data);
  },
  async list(query: { kind: ContentKind; page: number }) {
    const client = await createClient();
    const args = { p_kind: query.kind, p_page: query.page } satisfies Database["public"]["Functions"]["content_core_list"]["Args"];
    const { data, error } = await client.rpc("content_core_list", args);
    if (error) throw new Error(error.message);
    return listSchema.parse(data);
  },
};
