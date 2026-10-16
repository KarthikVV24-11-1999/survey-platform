import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getAuditLog, getDashboardStats, getRecentlyRejected, getReportedPublished, getReviewQueue, listUsers } from "@/server/admin/queries";
import { db } from "@/server/db/client";
import { polls, reports } from "@/server/db/schema";
import { listPollsByAuthor, listPublishedPolls } from "@/server/polls/queries";
import { makePoll, makeUser } from "./helpers";

describe("feed", () => {
  it("lists only published polls with correct option counts, filters and search", async () => {
    const author = await makeUser({ name: "Ada" });
    const open = await makePoll({ authorId: author.id, options: ["A", "B", "C", "D"] });
    const closed = await makePoll({ authorId: author.id, options: ["X", "Y"] });
    await db().update(polls).set({ closedAt: new Date() }).where(eq(polls.id, closed.id));
    await makePoll({ authorId: author.id, status: "pending_review" });
    await db().update(polls).set({ title: "Favorite programming language" }).where(eq(polls.id, open.id));

    const all = await listPublishedPolls({ sort: "new", state: "all", page: 0 });
    expect(all.polls.map((p) => p.id).sort()).toEqual([open.id, closed.id].sort());
    expect(all.polls.find((p) => p.id === open.id)).toMatchObject({ optionCount: 4, authorName: "Ada", isClosed: false });
    expect(all.polls.find((p) => p.id === closed.id)).toMatchObject({ optionCount: 2, isClosed: true });

    expect((await listPublishedPolls({ sort: "new", state: "open", page: 0 })).polls.map((p) => p.id)).toEqual([open.id]);
    expect((await listPublishedPolls({ sort: "new", state: "closed", page: 0 })).polls.map((p) => p.id)).toEqual([closed.id]);
    expect((await listPublishedPolls({ sort: "trending", state: "all", page: 0 })).polls).toHaveLength(2);
    // stemming: "languages" matches "language"
    expect((await listPublishedPolls({ sort: "new", state: "all", q: "programming languages", page: 0 })).polls.map((p) => p.id)).toEqual([open.id]);
    // odd input shouldn't throw
    await expect(listPublishedPolls({ sort: "new", state: "all", q: `') or 1=1 -- & | !`, page: 0 })).resolves.toBeDefined();
  });

  it("lists closing-soon polls by deadline", async () => {
    const author = await makeUser();
    const later = await makePoll({ authorId: author.id, closesAt: new Date(Date.now() + 5 * 86_400_000) });
    const sooner = await makePoll({ authorId: author.id, closesAt: new Date(Date.now() + 86_400_000) });
    await makePoll({ authorId: author.id });
    const result = await listPublishedPolls({ sort: "closing", state: "all", page: 0 });
    expect(result.polls.map((p) => p.id)).toEqual([sooner.id, later.id]);
  });

  it("lists an author's own polls in every status", async () => {
    const author = await makeUser();
    await makePoll({ authorId: author.id });
    await makePoll({ authorId: author.id, status: "rejected" });
    await makePoll({ authorId: (await makeUser()).id });
    expect((await listPollsByAuthor(author.id)).map((p) => p.status).sort()).toEqual(["published", "rejected"]);
  });
});

describe("admin console queries", () => {
  it("lists users with poll counts and search", async () => {
    const ada = await makeUser({ name: "Ada Lovelace" });
    await makeUser({ name: "Grace Hopper" });
    await makePoll({ authorId: ada.id });
    await makePoll({ authorId: ada.id });

    const all = await listUsers({ page: 0 });
    expect(all.users).toHaveLength(2);
    expect(all.users.find((u) => u.id === ada.id)?.pollCount).toBe(2);

    const found = await listUsers({ q: "lovelace", page: 0 });
    expect(found.users.map((u) => u.id)).toEqual([ada.id]);
    // % is escaped
    expect((await listUsers({ q: "%", page: 0 })).users).toHaveLength(0);
  });

  it("builds the review queue, reported list, rejected list and stats", async () => {
    const author = await makeUser();
    const reporter = await makeUser();
    const pending = await makePoll({ authorId: author.id, status: "pending_review", options: ["One", "Two"] });
    const live = await makePoll({ authorId: author.id });
    const rejected = await makePoll({ authorId: author.id, status: "rejected" });
    await db().insert(reports).values({ pollId: live.id, reporterId: reporter.id, reason: "spam", details: "ads" });

    const queue = await getReviewQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: pending.id, options: ["One", "Two"], reports: [] });

    const reported = await getReportedPublished();
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ id: live.id, reports: [{ reason: "spam", details: "ads" }] });

    await db().update(polls).set({ updatedAt: sql`now()` }).where(eq(polls.id, rejected.id));
    expect((await getRecentlyRejected()).map((p) => p.id)).toEqual([rejected.id]);

    expect(await getDashboardStats()).toMatchObject({ users: 2, published: 1, pending: 1, rejected: 1, open_reports: 1 });
    expect((await getAuditLog(0)).entries).toEqual([]);
  });
});
