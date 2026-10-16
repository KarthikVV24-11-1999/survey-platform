import { randomUUID } from "node:crypto";
import { and, inArray, isNull, lt, sql } from "drizzle-orm";
import { postingDecision, type Viewer } from "../auth/permissions";
import { db } from "../db/client";
import { media } from "../db/schema";
import { AppError } from "../errors";
import { imageIsBlocked, moderateImage } from "../moderation";
import { enforceRateLimit, RATE_LIMITS } from "../security/rate-limit";
import { getSettings } from "../settings";
import { processImage } from "./images";
import { mediaUrl, storage } from "./storage";

export type UploadedImage = { id: string; url: string; width: number; height: number; flagged: boolean };

export async function uploadImage(viewer: Viewer, bytes: Buffer): Promise<UploadedImage> {
  const settings = await getSettings();
  const posting = postingDecision(viewer, settings, new Date());
  if (!posting.allowed) throw new AppError(posting.reason, "forbidden");
  await enforceRateLimit(`upload:${viewer.id}`, RATE_LIMITS.upload);

  const image = await processImage(bytes);
  const verdict = await moderateImage(image.preview);
  if (imageIsBlocked(verdict, settings)) {
    console.warn("[media] blocked image upload", { userId: viewer.id, categories: verdict.categories });
    throw new AppError("This image can't be used because it appears to violate the content policy.");
  }

  const id = randomUUID();
  const storageKey = `img/${id}.webp`;
  await storage().put(storageKey, image.webp, "image/webp");
  try {
    await db().insert(media).values({
      id,
      ownerId: viewer.id,
      storageKey,
      mime: "image/webp",
      width: image.width,
      height: image.height,
      bytes: image.webp.byteLength,
      sha256: image.sha256,
      moderation: verdict,
    });
  } catch (err) {
    await storage().delete(storageKey).catch(() => {});
    throw err;
  }
  return { id, url: mediaUrl(storageKey), width: image.width, height: image.height, flagged: verdict.flagged };
}

export async function deleteOrphanMedia(olderThanHours = 24, batch = 200) {
  const candidates = await db()
    .select({ id: media.id })
    .from(media)
    .where(and(isNull(media.pollId), lt(media.createdAt, sql`now() - make_interval(hours => ${olderThanHours})`)))
    .limit(batch);
  if (!candidates.length) return 0;
  // check poll_id again in case an image was attached in the meantime
  const deleted = await db()
    .delete(media)
    .where(and(inArray(media.id, candidates.map((c) => c.id)), isNull(media.pollId)))
    .returning({ storageKey: media.storageKey });
  for (const row of deleted) {
    await storage().delete(row.storageKey);
  }
  return deleted.length;
}
