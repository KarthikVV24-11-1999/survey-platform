import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { fieldErrors, reportInput } from "@/lib/validation";
import { audit } from "../audit";
import { canManagePoll, isStaff, type Viewer } from "../auth/permissions";
import { type Tx, db } from "../db/client";
import { media, moderationEvents, polls, reports } from "../db/schema";
import { AppError } from "../errors";
import { enforceRateLimit, RATE_LIMITS } from "../security/rate-limit";
import { getSettings } from "../settings";

type PollStatus = "pending_review" | "published" | "rejected" | "removed";

const NOT_FOUND = () => new AppError("Poll not found.", "not_found");

async function loadForManagement(pollId: string) {
  const poll = await db().query.polls.findFirst({
    where: eq(polls.id, pollId),
    columns: { id: true, authorId: true, status: true },
  });
  if (!poll) throw NOT_FOUND();
  return poll;
}

async function syncMediaVisibility(tx: Tx, pollId: string, status: PollStatus) {
  const hidden = status === "rejected" || status === "removed";
  await tx.update(media).set({ status: hidden ? "blocked" : "active" }).where(eq(media.pollId, pollId));
}

// fails if someone else changed the status first
async function transition(
  tx: Tx,
  pollId: string,
  from: PollStatus[],
  to: PollStatus,
  extra: { statusNote?: string | null; moderationReasons?: string[] } = {},
) {
  const updated = await tx
    .update(polls)
    .set({
      status: to,
      ...extra,
      ...(to === "published" ? { publishedAt: sql`coalesce(${polls.publishedAt}, now())`, statusNote: null } : {}),
    })
    .where(and(eq(polls.id, pollId), inArray(polls.status, from)))
    .returning({ id: polls.id });
  if (!updated.length) throw new AppError("This poll was changed by someone else. Refresh and try again.", "conflict");
  await syncMediaVisibility(tx, pollId, to);
}

async function closeReports(tx: Tx, pollId: string, actorId: string, status: "resolved" | "dismissed") {
  await tx
    .update(reports)
    .set({ status, resolvedById: actorId, resolvedAt: new Date() })
    .where(and(eq(reports.pollId, pollId), eq(reports.status, "open")));
}

// Authors

export async function closePoll(viewer: Viewer, pollId: string) {
  const poll = await loadForManagement(pollId);
  if (!canManagePoll(viewer, poll)) throw NOT_FOUND();
  await db().transaction(async (tx) => {
    const updated = await tx
      .update(polls)
      .set({ closedAt: sql`now()` })
      .where(and(eq(polls.id, pollId), isNull(polls.closedAt), sql`(${polls.closesAt} is null or ${polls.closesAt} > now())`))
      .returning({ id: polls.id });
    if (!updated.length) throw new AppError("Voting is already closed.", "conflict");
    if (isStaff(viewer) && poll.authorId !== viewer.id) {
      await tx.insert(moderationEvents).values({ pollId, source: "moderator", outcome: "close", actorId: viewer.id });
      await audit(tx, viewer, "poll.close", { type: "poll", id: pollId });
    }
  });
}

// Rejected and removed polls are kept for the moderation history.
export async function deleteOwnPoll(viewer: Viewer, pollId: string) {
  const poll = await loadForManagement(pollId);
  if (poll.authorId !== viewer.id) throw NOT_FOUND();
  const deleted = await db()
    .delete(polls)
    .where(and(eq(polls.id, pollId), eq(polls.authorId, viewer.id), inArray(polls.status, ["published", "pending_review"])))
    .returning({ id: polls.id });
  if (!deleted.length) throw new AppError("This poll was moderated and can't be deleted.", "conflict");
  // its images get picked up by the daily cleanup
}

