import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { videoEmbedUrl } from "@/lib/embeds";
import { NEW_ACCOUNT_REASON, canSeeResults, canViewPoll, isStaff, type Viewer } from "../auth/permissions";
import { db } from "../db/client";
import { ballotChoices, ballots, media, moderationEvents, pollAttachments, pollOptions, polls, reports, user } from "../db/schema";
import { mediaUrl } from "../media/storage";
import { voterKeyFor } from "./vote";

const isClosedSql = sql<boolean>`(${polls.closedAt} is not null or (${polls.closesAt} is not null and ${polls.closesAt} <= now()))`;

export type PollAttachmentView =
  | { kind: "image"; url: string; width: number; height: number }
  | { kind: "link"; url: string; title: string | null; host: string }
  | { kind: "video"; provider: "youtube" | "vimeo"; embedUrl: string };

export type PollView = Awaited<ReturnType<typeof getPollView>>;

export async function getPollView(pollId: string, viewer: Viewer | null, anonToken: string | null) {
  const [row] = await db()
    .select({
      id: polls.id,
      title: polls.title,
      descriptionMd: polls.descriptionMd,
      kind: polls.kind,
      maxChoices: polls.maxChoices,
      voterMode: polls.voterMode,
      resultsVisibility: polls.resultsVisibility,
      status: polls.status,
      statusNote: polls.statusNote,
      moderationReasons: polls.moderationReasons,
      closesAt: polls.closesAt,
      closedAt: polls.closedAt,
      isClosed: isClosedSql,
      ballotCount: polls.ballotCount,
      createdAt: polls.createdAt,
      publishedAt: polls.publishedAt,
      authorId: polls.authorId,
      authorName: user.name,
    })
    .from(polls)
    .leftJoin(user, eq(user.id, polls.authorId))
    .where(eq(polls.id, pollId));
  if (!row || !canViewPoll(viewer, row)) return null;

  const staff = isStaff(viewer);
  const isAuthor = Boolean(viewer && row.authorId === viewer.id);
  const voterKey = voterKeyFor(viewer, anonToken);

  const [options, attachments, mine, reported, events] = await Promise.all([
    db()
      .select({
        id: pollOptions.id,
        label: pollOptions.label,
        voteCount: pollOptions.voteCount,
        storageKey: media.storageKey,
        width: media.width,
        height: media.height,
      })
      .from(pollOptions)
      .leftJoin(media, eq(media.id, pollOptions.mediaId))
      .where(eq(pollOptions.pollId, pollId))
      .orderBy(asc(pollOptions.position)),
    db()
      .select({
        kind: pollAttachments.kind,
        url: pollAttachments.url,
        title: pollAttachments.title,
        videoProvider: pollAttachments.videoProvider,
        videoId: pollAttachments.videoId,
        storageKey: media.storageKey,
        width: media.width,
        height: media.height,
      })
      .from(pollAttachments)
      .leftJoin(media, eq(media.id, pollAttachments.mediaId))
      .where(eq(pollAttachments.pollId, pollId))
      .orderBy(asc(pollAttachments.position)),
    voterKey
      ? db()
          .select({ optionId: ballotChoices.optionId })
          .from(ballots)
          .innerJoin(ballotChoices, eq(ballotChoices.ballotId, ballots.id))
          .where(and(eq(ballots.pollId, pollId), eq(ballots.voterKey, voterKey)))
      : Promise.resolve([]),
    viewer
      ? db()
          .select({ id: reports.id })
          .from(reports)
          .where(and(eq(reports.pollId, pollId), eq(reports.reporterId, viewer.id)))
          .limit(1)
      : Promise.resolve([]),
    staff
      ? db()
          .select({
            source: moderationEvents.source,
            outcome: moderationEvents.outcome,
            reasons: moderationEvents.reasons,
            createdAt: moderationEvents.createdAt,
          })
          .from(moderationEvents)
          .where(eq(moderationEvents.pollId, pollId))
          .orderBy(desc(moderationEvents.createdAt))
          .limit(20)
      : Promise.resolve([]),
  ]);

  const myChoices = mine.map((m) => m.optionId);
  const resultsVisible = canSeeResults({
    visibility: row.resultsVisibility,
    isClosed: row.isClosed,
    hasVoted: myChoices.length > 0,
    isAuthor,
    isStaff: staff,
  });

  return {
    id: row.id,
    title: row.title,
    descriptionMd: row.descriptionMd,
    kind: row.kind,
    maxChoices: row.maxChoices,
    voterMode: row.voterMode,
    resultsVisibility: row.resultsVisibility,
    status: row.status,
    statusNote: isAuthor || staff ? row.statusNote : null,
    closesAt: row.closesAt?.toISOString() ?? null,
    isClosed: row.isClosed,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    author: row.authorId ? { id: row.authorId, name: row.authorName ?? "Unknown" } : null,
    // don't send the counts at all until the viewer is allowed to see them
    ballotCount: resultsVisible ? row.ballotCount : null,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: resultsVisible ? o.voteCount : null,
      image: o.storageKey ? { url: mediaUrl(o.storageKey), width: o.width!, height: o.height! } : null,
    })),
    attachments: attachments.flatMap((a): PollAttachmentView[] => {
      if (a.kind === "image") {
        return a.storageKey ? [{ kind: "image", url: mediaUrl(a.storageKey), width: a.width!, height: a.height! }] : [];
      }
      if (a.kind === "link" && a.url) return [{ kind: "link", url: a.url, title: a.title, host: new URL(a.url).hostname }];
      if (a.kind === "video" && a.videoProvider && a.videoId) {
        const ref = { provider: a.videoProvider, id: a.videoId };
        return [{ kind: "video", provider: a.videoProvider, embedUrl: videoEmbedUrl(ref) }];
      }
      return [];
    }),
    myChoices,
    resultsVisible,
    // held only because the author's account is new, so it will be released
    heldForNewAccount:
      (isAuthor || staff) &&
      row.status === "pending_review" &&
      row.moderationReasons.length === 1 &&
      row.moderationReasons[0] === NEW_ACCOUNT_REASON,
    isAuthor,
    isStaff: staff,
    hasReported: reported.length > 0,
    moderation: staff
      ? {
          reasons: row.moderationReasons,
          events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
        }
      : null,
  };
}

