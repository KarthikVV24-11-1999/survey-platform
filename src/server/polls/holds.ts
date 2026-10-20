import { and, eq, sql } from "drizzle-orm";
import { NEW_ACCOUNT_REASON } from "../auth/permissions";
import { db } from "../db/client";
import { moderationEvents, polls } from "../db/schema";
import { getSettings } from "../settings";

// Polls held only because the account was new go live once the account is old
// enough. Anything else that was flagged, or a report, keeps them in the queue.
// Runs from the daily cron, when staff open the queue, and when the author
// looks at their polls.
export async function releaseNewAccountHolds(scope: { authorId?: string; pollId?: string } = {}) {
  const settings = await getSettings();
  if (settings.postingPolicy !== "open") return 0;

  return db().transaction(async (tx) => {
    const released = await tx
      .update(polls)
      .set({ status: "published", publishedAt: sql`coalesce(${polls.publishedAt}, now())`, statusNote: null })
      .where(
        and(
          eq(polls.status, "pending_review"),
          eq(polls.reportCount, 0),
          sql`${polls.moderationReasons} = ${JSON.stringify([NEW_ACCOUNT_REASON])}::jsonb`,
          sql`exists (
            select 1 from users u
            where u.id = "polls"."author_id" and not u.banned and u.trust_level <> 'restricted'
              and u.created_at <= now() - make_interval(hours => ${settings.newAccountReviewHours})
          )`,
          scope.authorId ? eq(polls.authorId, scope.authorId) : undefined,
          scope.pollId ? eq(polls.id, scope.pollId) : undefined,
        ),
      )
      .returning({ id: polls.id });
    if (released.length) {
      await tx
        .insert(moderationEvents)
        .values(released.map((p) => ({ pollId: p.id, source: "auto" as const, outcome: "publish" as const, reasons: ["New account period ended"] })));
    }
    return released.length;
  });
}
