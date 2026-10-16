import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Role, TrustLevel, Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db/client";
import { type MediaModeration, media, pollOptions, polls, user } from "@/server/db/schema";
import { defaultSettings, saveSettings, type SiteSettings } from "@/server/settings";

export async function makeUser(opts: { role?: Role; trust?: TrustLevel; ageHours?: number; name?: string } = {}): Promise<Viewer> {
  const id = randomUUID();
  const createdAt = new Date(Date.now() - (opts.ageHours ?? 24 * 30) * 3_600_000);
  const row = {
    id,
    name: opts.name ?? `User ${id.slice(0, 6)}`,
    email: `${id}@example.test`,
    emailVerified: true,
    role: opts.role ?? "user",
    trustLevel: opts.trust ?? "standard",
    createdAt,
    updatedAt: createdAt,
  } as const;
  await db().insert(user).values(row);
  return { id, name: row.name, email: row.email, image: null, role: row.role, trustLevel: row.trustLevel, createdAt };
}

export async function setSettings(patch: Partial<SiteSettings>) {
  const admin = await makeUser({ role: "admin" });
  await saveSettings(db(), { ...defaultSettings, ...patch }, admin.id);
}

// inserts a poll directly, skipping moderation
export async function makePoll(opts: {
  authorId: string;
  options?: string[];
  kind?: "single" | "multiple";
  maxChoices?: number;
  voterMode?: "signed_in" | "anonymous_allowed";
  status?: "published" | "pending_review" | "rejected" | "removed";
  closesAt?: Date | null;
}) {
  const [poll] = await db()
    .insert(polls)
    .values({
      authorId: opts.authorId,
      title: `Poll ${randomUUID().slice(0, 8)}`,
      kind: opts.kind ?? "single",
      maxChoices: opts.maxChoices ?? 1,
      voterMode: opts.voterMode ?? "signed_in",
      status: opts.status ?? "published",
      closesAt: opts.closesAt ?? null,
      publishedAt: new Date(),
    })
    .returning({ id: polls.id });
  const options = await db()
    .insert(pollOptions)
    .values((opts.options ?? ["A", "B", "C"]).map((label, position) => ({ pollId: poll.id, position, label })))
    .returning({ id: pollOptions.id, label: pollOptions.label });
  return { id: poll.id, options: options.map((o) => o.id) };
}

export async function counts(pollId: string) {
  const poll = await db().query.polls.findFirst({ where: eq(polls.id, pollId), columns: { ballotCount: true } });
  const opts = await db()
    .select({ id: pollOptions.id, voteCount: pollOptions.voteCount })
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(pollOptions.position);
  return { ballots: poll!.ballotCount, options: opts.map((o) => o.voteCount) };
}

export async function makeMedia(
  ownerId: string,
  moderation: MediaModeration = { available: true, flagged: false, categories: [], scores: {} },
) {
  const id = randomUUID();
  await db().insert(media).values({
    id,
    ownerId,
    storageKey: `img/${id}.webp`,
    mime: "image/webp",
    width: 10,
    height: 10,
    bytes: 100,
    sha256: "x",
    moderation,
  });
  return id;
}

export const basePollInput = (overrides: Record<string, unknown> = {}) => ({
  title: `Which option is best? ${randomUUID().slice(0, 6)}`,
  description: "",
  kind: "single",
  maxChoices: 1,
  voterMode: "signed_in",
  resultsVisibility: "always",
  closesAt: null,
  options: [
    { label: "First", mediaId: null },
    { label: "Second", mediaId: null },
  ],
  attachments: [],
  ...overrides,
});
