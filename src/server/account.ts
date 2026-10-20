import { eq } from "drizzle-orm";
import { z } from "zod";
import { cleanLine } from "@/lib/validation";
import type { Viewer } from "./auth/permissions";
import { db } from "./db/client";
import { user } from "./db/schema";
import { AppError } from "./errors";
import { hasProfanity } from "./moderation/rules";
import { enforceRateLimit, RATE_LIMITS } from "./security/rate-limit";

const nameInput = z.string().max(200).transform(cleanLine).pipe(z.string().min(2, "Use at least 2 characters.").max(60, "Keep it under 60 characters."));

// Display names are shown on every poll, so they get the profanity check too.
export async function renameAccount(viewer: Viewer, input: unknown) {
  const parsed = nameInput.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Enter a name.");
  if (hasProfanity(parsed.data)) throw new AppError("Please choose a different name.");
  await enforceRateLimit(`rename:${viewer.id}`, RATE_LIMITS.renameAccount);
  await db().update(user).set({ name: parsed.data }).where(eq(user.id, viewer.id));
  return parsed.data;
}
