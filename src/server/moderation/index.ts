import { asc } from "drizzle-orm";
import { videoThumbnailUrl, type VideoRef } from "@/lib/embeds";
import { db } from "../db/client";
import { type MediaModeration, moderationTerms } from "../db/schema";
import type { SiteSettings } from "../settings";
import { type AiResult, mergeResults, moderate } from "./ai";
import { type Decision, decide } from "./decide";
import { type ContentToCheck, type ModerationTerm, runRules } from "./rules";

export type { AiResult, Decision, ModerationTerm };

const TERMS_CACHE_MS = 30_000;
let termsCache: { value: ModerationTerm[]; at: number } | undefined;

export async function getModerationTerms(): Promise<ModerationTerm[]> {
  if (termsCache && Date.now() - termsCache.at < TERMS_CACHE_MS) return termsCache.value;
  const rows = await db()
    .select({ kind: moderationTerms.kind, value: moderationTerms.value, action: moderationTerms.action })
    .from(moderationTerms)
    .orderBy(asc(moderationTerms.createdAt));
  termsCache = { value: rows, at: Date.now() };
  return rows;
}

export function clearTermsCache() {
  termsCache = undefined;
}

function withImageVerdicts(text: AiResult, images: MediaModeration[]): AiResult {
  if (!text.available) return text;
  if (images.some((m) => !m.available)) return { available: false, reason: "An image could not be checked" };
  return mergeResults([
    { flagged: text.flagged, categories: Object.fromEntries(text.categories.map((c) => [c, true])), category_scores: text.scores },
    ...images.map((m) => ({
      flagged: m.flagged,
      categories: Object.fromEntries(m.categories.map((c) => [c, true])),
      category_scores: m.scores,
    })),
  ]);
}

export async function moderatePoll(args: {
  content: ContentToCheck;
  images: MediaModeration[];
  videos: VideoRef[];
  forceReview?: string;
  settings: SiteSettings;
}): Promise<Decision & { scores: Record<string, number> }> {
  const terms = await getModerationTerms();
  const rules = runRules(args.content, terms, { profanity: args.settings.reviewProfanity });

  // no need to call the API for a blocked term
  if (rules.block.length) return { ...decide({ rules, ai: { available: false, reason: "skipped" }, settings: args.settings }), scores: {} };

  const text = [args.content.title, args.content.description, ...args.content.options, ...args.content.linkTitles]
    .filter(Boolean)
    .join("\n");
  const thumbnails = args.videos.map(videoThumbnailUrl).filter((u): u is string => Boolean(u));
  const ai = withImageVerdicts(
    await moderate([{ kind: "text", text }, ...thumbnails.map((url) => ({ kind: "image" as const, url }))]),
    args.images,
  );
  const decision = decide({ rules, ai, forceReview: args.forceReview, settings: args.settings });
  return { ...decision, scores: ai.available ? ai.scores : {} };
}

export async function moderateImage(dataUrl: string): Promise<MediaModeration> {
  const ai = await moderate([{ kind: "image", url: dataUrl }]);
  return ai.available
    ? { available: true, flagged: ai.flagged, categories: ai.categories, scores: ai.scores }
    : { available: false, flagged: false, categories: [], scores: {} };
}

// clearly bad images are refused at upload and never stored
export function imageIsBlocked(m: MediaModeration, settings: Pick<SiteSettings, "aiRejectThreshold">) {
  if (!m.available) return false;
  if ((m.scores["sexual/minors"] ?? 0) >= 0.2 || m.categories.includes("sexual/minors")) return true;
  return ["sexual", "violence/graphic", "self-harm/instructions"].some((c) => (m.scores[c] ?? 0) >= settings.aiRejectThreshold);
}
