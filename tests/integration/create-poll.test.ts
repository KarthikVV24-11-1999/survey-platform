import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { media, moderationEvents, moderationTerms, polls } from "@/server/db/schema";
import { createPoll } from "@/server/polls/create";
import { basePollInput, makeMedia, makeUser, setSettings } from "./helpers";

vi.mock("@/server/moderation/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/moderation/ai")>();
  return { ...actual, moderate: vi.fn() };
});
const { moderate } = await import("@/server/moderation/ai");
const mockModerate = vi.mocked(moderate);

const CLEAN = { available: true as const, flagged: false, categories: [], scores: { harassment: 0.01 } };

beforeEach(() => {
  mockModerate.mockReset();
  mockModerate.mockResolvedValue(CLEAN);
});

const create = (viewer: Awaited<ReturnType<typeof makeUser>>, overrides: Record<string, unknown> = {}) =>
  createPoll(viewer, basePollInput(overrides), { ip: "203.0.113.1" });

describe("createPoll", () => {
  it("publishes clean polls from established users and records the decision", async () => {
    const author = await makeUser();
    const result = await create(author);
    expect(result.status).toBe("published");
    const events = await db().select().from(moderationEvents).where(eq(moderationEvents.pollId, result.id));
    expect(events).toMatchObject([{ source: "auto", outcome: "publish" }]);
  });

  it("holds polls for review when AI moderation is unavailable (fail closed)", async () => {
    mockModerate.mockResolvedValue({ available: false, reason: "down" });
    const result = await create(await makeUser());
    expect(result.status).toBe("pending_review");
  });

  it("holds polls from brand-new accounts", async () => {
    const result = await create(await makeUser({ ageHours: 1 }));
    expect(result.status).toBe("pending_review");
    const poll = await db().query.polls.findFirst({ where: eq(polls.id, result.id) });
    expect(poll?.moderationReasons.join()).toMatch(/New account/);
  });

  it("holds polls the AI scores above the review threshold", async () => {
    mockModerate.mockResolvedValue({ ...CLEAN, flagged: true, categories: ["harassment"], scores: { harassment: 0.7 } });
    expect((await create(await makeUser())).status).toBe("pending_review");
  });

  it("rejects zero-tolerance content and blocks its images", async () => {
    mockModerate.mockResolvedValue({ ...CLEAN, scores: { "sexual/minors": 0.9 } });
    const author = await makeUser();
    const imageId = await makeMedia(author.id);
    const result = await create(author, { attachments: [{ kind: "image", mediaId: imageId }] });
    expect(result.status).toBe("rejected");
    const row = await db().query.media.findFirst({ where: eq(media.id, imageId) });
    expect(row).toMatchObject({ pollId: result.id, status: "blocked" });
  });

  it("rejects admin-blocked words without calling the AI", async () => {
    await db().insert(moderationTerms).values({ kind: "word", value: "casino", action: "block" });
    const result = await create(await makeUser(), { title: "Best c4sino bonus?" });
    expect(result.status).toBe("rejected");
    expect(mockModerate).not.toHaveBeenCalled();
  });

  it("applies image verdicts stored at upload time", async () => {
    const author = await makeUser();
    const imageId = await makeMedia(author.id, { available: true, flagged: true, categories: ["violence"], scores: { violence: 0.6 } });
    const result = await create(author, { options: [{ label: "A", mediaId: imageId }, { label: "B", mediaId: null }] });
    expect(result.status).toBe("pending_review");
  });

  it("refuses images the author does not own or that are already used", async () => {
    const author = await makeUser();
    const other = await makeUser();
    const theirs = await makeMedia(other.id);
    await expect(create(author, { attachments: [{ kind: "image", mediaId: theirs }] })).rejects.toThrow(/no longer available/);

    const mine = await makeMedia(author.id);
    await create(author, { attachments: [{ kind: "image", mediaId: mine }] });
    await expect(create(author, { attachments: [{ kind: "image", mediaId: mine }] })).rejects.toThrow(/no longer available/);
  });

  it("enforces posting policies and trust levels", async () => {
    await expect(create(await makeUser({ trust: "restricted" }))).rejects.toThrow(/not allowed to post/);

    await setSettings({ postingPolicy: "trusted_only" });
    await expect(create(await makeUser())).rejects.toThrow(/trusted members/);
    expect((await create(await makeUser({ trust: "trusted" }))).status).toBe("published");
  });

  it("forces review for everyone but trusted users under review_all", async () => {
    await setSettings({ postingPolicy: "review_all" });
    expect((await create(await makeUser())).status).toBe("pending_review");
    expect((await create(await makeUser({ trust: "trusted" }))).status).toBe("published");
  });

  it("enforces the daily cap and blocks duplicate questions", async () => {
    await setSettings({ maxPollsPerDay: 2 });
    const author = await makeUser();
    await create(author, { title: "Same question?" });
    await expect(create(author, { title: "same QUESTION?" })).rejects.toThrow(/already posted/);
    await create(author);
    await expect(create(author)).rejects.toThrow(/up to 2 polls per day/);
  });

  it("rejects anonymous polls when the site disallows them", async () => {
    await setSettings({ allowAnonymousPolls: false });
    await expect(create(await makeUser(), { voterMode: "anonymous_allowed" })).rejects.toThrow(/Anonymous voting is turned off/);
  });

  it("validates input and deadlines on the server", async () => {
    const author = await makeUser();
    await expect(create(author, { options: [{ label: "Only one", mediaId: null }] })).rejects.toThrow(/highlighted/);
    await expect(create(author, { closesAt: new Date(Date.now() - 1000).toISOString() })).rejects.toThrow(/at least/);
  });
});
