// @vitest-environment node
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { hashImage, MAX_IMAGE_BYTES, validateManualImage } from "./image-validation";

const picture = () => sharp({ create: { width: 128, height: 96, channels: 3, background: "#604090" } });
const file = (bytes: Buffer, name = "picture.png", type = "image/png") => ({ name, type, size: bytes.length,
  arrayBuffer: async () => Uint8Array.from(bytes).buffer });

describe("manual raster verification", () => {
  it.each(["png", "jpeg", "webp"] as const)("fully decodes, normalizes and hashes %s bytes", async (format) => {
    const original = await picture().toFormat(format).toBuffer();
    const result = await validateManualImage(file(original, `picture.${format === "jpeg" ? "jpg" : format}`, `image/${format}`), { width: 128, height: 96 });
    const actual = await sharp(result.bytes).metadata();
    expect(actual).toMatchObject({ format, width: 128, height: 96 });
    expect(result.verified).toMatchObject({ width: 128, height: 96, sha256: hashImage(result.bytes), uploaded_sha256: hashImage(original), size_bytes: result.bytes.length, transform: "visual-raster-v1" });
  });
  it("applies EXIF orientation and strips metadata before observing dimensions", async () => {
    const original = await picture().jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await validateManualImage(file(original, "photo.jpg", "image/jpeg"), { width: 96, height: 128 });
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(result.verified).toMatchObject({ width: 96, height: 128 });
  });
  it("rejects an otherwise valid image whose dimensions do not match its approved brief", async () => {
    await expect(validateManualImage(file(await picture().png().toBuffer()), { width: 128, height: 128 })).rejects.toThrow("IMAGE_DIMENSIONS");
  });
  it.each([["fake.jpg", "image/jpeg"], ["fake.png", "image/jpeg"], ["../fake.png", "image/png"], ["a\\fake.png", "image/png"]])("rejects extension/MIME/path mismatch %s", async (name, mime) => {
    await expect(validateManualImage(file(await picture().png().toBuffer(), name, mime), { width: 128, height: 96 })).rejects.toThrow("IMAGE_INVALID");
  });
  it("does not treat an SVG or a truncated signature as a raster", async () => {
    for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), (await picture().png().toBuffer()).subarray(0, 30)]) {
      await expect(validateManualImage(file(bytes), { width: 128, height: 96 })).rejects.toThrow("IMAGE_INVALID");
    }
  });
  it("rejects APNG animation control before decode", async () => {
    const original = await picture().png().toBuffer();
    const marker = Buffer.alloc(12); marker.write("acTL", 4, "ascii");
    const apng = Buffer.concat([original.subarray(0, 8), marker, original.subarray(8)]);
    await expect(validateManualImage(file(apng), { width: 128, height: 96 })).rejects.toThrow("IMAGE_INVALID");
  });
  it("enforces file size before reading bytes", async () => {
    await expect(validateManualImage({ name: "x.png", type: "image/png", size: MAX_IMAGE_BYTES + 1, arrayBuffer: async () => { throw new Error("must not read"); } }, { width: 128, height: 96 })).rejects.toThrow("IMAGE_SIZE");
  });
  it("rejects a compressed image beyond the decoded pixel limit", async () => {
    const huge = await sharp({ create: { width: 4096, height: 4096, channels: 3, background: "white" } }).png().toBuffer();
    await expect(validateManualImage(file(huge), { width: 4096, height: 4096 })).rejects.toThrow("IMAGE_INVALID");
  });
});
