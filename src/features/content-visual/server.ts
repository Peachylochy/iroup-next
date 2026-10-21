import { createClient as createStorageClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { z } from "zod";
import { hashImage, validateManualImage } from "./image-validation";
import { reservationSchema, uploadInputSchema, visualCommandSchema, visualDetailSchema, visualResultSchema } from "./schema";
import type { VisualCommand, VisualUploadInput } from "./types";

function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
  return createStorageClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function authenticatedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return { client, actor: data.user.id };
}
function assertPrivatePath(path: string, workId?: string) {
  if (!/^work-items\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path)
    || (workId && !path.startsWith(`work-items/${workId}/`))) throw new Error("IMAGE_STORAGE_UNAVAILABLE");
}
export const ContentVisual = {
  async execute(input: VisualCommand) {
    const command = visualCommandSchema.parse(input);
    const client = await createClient();
    const args = { p_command: command } satisfies Database["public"]["Functions"]["content_visual_execute"]["Args"];
    const { data, error } = await client.rpc("content_visual_execute", args);
    if (error) throw new Error(error.message);
    return visualResultSchema.parse(data);
  },
  async inspect(workItemId: string) {
    const client = await createClient();
    const args = { p_work_item_id: z.string().uuid().parse(workItemId) } satisfies Database["public"]["Functions"]["content_visual_inspect"]["Args"];
    const { data, error } = await client.rpc("content_visual_inspect", args);
    if (error) throw new Error(error.message);
    return visualDetailSchema.parse(data);
  },
  async uploadImage(input: VisualUploadInput, file: File) {
    const command = uploadInputSchema.parse(input);
    const { client, actor } = await authenticatedClient();
    const detail = await ContentVisual.inspect(command.work_item_id);
    const brief = detail.briefs.find((item) => item.id === command.brief_id);
    if (!brief) throw new Error("BRIEF_NOT_APPROVED");
    const image = await validateManualImage(file, brief.brief);
    const storage = serviceClient(); // Fail before reserving if local server is unconfigured.
    const args = {
      p_command: { ...command, op: "reserve_upload", file: image.verified },
    } satisfies Database["public"]["Functions"]["content_visual_execute"]["Args"];
    const { data, error } = await client.rpc("content_visual_execute", args);
    if (error) throw new Error(error.message);
    const reservation = reservationSchema.parse(data);
    if (reservation.asset_id) return { work_item_id: command.work_item_id, row_version: reservation.row_version, asset_id: reservation.asset_id };
    assertPrivatePath(reservation.storage_path, command.work_item_id);
    const bucket = storage.storage.from("content-working");
    const uploaded = await bucket.upload(reservation.storage_path, image.bytes, { contentType: image.verified.mime_type, cacheControl: "0", upsert: false });
    if (uploaded.error) {
      // A previous identical request can have stored the bytes before losing its
      // response. Reconcile that exact immutable object; never overwrite/delete it.
      const existing = await bucket.download(reservation.storage_path);
      if (existing.error || !existing.data || hashImage(Buffer.from(await existing.data.arrayBuffer())) !== image.verified.sha256) {
        throw new Error("IMAGE_UPLOAD_PENDING");
      }
    }
    const finalizeArgs = { p_actor_id: actor, p_upload_id: reservation.upload_id, p_verified: image.verified } satisfies Database["public"]["Functions"]["content_visual_finalize_upload"]["Args"];
    const finalized = await storage.rpc("content_visual_finalize_upload", finalizeArgs);
    if (finalized.error) throw new Error(finalized.error.message);
    return visualResultSchema.parse(finalized.data);
  },
  async loadAsset(assetId: string) {
    z.string().uuid().parse(assetId);
    const { actor } = await authenticatedClient();
    const service = serviceClient();
    const args = { p_actor_id: actor, p_asset_id: assetId } satisfies Database["public"]["Functions"]["content_visual_asset_file"]["Args"];
    const lookup = await service.rpc("content_visual_asset_file", args);
    if (lookup.error) throw new Error(lookup.error.message);
    const file = z.object({ storage_path: z.string(), mime_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
      size_bytes: z.number().int().positive().max(8 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(lookup.data);
    assertPrivatePath(file.storage_path);
    const downloaded = await service.storage.from("content-working").download(file.storage_path);
    if (downloaded.error || !downloaded.data) throw new Error("NOT_FOUND");
    const bytes = await downloaded.data.arrayBuffer();
    if (bytes.byteLength !== file.size_bytes || hashImage(Buffer.from(bytes)) !== file.sha256) throw new Error("IMAGE_INVALID");
    return { bytes, mimeType: file.mime_type };
  },
};
