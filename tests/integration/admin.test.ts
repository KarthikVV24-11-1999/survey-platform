import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  addModerationTerm,
  removeModerationTerm,
  setUserBanned,
  setUserRole,
  setUserTrust,
  updateSiteSettings,
} from "@/server/admin/service";
import { db } from "@/server/db/client";
import { auditLog, moderationTerms, session, user } from "@/server/db/schema";
import { hitRateLimit } from "@/server/security/rate-limit";
import { defaultSettings, getSettings } from "@/server/settings";
import { makeUser } from "./helpers";

const userRow = async (id: string) => (await db().query.user.findFirst({ where: eq(user.id, id) }))!;

describe("user management", () => {
  it("lets admins change roles but never their own", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser();
    await setUserRole(admin, target.id, "moderator");
    expect((await userRow(target.id)).role).toBe("moderator");
    await expect(setUserRole(admin, admin.id, "user")).rejects.toThrow(/permission/);
    await expect(setUserRole(admin, target.id, "superuser")).rejects.toThrow();
  });

  it("limits moderators to posting trust for regular users", async () => {
    const mod = await makeUser({ role: "moderator" });
    const regular = await makeUser();
    const admin = await makeUser({ role: "admin" });
    await setUserTrust(mod, regular.id, "restricted");
    expect((await userRow(regular.id)).trustLevel).toBe("restricted");
    await expect(setUserTrust(mod, admin.id, "restricted")).rejects.toThrow(/permission/);
    await expect(setUserRole(mod, regular.id, "admin")).rejects.toThrow(/permission/);
    await expect(setUserBanned(mod, regular.id, true)).rejects.toThrow(/permission/);
  });

  it("bans immediately by revoking every session, and audits it", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser();
    await db().insert(session).values({
      id: "s1",
      token: "tok",
      userId: target.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await setUserBanned(admin, target.id, true, "spam bot");
    expect(await userRow(target.id)).toMatchObject({ banned: true, banReason: "spam bot" });
    expect(await db().select().from(session).where(eq(session.userId, target.id))).toHaveLength(0);
    const log = await db().select().from(auditLog).where(eq(auditLog.targetId, target.id));
    expect(log[0]).toMatchObject({ action: "user.ban", actorLabel: admin.email });

    await setUserBanned(admin, target.id, false);
    expect((await userRow(target.id)).banned).toBe(false);
  });

  it("refuses all of it for regular users", async () => {
    const regular = await makeUser();
    const target = await makeUser();
    await expect(setUserTrust(regular, target.id, "trusted")).rejects.toThrow(/permission/);
    await expect(updateSiteSettings(regular, defaultSettings)).rejects.toThrow(/permission/);
    await expect(addModerationTerm(regular, { kind: "word", value: "x", action: "flag" })).rejects.toThrow(/permission/);
  });
});

describe("settings and terms", () => {
  it("validates and audits settings changes", async () => {
    const admin = await makeUser({ role: "admin" });
    await updateSiteSettings(admin, { ...defaultSettings, reportThreshold: 7 });
    expect((await getSettings()).reportThreshold).toBe(7);
    await expect(updateSiteSettings(admin, { ...defaultSettings, reportThreshold: -1 })).rejects.toThrow(/invalid/);
    const log = await db().select().from(auditLog).where(eq(auditLog.action, "settings.update"));
    expect(log[0].details).toEqual({ changed: { reportThreshold: 7 } });
  });

  it("normalizes terms, validates domains and upserts", async () => {
    const admin = await makeUser({ role: "admin" });
    await addModerationTerm(admin, { kind: "word", value: "  CaSiNo ", action: "flag" });
    await addModerationTerm(admin, { kind: "word", value: "casino", action: "block" });
    const rows = await db().select().from(moderationTerms);
    expect(rows).toMatchObject([{ value: "casino", action: "block" }]);
    await expect(addModerationTerm(admin, { kind: "domain", value: "not a domain", action: "flag" })).rejects.toThrow(/domain/);
    await removeModerationTerm(admin, rows[0].id);
    expect(await db().select().from(moderationTerms)).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  it("counts within a window and reports when the limit is exceeded", async () => {
    const rule = { limit: 2, windowSeconds: 60 };
    expect((await hitRateLimit("t:key", rule)).ok).toBe(true);
    expect((await hitRateLimit("t:key", rule)).ok).toBe(true);
    const third = await hitRateLimit("t:key", rule);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect((await hitRateLimit("t:other", rule)).ok).toBe(true);
  });
});
