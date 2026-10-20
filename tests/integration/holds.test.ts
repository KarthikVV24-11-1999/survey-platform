import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { NEW_ACCOUNT_REASON } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { moderationEvents, polls } from "@/server/db/schema";
import { releaseNewAccountHolds } from "@/server/polls/holds";
import { makePoll, makeUser, setSettings } from "./helpers";

async function heldPoll(authorId: string, reasons = [NEW_ACCOUNT_REASON]) {
  const poll = await makePoll({ authorId, status: "pending_review" });
  await db().update(polls).set({ moderationReasons: reasons }).where(eq(polls.id, poll.id));
  return poll.id;
}

async function statusOf(id: string) {
  const row = await db().query.polls.findFirst({ where: eq(polls.id, id), columns: { status: true } });
  return row?.status;
}

describe("new account holds", () => {
  it("publishes held polls once the account is old enough", async () => {
    const fresh = await makeUser({ ageHours: 2 });
    const older = await makeUser({ ageHours: 30 });
    const waiting = await heldPoll(fresh.id);
    const ready = await heldPoll(older.id);

    expect(await releaseNewAccountHolds()).toBe(1);
    expect(await statusOf(waiting)).toBe("pending_review");
    expect(await statusOf(ready)).toBe("published");
    const events = await db()
      .select()
      .from(moderationEvents)
      .where(and(eq(moderationEvents.pollId, ready), eq(moderationEvents.outcome, "publish")));
    expect(events).toHaveLength(1);
  });

  it("keeps polls that were also flagged, reported, or whose author is restricted", async () => {
    const author = await makeUser({ ageHours: 30 });
    const restricted = await makeUser({ ageHours: 30, trust: "restricted" });
    const flagged = await heldPoll(author.id, [NEW_ACCOUNT_REASON, "Profanity"]);
    const reported = await heldPoll(author.id);
    await db().update(polls).set({ reportCount: 1 }).where(eq(polls.id, reported));
    const blocked = await heldPoll(restricted.id);

    expect(await releaseNewAccountHolds()).toBe(0);
    for (const id of [flagged, reported, blocked]) expect(await statusOf(id)).toBe("pending_review");
  });

  it("only releases the given author's polls when scoped", async () => {
    const a = await makeUser({ ageHours: 30 });
    const b = await makeUser({ ageHours: 30 });
    const mine = await heldPoll(a.id);
    const theirs = await heldPoll(b.id);

    expect(await releaseNewAccountHolds({ authorId: a.id })).toBe(1);
    expect(await statusOf(mine)).toBe("published");
    expect(await statusOf(theirs)).toBe("pending_review");
  });

  it("leaves everything for moderators when every poll is reviewed", async () => {
    await setSettings({ postingPolicy: "review_all" });
    const author = await makeUser({ ageHours: 30 });
    const id = await heldPoll(author.id);

    expect(await releaseNewAccountHolds()).toBe(0);
    expect(await statusOf(id)).toBe("pending_review");
  });
});
