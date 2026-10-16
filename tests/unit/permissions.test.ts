import { describe, expect, it } from "vitest";
import { canManageUser, canSeeResults, canViewPoll, postingDecision, type Viewer } from "@/server/auth/permissions";
import { defaultSettings } from "@/server/settings";

const now = new Date("2026-06-01T00:00:00Z");
const viewer = (patch: Partial<Viewer> = {}): Viewer => ({
  id: "u1",
  name: "U",
  email: "u@example.test",
  image: null,
  role: "user",
  trustLevel: "standard",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...patch,
});

describe("postingDecision", () => {
  it("lets established standard users post without review under the open policy", () => {
    expect(postingDecision(viewer(), defaultSettings, now)).toEqual({ allowed: true, forceReview: false });
  });

  it("reviews brand-new accounts", () => {
    const d = postingDecision(viewer({ createdAt: new Date(now.getTime() - 3_600_000) }), defaultSettings, now);
    expect(d).toMatchObject({ allowed: true, forceReview: true });
  });

  it("blocks restricted users", () => {
    expect(postingDecision(viewer({ trustLevel: "restricted" }), defaultSettings, now).allowed).toBe(false);
  });

  it("applies review_all and trusted_only policies to non-trusted users only", () => {
    const reviewAll = { ...defaultSettings, postingPolicy: "review_all" as const };
    const trustedOnly = { ...defaultSettings, postingPolicy: "trusted_only" as const };
    expect(postingDecision(viewer(), reviewAll, now)).toMatchObject({ forceReview: true });
    expect(postingDecision(viewer({ trustLevel: "trusted" }), reviewAll, now)).toMatchObject({ forceReview: false });
    expect(postingDecision(viewer(), trustedOnly, now).allowed).toBe(false);
    expect(postingDecision(viewer({ trustLevel: "trusted" }), trustedOnly, now).allowed).toBe(true);
    expect(postingDecision(viewer({ role: "moderator", trustLevel: "restricted" }), trustedOnly, now).allowed).toBe(true);
  });
});

describe("canViewPoll", () => {
  it("hides unpublished polls from everyone but the author and staff", () => {
    const pending = { status: "pending_review", authorId: "author" };
    expect(canViewPoll(null, pending)).toBe(false);
    expect(canViewPoll(viewer(), pending)).toBe(false);
    expect(canViewPoll(viewer({ id: "author" }), pending)).toBe(true);
    expect(canViewPoll(viewer({ role: "moderator" }), pending)).toBe(true);
    expect(canViewPoll(viewer({ id: "author" }), { status: "removed", authorId: "author" })).toBe(false);
    expect(canViewPoll(null, { status: "published", authorId: "author" })).toBe(true);
  });
});

describe("canSeeResults", () => {
  const base = { isClosed: false, hasVoted: false, isAuthor: false, isStaff: false };
  it("follows the poll's visibility setting", () => {
    expect(canSeeResults({ ...base, visibility: "always" })).toBe(true);
    expect(canSeeResults({ ...base, visibility: "after_vote" })).toBe(false);
    expect(canSeeResults({ ...base, visibility: "after_vote", hasVoted: true })).toBe(true);
    expect(canSeeResults({ ...base, visibility: "after_close", hasVoted: true })).toBe(false);
    expect(canSeeResults({ ...base, visibility: "after_close", isClosed: true })).toBe(true);
    expect(canSeeResults({ ...base, visibility: "after_close", isAuthor: true })).toBe(true);
  });
});

describe("canManageUser", () => {
  const admin = viewer({ id: "a", role: "admin" });
  const mod = viewer({ id: "m", role: "moderator" });
  it("prevents self-management and limits moderators to trust changes on regular users", () => {
    expect(canManageUser(admin, { id: "a", role: "admin" }, "role")).toBe(false);
    expect(canManageUser(admin, { id: "x", role: "admin" }, "ban")).toBe(true);
    expect(canManageUser(mod, { id: "x", role: "user" }, "trust")).toBe(true);
    expect(canManageUser(mod, { id: "x", role: "user" }, "ban")).toBe(false);
    expect(canManageUser(mod, { id: "x", role: "moderator" }, "trust")).toBe(false);
    expect(canManageUser(viewer(), { id: "x", role: "user" }, "trust")).toBe(false);
  });
});
