import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { parseVideoUrl, videoWatchUrl, type VideoRef } from "@/lib/embeds";
import { createPollInput, fieldErrors, validateDeadline } from "@/lib/validation";
import { isStaff, postingDecision, type Viewer } from "../auth/permissions";
import { db } from "../db/client";
import { media, moderationEvents, pollAttachments, pollOptions, polls } from "../db/schema";
import { AppError } from "../errors";
import { moderatePoll } from "../moderation";
import { extractUrls } from "../moderation/rules";
import { enforceRateLimit, RATE_LIMITS } from "../security/rate-limit";
import { verifyTurnstile } from "../security/turnstile";
import { getSettings } from "../settings";

export type CreatePollResult = { id: string; status: "published" | "pending_review" | "rejected" };

const REJECTED_NOTE = "This poll appears to break the content policy, so it was not published.";
const IMAGE_GONE = "One of your images is no longer available. Please upload it again.";

export async function createPoll(viewer: Viewer, raw: unknown, ctx: { ip: string | null }): Promise<CreatePollResult> {
  const parsed = createPollInput.safeParse(raw);
  if (!parsed.success) throw new AppError("Please fix the highlighted fields.", "invalid", fieldErrors(parsed.error));
  const input = parsed.data;
  const now = new Date();

  const deadlineError = validateDeadline(input.closesAt, now);
  if (deadlineError) throw new AppError(deadlineError, "invalid", { closesAt: deadlineError });

  const settings = await getSettings();
  const posting = postingDecision(viewer, settings, now);
  if (!posting.allowed) throw new AppError(posting.reason, "forbidden");
  if (input.voterMode === "anonymous_allowed" && !settings.allowAnonymousPolls) {
    const message = "Anonymous voting is turned off on this site.";
    throw new AppError(message, "invalid", { voterMode: message });
  }

  await verifyTurnstile(input.turnstileToken, "create-poll", ctx.ip);
  await enforceRateLimit(`poll:create:${viewer.id}`, RATE_LIMITS.createPoll);

  if (!isStaff(viewer)) {
    const [{ recent }] = await db()
      .select({ recent: sql<number>`count(*)::int` })
      .from(polls)
      .where(and(eq(polls.authorId, viewer.id), gt(polls.createdAt, sql`now() - interval '24 hours'`)));
    if (recent >= settings.maxPollsPerDay) {
      throw new AppError(`You can post up to ${settings.maxPollsPerDay} polls per day.`, "rate_limited");
    }
    const duplicate = await db()
      .select({ id: polls.id })
      .from(polls)
      .where(
        and(
          eq(polls.authorId, viewer.id),
          sql`lower(${polls.title}) = lower(${input.title})`,
          gt(polls.createdAt, sql`now() - interval '24 hours'`),
        ),
      )
      .limit(1);
    if (duplicate.length) throw new AppError("You've already posted this question recently.", "conflict");
  }

  // images must be the author's own unused uploads
  const mediaRefs = [
    ...input.options.map((o) => o.mediaId).filter((id): id is string => Boolean(id)),
    ...input.attachments.flatMap((a) => (a.kind === "image" ? [a.mediaId] : [])),
  ];
  const mediaIds = [...new Set(mediaRefs)];
  if (mediaIds.length !== mediaRefs.length) throw new AppError("Each image can only be used once.");
  const mediaRows = mediaIds.length
    ? await db()
        .select({ id: media.id, moderation: media.moderation })
        .from(media)
        .where(and(inArray(media.id, mediaIds), eq(media.ownerId, viewer.id), isNull(media.pollId), eq(media.status, "active")))
    : [];
  if (mediaRows.length !== mediaIds.length) throw new AppError(IMAGE_GONE);

  const videos: (VideoRef & { position: number })[] = [];
  input.attachments.forEach((a, position) => {
    if (a.kind === "video") videos.push({ ...parseVideoUrl(a.url)!, position });
  });
  const links = input.attachments.flatMap((a) => (a.kind === "link" ? [a] : []));

  const verdict = await moderatePoll({
    content: {
      title: input.title,
      description: input.description,
      options: input.options.map((o) => o.label),
      linkTitles: links.map((l) => l.title ?? "").filter(Boolean),
      urls: [...links.map((l) => l.url), ...videos.map(videoWatchUrl), ...extractUrls(input.description)],
    },
    images: mediaRows.map((m) => m.moderation),
    videos,
    forceReview: posting.forceReview ? posting.reviewReason : undefined,
    settings,
  });
  const status = verdict.outcome === "publish" ? "published" : verdict.outcome === "review" ? "pending_review" : "rejected";

  const id = await db().transaction(async (tx) => {
    const [poll] = await tx
      .insert(polls)
      .values({
        authorId: viewer.id,
        title: input.title,
        descriptionMd: input.description,
        kind: input.kind,
        maxChoices: input.maxChoices,
        voterMode: input.voterMode,
        resultsVisibility: input.resultsVisibility,
        status,
        moderationReasons: verdict.reasons,
        statusNote: status === "rejected" ? REJECTED_NOTE : null,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        publishedAt: status === "published" ? sql`now()` : null,
      })
      .returning({ id: polls.id });

    await tx.insert(pollOptions).values(
      input.options.map((o, position) => ({ pollId: poll.id, position, label: o.label, mediaId: o.mediaId })),
    );

    if (input.attachments.length) {
      await tx.insert(pollAttachments).values(
        input.attachments.map((a, position) => {
          if (a.kind === "image") return { pollId: poll.id, position, kind: a.kind, mediaId: a.mediaId };
          if (a.kind === "link") return { pollId: poll.id, position, kind: a.kind, url: a.url, title: a.title || null };
          const video = parseVideoUrl(a.url)!;
          return { pollId: poll.id, position, kind: a.kind, videoProvider: video.provider, videoId: video.id };
        }),
      );
    }

    if (mediaIds.length) {
      const attached = await tx
        .update(media)
        .set({ pollId: poll.id, status: status === "rejected" ? "blocked" : "active" })
        .where(and(inArray(media.id, mediaIds), eq(media.ownerId, viewer.id), isNull(media.pollId)))
        .returning({ id: media.id });
      // cleaned up in the meantime, so roll back
      if (attached.length !== mediaIds.length) throw new AppError(IMAGE_GONE);
    }

    await tx.insert(moderationEvents).values({
      pollId: poll.id,
      source: "auto",
      outcome: verdict.outcome,
      reasons: verdict.reasons,
      scores: verdict.scores,
    });
    return poll.id;
  });

  return { id, status };
}
