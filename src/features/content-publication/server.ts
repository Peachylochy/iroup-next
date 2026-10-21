import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { ContentVisual } from "@/features/content-visual/server";
import { hashImage } from "@/features/content-visual/image-validation";
import { z } from "zod";
import { publicationCommandSchema, publicationDetailSchema, publicationResultSchema, publicationVerifyResultSchema, verifyCommandSchema } from "./schema";
import type { PublicationCommand, VerifyCommand } from "./types";

export const ContentPublication = {
  async execute(input: PublicationCommand) {
    const command = publicationCommandSchema.parse(input);
    const client = await createClient();
    const args = { p_command: command } satisfies Database["public"]["Functions"]["content_publication_execute"]["Args"];
    const { data, error } = await client.rpc("content_publication_execute", args);
    if (error) throw new Error(error.message);
    return publicationResultSchema.parse(data);
  },
  async inspect(workItemId: string, bundleId: string | null = null) {
    const client = await createClient();
    const args = {
      p_work_item_id: z.string().uuid().parse(workItemId), p_bundle_id: z.string().uuid().nullable().parse(bundleId) ?? undefined,
    } satisfies Database["public"]["Functions"]["content_publication_inspect"]["Args"];
    const { data, error } = await client.rpc("content_publication_inspect", args);
    if (error) throw new Error(error.message);
    return publicationDetailSchema.parse(data);
  },
  async verify(input: VerifyCommand) {
    const command = verifyCommandSchema.parse(input);
    const before = await ContentPublication.inspect(command.work_item_id, command.bundle_id);
    const bundle = before.selected;
    if (!bundle || bundle.id !== command.bundle_id) throw new Error("NOT_FOUND");
    if (bundle.state !== "current") throw new Error("BUNDLE_STALE");
    // Sequential reads bound memory to one image. The existing private proxy
    // boundary reauthorizes every asset and verifies its registered hash/size.
    for (const image of bundle.payload.images) {
      const file = await ContentVisual.loadAsset(image.asset_id);
      if (file.mimeType !== image.mime_type || hashImage(Buffer.from(file.bytes)) !== image.sha256) throw new Error("IMAGE_INVALID");
    }
    const after = await ContentPublication.inspect(command.work_item_id, command.bundle_id);
    if (!after.selected || after.selected.state !== "current") throw new Error("BUNDLE_STALE");
    if (after.work_item.row_version !== before.work_item.row_version || after.selected.digest !== bundle.digest) throw new Error("STALE_REVISION");
    return publicationVerifyResultSchema.parse({ bundle_id: bundle.id, digest: bundle.digest,
      checked_at: new Date().toISOString(), checked_assets: bundle.payload.images.length });
  },
};
