import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { auditLog, media, polls, reports } from "@/server/db/schema";
import { closePoll, deleteOwnPoll, dismissReports, moderatePollAction, reportPoll } from "@/server/polls/manage";
import { getPollView } from "@/server/polls/queries";
import { castVote } from "@/server/polls/vote";
import { makeMedia, makePoll, makeUser, setSettings } from "./helpers";

const status = async (id: string) => (await db().query.polls.findFirst({ where: eq(polls.id, id) }))!.status;

describe("reports", () => {
  it("auto-hides a poll once enough distinct users report it", async () => {
    await setSettings({ reportThreshold: 2 });
    const author = await makeUser();
    const poll = await makePoll({ authorId: author.id });
    const [a, b] = [await makeUser(), await makeUser()];

    expect(await reportPoll(a, { pollId: poll.id, reason: "spam" })).toEqual({ alreadyReported: false, hidden: false });
    expect(await reportPoll(a, { pollId: poll.id, reason: "spam" })).toEqual({ alreadyReported: true, hidden: false });
    expect(await status(poll.id)).toBe("published");

    expect(await reportPoll(b, { pollId: poll.id, reason: "hate" })).toEqual({ alreadyReported: false, hidden: true });
    expect(await status(poll.id)).toBe("pending_review");
  });

  it("does not let authors report their own polls or anyone report hidden polls", async () => {
    const author = await makeUser();
    const poll = await makePoll({ authorId: author.id });
    await expect(reportPoll(author, { pollId: poll.id, reason: "spam" })).rejects.toThrow(/your own/);
    const pending = await makePoll({ authorId: author.id, status: "pending_review" });
    await expect(reportPoll(await makeUser(), { pollId: pending.id, reason: "spam" })).rejects.toThrow(/not found/);
  });
});

describe("staff moderation", () => {
  it("approves held polls, dismisses their reports, and writes the audit log", async () => {
    const author = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const poll = await makePoll({ authorId: author.id, status: "pending_review" });
    await db().insert(reports).values({ pollId: poll.id, reporterId: (await makeUser()).id, reason: "spam" });

    await moderatePollAction(mod, poll.id, "approve");
    expect(await status(poll.id)).toBe("published");
    const open = await db().select().from(reports).where(and(eq(reports.pollId, poll.id), eq(reports.status, "open")));
    expect(open).toHaveLength(0);
    const log = await db().select().from(auditLog).where(eq(auditLog.targetId, poll.id));
    expect(log).toMatchObject([{ action: "poll.approve", actorId: mod.id }]);
  });

  it("hides images of removed polls and restores them with the poll", async () => {
    const author = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const poll = await makePoll({ authorId: author.id });
    const imageId = await makeMedia(author.id);
    await db().update(media).set({ pollId: poll.id }).where(eq(media.id, imageId));

    await moderatePollAction(mod, poll.id, "remove", "Spam");
    expect((await db().query.media.findFirst({ where: eq(media.id, imageId) }))!.status).toBe("blocked");
    expect((await db().query.polls.findFirst({ where: eq(polls.id, poll.id) }))!.statusNote).toBe("Spam");

    await moderatePollAction(mod, poll.id, "restore");
    expect((await db().query.media.findFirst({ where: eq(media.id, imageId) }))!.status).toBe("active");
  });

  it("refuses invalid transitions and non-staff", async () => {
    const author = await makeUser();
    const mod = await makeUser({ role: "moderator" });
    const poll = await makePoll({ authorId: author.id });
    await expect(moderatePollAction(mod, poll.id, "restore")).rejects.toThrow(/changed by someone else/);
    await expect(moderatePollAction(author, poll.id, "remove")).rejects.toThrow(/permission/);
    await expect(dismissReports(author, poll.id)).rejects.toThrow(/permission/);
  });
});

describe("author controls", () => {
  it("lets authors close and delete only their own polls", async () => {
    const author = await makeUser();
    const stranger = await makeUser();
    const poll = await makePoll({ authorId: author.id });

    await expect(closePoll(stranger, poll.id)).rejects.toThrow(/not found/);
    await closePoll(author, poll.id);
    await expect(closePoll(author, poll.id)).rejects.toThrow(/already closed/);

    await expect(deleteOwnPoll(stranger, poll.id)).rejects.toThrow(/not found/);
    await deleteOwnPoll(author, poll.id);
    expect(await db().query.polls.findFirst({ where: eq(polls.id, poll.id) })).toBeUndefined();
  });

  it("keeps moderated polls as evidence: authors can't delete them", async () => {
    const author = await makeUser();
    const removed = await makePoll({ authorId: author.id, status: "removed" });
    await expect(deleteOwnPoll(author, removed.id)).rejects.toThrow(/moderated/);
    expect(await status(removed.id)).toBe("removed");
  });
});

describe("getPollView", () => {
  it("withholds counts until the viewer may see results", async () => {
    const author = await makeUser();
    const voter = await makeUser();
    const other = await makeUser();
    const poll = await makePoll({ authorId: author.id });
    await db().update(polls).set({ resultsVisibility: "after_vote" }).where(eq(polls.id, poll.id));
    await castVote({ viewer: voter, input: { pollId: poll.id, optionIds: [poll.options[0]] }, anonToken: null, ip: null });

    const unseen = await getPollView(poll.id, other, null);
    expect(unseen?.resultsVisible).toBe(false);
    expect(unseen?.ballotCount).toBeNull();
    expect(unseen?.options.every((o) => o.votes === null)).toBe(true);

    const seen = await getPollView(poll.id, voter, null);
    expect(seen?.options[0].votes).toBe(1);
    expect(seen?.myChoices).toEqual([poll.options[0]]);
    expect((await getPollView(poll.id, author, null))?.resultsVisible).toBe(true);
  });

  it("hides pending polls from the public and moderation details from non-staff", async () => {
    const author = await makeUser();
    const poll = await makePoll({ authorId: author.id, status: "pending_review" });
    expect(await getPollView(poll.id, null, null)).toBeNull();
    expect(await getPollView(poll.id, await makeUser(), null)).toBeNull();
    expect((await getPollView(poll.id, author, null))?.moderation).toBeNull();
    expect((await getPollView(poll.id, await makeUser({ role: "moderator" }), null))?.moderation).not.toBeNull();
  });
});
