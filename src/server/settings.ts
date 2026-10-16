import { eq } from "drizzle-orm";
import { z } from "zod";
import { type Executor, db } from "./db/client";
import { siteSettings } from "./db/schema";

export const settingsSchema = z.object({
  // open: clean polls go live, review_all: non-trusted users go to review,
  // trusted_only: only trusted users and staff can post
  postingPolicy: z.enum(["open", "review_all", "trusted_only"]).default("open"),
  newAccountReviewHours: z.number().int().min(0).max(720).default(24),
  maxPollsPerDay: z.number().int().min(1).max(100).default(5),
  allowAnonymousPolls: z.boolean().default(true),
  // per poll, per (hashed) IP
  anonymousVotesPerIp: z.number().int().min(1).max(100).default(3),
  // reports from different users before a poll is hidden
  reportThreshold: z.number().int().min(1).max(100).default(3),
  aiReviewThreshold: z.number().min(0.05).max(1).default(0.4),
  aiRejectThreshold: z.number().min(0.05).max(1).default(0.85),
  // when false, polls wait for review if the moderation API is down
  publishWhenAiUnavailable: z.boolean().default(false),
  reviewProfanity: z.boolean().default(true),
});

export type SiteSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: SiteSettings = settingsSchema.parse({});

const CACHE_MS = 10_000;
let cache: { value: SiteSettings; at: number } | undefined;

export async function getSettings(executor: Executor = db()): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const row = await executor.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  // fall back to defaults if the stored row is invalid
  const parsed = settingsSchema.safeParse(row?.data ?? {});
  const value = parsed.success ? parsed.data : defaultSettings;
  cache = { value, at: Date.now() };
  return value;
}

export async function saveSettings(executor: Executor, next: SiteSettings, actorId: string) {
  const value = settingsSchema.parse(next);
  await executor
    .insert(siteSettings)
    .values({ id: 1, data: value, updatedById: actorId })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { data: value, updatedById: actorId, updatedAt: new Date() },
    });
  cache = undefined;
  return value;
}

export function clearSettingsCache() {
  cache = undefined;
}
