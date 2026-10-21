import { createHash } from "node:crypto";
import sharp from "sharp";
import type { VerifiedImage } from "./types";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const hashImage = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const formats = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as const;
function detectFormat(bytes: Buffer): keyof typeof formats | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
function hasApng(bytes: Buffer) {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) throw new Error("IMAGE_INVALID");
    if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL") return true;
    offset += length + 12;
  }
  return false;
}
export async function validateManualImage(file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }, dimensions: { width: number; height: number }) {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error("IMAGE_SIZE");
  if (!file.name || file.name.length > 255 || /[/\\\x00-\x1f]/.test(file.name)) throw new Error("IMAGE_INVALID");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > MAX_IMAGE_BYTES) throw new Error("IMAGE_SIZE");
  const format = detectFormat(bytes);
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (!format || !({ png: ["png"], jpeg: ["jpg", "jpeg"], webp: ["webp"] }[format].includes(extension ?? ""))
    || (file.type && file.type !== formats[format])) throw new Error("IMAGE_INVALID");
  try {
    if (format === "png" && hasApng(bytes)) throw new Error("IMAGE_INVALID");
    const decoder = sharp(bytes, { limitInputPixels: 16000000, failOn: "warning", animated: false });
    const meta = await decoder.metadata();
    if (meta.format !== format || (meta.pages ?? 1) !== 1) throw new Error("IMAGE_INVALID");
    // Decode all pixels, orient consistently and strip embedded metadata. Store/hash
    // these exact normalized bytes; retain the upload hash as separate provenance.
    const { data, info } = await decoder.rotate().toColourspace("srgb").toFormat(format, { quality: 95 }).toBuffer({ resolveWithObject: true });
    if (info.width !== dimensions.width || info.height !== dimensions.height) throw new Error("IMAGE_DIMENSIONS");
    if (data.length > MAX_IMAGE_BYTES) throw new Error("IMAGE_SIZE");
    const verified: VerifiedImage = { original_file_name: file.name, mime_type: formats[format], size_bytes: data.length,
      width: info.width, height: info.height, sha256: hashImage(data), uploaded_sha256: hashImage(bytes), transform: "visual-raster-v1" };
    return { bytes: data, verified };
  } catch (error) {
    if (error instanceof Error && ["IMAGE_INVALID", "IMAGE_DIMENSIONS", "IMAGE_SIZE"].includes(error.message)) throw error;
    throw new Error("IMAGE_INVALID");
  }
}
