import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { ballots, polls } from "@/server/db/schema";
import { castVote } from "@/server/polls/vote";
import { counts, makePoll, makeUser, setSettings } from "./helpers";

const vote = (viewer: Awaited<ReturnType<typeof makeUser>> | null, pollId: string, optionIds: string[], extra: { anonToken?: string; ip?: string } = {}) =>
  castVote({ viewer, input: { pollId, optionIds }, anonToken: extra.anonToken ?? null, ip: extra.ip ?? null });

describe("castVote", () => {
  it("records a vote and lets the voter change it without double counting", async () => {
    const author = await makeUser();
    const voter = await makeUser();
    const poll = await makePoll({ authorId: author.id });

    await vote(voter, poll.id, [poll.options[0]]);
    expect(await counts(poll.id)).toEqual({ ballots: 1, options: [1, 0, 0] });

    await vote(voter, poll.id, [poll.options[2]], { ip: "203.0.113.9" });
    expect(await counts(poll.id)).toEqual({ ballots: 1, options: [0, 0, 1] });
    const [ballot] = await db().select().from(ballots).where(eq(ballots.pollId, poll.id));
    expect(ballot).toMatchObject({ voterKey: `u:${voter.id}`, ipHash: null });
  });

  it("enforces single choice and max choices", async () => {
    const author = await makeUser();
    const voter = await makeUser();
    const single = await makePoll({ authorId: author.id });
    await expect(vote(voter, single.id, single.options.slice(0, 2))).rejects.toThrow(/exactly one/);

    const multi = await makePoll({ authorId: author.id, kind: "multiple", maxChoices: 2 });
    await expect(vote(voter, multi.id, multi.options)).rejects.toThrow(/up to 2/);
    await vote(voter, multi.id, multi.options.slice(0, 2));
    expect(await counts(multi.id)).toEqual({ ballots: 1, options: [1, 1, 0] });
  });

  it("rejects options from another poll", async () => {
    const author = await makeUser();
    const voter = await makeUser();
    const a = await makePoll({ authorId: author.id });
    const b = await makePoll({ authorId: author.id });
    await expect(vote(voter, a.id, [b.options[0]])).rejects.toThrow(/isn't part of this poll/);
  });

  it("uses the database clock for deadlines and handles early closing", async () => {
    const author = await makeUser();
    const voter = await makeUser();
    const poll = await makePoll({ authorId: author.id, closesAt: new Date(Date.now() + 60_000) });
    await db().update(polls).set({ closesAt: sql`now() - interval '1 second'` }).where(eq(polls.id, poll.id));
    await expect(vote(voter, poll.id, [poll.options[0]])).rejects.toThrow(/closed/);

    const closed = await makePoll({ authorId: author.id });
    await db().update(polls).set({ closedAt: new Date() }).where(eq(polls.id, closed.id));
    await expect(vote(voter, closed.id, [closed.options[0]])).rejects.toThrow(/closed/);
  });

  it("refuses votes on unpublished polls", async () => {
    const author = await makeUser();
    const voter = await makeUser();
    const poll = await makePoll({ authorId: author.id, status: "pending_review" });
    await expect(vote(voter, poll.id, [poll.options[0]])).rejects.toThrow(/isn't available/);
  });

  it("requires sign-in on signed-in-only polls", async () => {
    const author = await makeUser();
    const poll = await makePoll({ authorId: author.id });
    await expect(vote(null, poll.id, [poll.options[0]], { anonToken: "t".repeat(43), ip: "203.0.113.5" })).rejects.toThrow(/Sign in/);
  });

  it("accepts anonymous votes, one per browser, capped per network", async () => {
    await setSettings({ anonymousVotesPerIp: 2 });
    const author = await makeUser();
    const poll = await makePoll({ authorId: author.id, voterMode: "anonymous_allowed" });
    const ip = "198.51.100.7";

    await vote(null, poll.id, [poll.options[0]], { anonToken: "a".repeat(43), ip });
    await vote(null, poll.id, [poll.options[1]], { anonToken: "a".repeat(43), ip }); // same browser: changes vote
    await vote(null, poll.id, [poll.options[1]], { anonToken: "b".repeat(43), ip });
    await expect(vote(null, poll.id, [poll.options[0]], { anonToken: "c".repeat(43), ip })).rejects.toThrow(/from your network/);
    await vote(null, poll.id, [poll.options[0]], { anonToken: "c".repeat(43), ip: "198.51.100.8" });

    expect(await counts(poll.id)).toEqual({ ballots: 3, options: [1, 2, 0] });
    // raw token and IP aren't stored
    const rows = await db().select().from(ballots).where(eq(ballots.pollId, poll.id));
    for (const row of rows) {
      expect(row.voterKey).not.toContain("aaaa");
      expect(row.ipHash).not.toContain("198.51");
    }
  });

  it("stops anonymous voting when the admin disables it", async () => {
    const author = await makeUser();
    const poll = await makePoll({ authorId: author.id, voterMode: "anonymous_allowed" });
    await setSettings({ allowAnonymousPolls: false });
    await expect(vote(null, poll.id, [poll.options[0]], { anonToken: "d".repeat(43), ip: "192.0.2.1" })).rejects.toThrow(/Sign in/);
  });

  it("stays consistent under concurrent votes", async () => {
    const author = await makeUser();
    const poll = await makePoll({ authorId: author.id });
    const voters = await Promise.all(Array.from({ length: 15 }, () => makeUser()));

    await Promise.all(voters.map((v, i) => vote(v, poll.id, [poll.options[i % 3]])));
    // same voter, several requests at once
    await Promise.allSettled(poll.options.map((o) => vote(voters[0], poll.id, [o])));

    const result = await counts(poll.id);
    expect(result.ballots).toBe(15);
    expect(result.options.reduce((a, b) => a + b, 0)).toBe(15);
  });
});
