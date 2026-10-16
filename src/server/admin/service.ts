import { eq } from "drizzle-orm";
import { z } from "zod";
import { cleanLine } from "@/lib/validation";
import { audit } from "../audit";
import { canManageUser, isAdmin, type Viewer } from "../auth/permissions";
import { db } from "../db/client";
import { moderationTerms, session, user } from "../db/schema";
import { AppError } from "../errors";
import { clearTermsCache } from "../moderation";
import { enforceRateLimit, RATE_LIMITS } from "../security/rate-limit";
import { getSettings, saveSettings, settingsSchema } from "../settings";

const FORBIDDEN = () => new AppError("You don't have permission to do that.", "forbidden");

async function loadTarget(userId: string) {
  const target = await db().query.user.findFirst({
    where: eq(user.id, userId),
    columns: { id: true, role: true, trustLevel: true, banned: true, email: true },
  });
  if (!target) throw new AppError("User not found.", "not_found");
  return target;
}

export async function setUserRole(actor: Viewer, userId: string, role: unknown) {
  const next = z.enum(["user", "moderator", "admin"]).parse(role);
  const target = await loadTarget(userId);
  if (!canManageUser(actor, target, "role")) throw FORBIDDEN();
  await enforceRateLimit(`staff:${actor.id}`, RATE_LIMITS.staffAction);
  await db().transaction(async (tx) => {
    await tx.update(user).set({ role: next }).where(eq(user.id, userId));
    await audit(tx, actor, "user.role", { type: "user", id: userId }, { from: target.role, to: next });
  });
}

export async function setUserTrust(actor: Viewer, userId: string, trust: unknown) {
  const next = z.enum(["restricted", "standard", "trusted"]).parse(trust);
  const target = await loadTarget(userId);
  if (!canManageUser(actor, target, "trust")) throw FORBIDDEN();
  await enforceRateLimit(`staff:${actor.id}`, RATE_LIMITS.staffAction);
  await db().transaction(async (tx) => {
    await tx.update(user).set({ trustLevel: next }).where(eq(user.id, userId));
    await audit(tx, actor, "user.trust", { type: "user", id: userId }, { from: target.trustLevel, to: next });
  });
}

// Also deletes the user's sessions so the ban applies right away.
export async function setUserBanned(actor: Viewer, userId: string, banned: boolean, reason?: string) {
  const target = await loadTarget(userId);
  if (!canManageUser(actor, target, "ban")) throw FORBIDDEN();
  await enforceRateLimit(`staff:${actor.id}`, RATE_LIMITS.staffAction);
  const cleanReason = reason ? cleanLine(reason).slice(0, 500) : null;
  await db().transaction(async (tx) => {
    await tx
      .update(user)
      .set(banned ? { banned: true, banReason: cleanReason, bannedAt: new Date() } : { banned: false, banReason: null, bannedAt: null })
      .where(eq(user.id, userId));
    if (banned) await tx.delete(session).where(eq(session.userId, userId));
    await audit(tx, actor, banned ? "user.ban" : "user.unban", { type: "user", id: userId }, cleanReason ? { reason: cleanReason } : {});
  });
}

export async function updateSiteSettings(actor: Viewer, raw: unknown) {
  if (!isAdmin(actor)) throw FORBIDDEN();
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Some settings are invalid.", "invalid");
  const before = await getSettings();
  await db().transaction(async (tx) => {
    await saveSettings(tx, parsed.data, actor.id);
    const changed = Object.fromEntries(
      Object.entries(parsed.data).filter(([k, v]) => before[k as keyof typeof before] !== v),
    );
    await audit(tx, actor, "settings.update", { type: "settings", id: "site" }, { changed });
  });
}

const termInput = z.object({
  kind: z.enum(["word", "domain"]),
  value: z
    .string()
    .transform((v) => cleanLine(v).toLowerCase())
    .pipe(z.string().min(1, "Enter a word or domain").max(100)),
  action: z.enum(["flag", "block"]),
});

export async function addModerationTerm(actor: Viewer, raw: unknown) {
  if (!isAdmin(actor)) throw FORBIDDEN();
  const parsed = termInput.safeParse(raw);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid term.");
  const term = parsed.data;
  if (term.kind === "domain" && !/^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(term.value)) {
    throw new AppError("Enter a domain like example.com");
  }
  await db().transaction(async (tx) => {
    const [row] = await tx
      .insert(moderationTerms)
      .values({ ...term, createdById: actor.id })
      .onConflictDoUpdate({ target: [moderationTerms.kind, moderationTerms.value], set: { action: term.action } })
      .returning({ id: moderationTerms.id });
    await audit(tx, actor, "term.add", { type: "term", id: row.id }, term);
  });
  clearTermsCache();
}

export async function removeModerationTerm(actor: Viewer, termId: string) {
  if (!isAdmin(actor)) throw FORBIDDEN();
  z.uuid().parse(termId);
  await db().transaction(async (tx) => {
    const [row] = await tx.delete(moderationTerms).where(eq(moderationTerms.id, termId)).returning();
    if (row) await audit(tx, actor, "term.remove", { type: "term", id: termId }, { kind: row.kind, value: row.value });
  });
  clearTermsCache();
}
