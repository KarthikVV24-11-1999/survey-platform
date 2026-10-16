import { createHash } from "node:crypto";
import sharp from "sharp";
import { LIMITS } from "@/lib/validation";
import { AppError } from "../errors";

// The format comes from the file contents, not the name or MIME type. No SVG.
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif"]);
const MAX_INPUT_PIXELS = 40_000_000; // guards against decompression bombs
const MAX_DIMENSION = 2048;

export type ProcessedImage = {
  webp: Buffer;
  width: number;
  height: number;
  sha256: string;
  // small jpeg for the moderation check
  preview: string;
};

// Re-encoding drops EXIF/GPS data and anything else that isn't pixels.
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new AppError("The file is empty.");
  if (input.byteLength > LIMITS.imageMaxBytes) throw new AppError("Images must be 4 MB or smaller.");

  let format: string | undefined;
  try {
    const meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    format = meta.format;
  } catch {
    throw new AppError("That file isn't a supported image.");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new AppError("Upload a JPEG, PNG, WebP, GIF or AVIF image.");
  }

  try {
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", animated: false })
      .rotate() // apply EXIF orientation before it's stripped
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });

    const { data: webp, info } = await base.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const preview = await base
      .clone()
      .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    return {
      webp,
      width: info.width,
      height: info.height,
      sha256: createHash("sha256").update(webp).digest("hex"),
      preview: `data:image/jpeg;base64,${preview.toString("base64")}`,
    };
  } catch {
    throw new AppError("That image couldn't be processed. Try a different file.");
  }
}