export async function reportPoll(viewer: Viewer, raw: unknown) {
  const parsed = reportInput.safeParse(raw);
  if (!parsed.success) throw new AppError("Please choose a reason.", "invalid", fieldErrors(parsed.error));
  const { pollId, reason, details } = parsed.data;

  const poll = await loadForManagement(pollId);
  if (poll.status !== "published") throw NOT_FOUND();
  if (poll.authorId === viewer.id) throw new AppError("You can't report your own poll.");
  await enforceRateLimit(`report:${viewer.id}`, RATE_LIMITS.report);
  const settings = await getSettings();

  return db().transaction(async (tx) => {
    const inserted = await tx
      .insert(reports)
      .values({ pollId, reporterId: viewer.id, reason, details: details || null })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (!inserted.length) return { alreadyReported: true, hidden: false };

    await tx.update(polls).set({ reportCount: sql`${polls.reportCount} + 1` }).where(eq(polls.id, pollId));
    const [{ open }] = await tx
      .select({ open: sql<number>`count(*)::int` })
      .from(reports)
      .where(and(eq(reports.pollId, pollId), eq(reports.status, "open")));

    if (open < settings.reportThreshold) return { alreadyReported: false, hidden: false };

    const hideReason = `Hidden automatically after ${open} reports`;
    const hidden = await tx
      .update(polls)
      .set({ status: "pending_review", moderationReasons: sql`${polls.moderationReasons} || ${JSON.stringify([hideReason])}::jsonb` })
      .where(and(eq(polls.id, pollId), eq(polls.status, "published")))
      .returning({ id: polls.id });
    if (hidden.length) {
      await tx.insert(moderationEvents).values({ pollId, source: "reports", outcome: "review", reasons: [hideReason] });
    }
    return { alreadyReported: false, hidden: hidden.length > 0 };
  });
}

// Staff

export type StaffPollAction = "approve" | "reject" | "remove" | "restore";

const ALLOWED_FROM: Record<StaffPollAction, PollStatus[]> = {
  approve: ["pending_review", "rejected"],
  reject: ["pending_review"],
  remove: ["published", "pending_review"],
  restore: ["removed"],
};
const TARGET: Record<StaffPollAction, PollStatus> = {
  approve: "published",
  reject: "rejected",
  remove: "removed",
  restore: "published",
};
const DEFAULT_NOTE: Partial<Record<StaffPollAction, string>> = {
  reject: "A moderator reviewed this poll and decided not to publish it.",
  remove: "A moderator removed this poll for breaking the content policy.",
};

export async function moderatePollAction(staff: Viewer, pollId: string, action: StaffPollAction, note?: string) {
  if (!isStaff(staff)) throw new AppError("You don't have permission to do that.", "forbidden");
  await enforceRateLimit(`staff:${staff.id}`, RATE_LIMITS.staffAction);
  const cleanNote = note?.trim().slice(0, 500) || DEFAULT_NOTE[action] || null;

  await db().transaction(async (tx) => {
    await transition(tx, pollId, ALLOWED_FROM[action], TARGET[action], {
      ...(action === "reject" || action === "remove" ? { statusNote: cleanNote } : {}),
    });
    // approve/restore dismisses the reports, reject/remove resolves them
    await closeReports(tx, pollId, staff.id, action === "approve" || action === "restore" ? "dismissed" : "resolved");
    await tx.insert(moderationEvents).values({
      pollId,
      source: "moderator",
      outcome: action,
      actorId: staff.id,
      reasons: cleanNote && (action === "reject" || action === "remove") ? [cleanNote] : [],
    });
    await audit(tx, staff, `poll.${action}`, { type: "poll", id: pollId }, cleanNote ? { note: cleanNote } : {});
  });
}

export async function dismissReports(staff: Viewer, pollId: string) {
  if (!isStaff(staff)) throw new AppError("You don't have permission to do that.", "forbidden");
  await db().transaction(async (tx) => {
    await closeReports(tx, pollId, staff.id, "dismissed");
    await audit(tx, staff, "report.dismiss", { type: "poll", id: pollId });
  });
}