export type FeedSort = "new" | "trending" | "closing";
export type FeedState = "open" | "closed" | "all";
export const FEED_PAGE_SIZE = 20;

export async function listPublishedPolls(opts: { sort: FeedSort; state: FeedState; q?: string; page: number }) {
  const where: SQL[] = [eq(polls.status, "published")];
  if (opts.state === "open" || opts.sort === "closing") where.push(sql`not ${isClosedSql}`);
  if (opts.state === "closed") where.push(isClosedSql);
  if (opts.sort === "closing") where.push(sql`${polls.closesAt} is not null`);
  if (opts.sort === "trending") where.push(sql`${polls.publishedAt} > now() - interval '30 days'`);
  const q = opts.q?.trim().slice(0, 100);
  if (q) where.push(sql`${polls.search} @@ websearch_to_tsquery('english', ${q})`);

  const order =
    opts.sort === "closing"
      ? [asc(polls.closesAt)]
      : opts.sort === "trending"
        ? // votes decayed by age, roughly like HN
          [desc(sql`${polls.ballotCount} / power(extract(epoch from (now() - ${polls.publishedAt})) / 3600 + 2, 1.5)`), desc(polls.publishedAt)]
        : [desc(polls.publishedAt)];

  const rows = await db()
    .select({
      id: polls.id,
      title: polls.title,
      kind: polls.kind,
      voterMode: polls.voterMode,
      closesAt: polls.closesAt,
      isClosed: isClosedSql,
      ballotCount: polls.ballotCount,
      publishedAt: polls.publishedAt,
      authorName: user.name,
      // plain SQL with aliases, same reason as in admin/queries.ts
      optionCount: sql<number>`(select count(*)::int from poll_options o where o.poll_id = "polls"."id")`,
      optionPreview: sql<string[]>`(select coalesce(array_agg(t.label order by t.position), '{}') from (select label, position from poll_options o where o.poll_id = "polls"."id" order by position limit 3) t)`,
    })
    .from(polls)
    .leftJoin(user, eq(user.id, polls.authorId))
    .where(and(...where))
    .orderBy(...order)
    .limit(FEED_PAGE_SIZE + 1)
    .offset(Math.min(opts.page, 50) * FEED_PAGE_SIZE);

  return {
    polls: rows.slice(0, FEED_PAGE_SIZE).map((r) => ({
      ...r,
      closesAt: r.closesAt?.toISOString() ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    })),
    hasMore: rows.length > FEED_PAGE_SIZE,
  };
}

export async function listPollsByAuthor(authorId: string) {
  const rows = await db()
    .select({
      id: polls.id,
      title: polls.title,
      status: polls.status,
      statusNote: polls.statusNote,
      isClosed: isClosedSql,
      ballotCount: polls.ballotCount,
      createdAt: polls.createdAt,
    })
    .from(polls)
    .where(eq(polls.authorId, authorId))
    .orderBy(desc(polls.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// For link preview images: published polls only, and no vote counts.
export async function getPublicPollPreview(pollId: string) {
  const poll = await db().query.polls.findFirst({
    where: and(eq(polls.id, pollId), eq(polls.status, "published")),
    columns: { title: true },
  });
  if (!poll) return null;
  const options = await db()
    .select({ label: pollOptions.label })
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(asc(pollOptions.position));
  return { title: poll.title, options: options.slice(0, 4).map((o) => o.label), optionCount: options.length };
}
