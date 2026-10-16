import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cronCleanup } from "@/app/api/cron/cleanup/route";
import { GET as serveMedia } from "@/app/media/[...key]/route";
import { db } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { deleteOrphanMedia, uploadImage } from "@/server/media/service";
import { storage } from "@/server/media/storage";
import { makePoll, makeUser } from "./helpers";

vi.mock("@/server/moderation/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/moderation/ai")>();
  return { ...actual, moderate: vi.fn() };
});
const { moderate } = await import("@/server/moderation/ai");
const mockModerate = vi.mocked(moderate);

const created: string[] = [];
const png = () => sharp({ create: { width: 32, height: 32, channels: 3, background: "#3355ff" } }).png().toBuffer();
const serve = (key: string) => serveMedia(new Request(`http://localhost/media/${key}`), { params: Promise.resolve({ key: key.split("/") }) });

beforeEach(() => {
  mockModerate.mockReset();
  mockModerate.mockResolvedValue({ available: true, flagged: false, categories: [], scores: { sexual: 0.01 } });
});

afterEach(async () => {
  for (const key of created.splice(0)) await storage().delete(key);
});

describe("uploadImage", () => {
  it("stores a re-encoded WebP and serves it with strict headers", async () => {
    const owner = await makeUser();
    const uploaded = await uploadImage(owner, await png());
    const row = (await db().query.media.findFirst({ where: eq(media.id, uploaded.id) }))!;
    created.push(row.storageKey);
    expect(row).toMatchObject({ ownerId: owner.id, mime: "image/webp", status: "active", pollId: null });

    const res = await serve(row.storageKey);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).format).toBe("webp");
  });

  it("refuses clearly unacceptable images without storing anything", async () => {
    mockModerate.mockResolvedValue({ available: true, flagged: true, categories: ["sexual"], scores: { sexual: 0.97 } });
    const owner = await makeUser();
    await expect(uploadImage(owner, await png())).rejects.toThrow(/content policy/);
    expect(await db().select().from(media)).toHaveLength(0);
  });

  it("refuses uploads from users who may not post", async () => {
    await expect(uploadImage(await makeUser({ trust: "restricted" }), await png())).rejects.toThrow(/not allowed/);
  });
});

describe("media route", () => {
  it("rejects malformed keys and path traversal", async () => {
    for (const key of ["../../etc/passwd", "img/../../.env.local", "img/not-a-uuid.webp", "img/x.svg"]) {
      expect((await serve(key)).status).toBe(404);
    }
  });

  it("hides images whose poll was rejected or removed", async () => {
    const owner = await makeUser();
    const uploaded = await uploadImage(owner, await png());
    const row = (await db().query.media.findFirst({ where: eq(media.id, uploaded.id) }))!;
    created.push(row.storageKey);
    await db().update(media).set({ status: "blocked" }).where(eq(media.id, uploaded.id));
    expect((await serve(row.storageKey)).status).toBe(404);
  });
});

describe("cleanup", () => {
  it("deletes stale unattached uploads but keeps attached and recent ones", async () => {
    const owner = await makeUser();
    const poll = await makePoll({ authorId: owner.id });
    const [stale, attached, fresh] = [await uploadImage(owner, await png()), await uploadImage(owner, await png()), await uploadImage(owner, await png())];
    const keys = await db().select({ id: media.id, key: media.storageKey }).from(media);
    created.push(...keys.map((k) => k.key));
    await db().update(media).set({ createdAt: sql`now() - interval '2 days'` }).where(sql`${media.id} in (${stale.id}::uuid, ${attached.id}::uuid)`);
    await db().update(media).set({ pollId: poll.id }).where(eq(media.id, attached.id));

    expect(await deleteOrphanMedia()).toBe(1);
    const remaining = (await db().select({ id: media.id }).from(media)).map((r) => r.id).sort();
    expect(remaining).toEqual([attached.id, fresh.id].sort());
    expect(await storage().get(keys.find((k) => k.id === stale.id)!.key)).toBeNull();
  });

  it("cron endpoint requires the shared secret", async () => {
    expect((await cronCleanup(new Request("http://localhost/api/cron/cleanup"))).status).toBe(401);
    const wrong = new Request("http://localhost/api/cron/cleanup", { headers: { authorization: "Bearer nope" } });
    expect((await cronCleanup(wrong)).status).toBe(401);
    const ok = new Request("http://localhost/api/cron/cleanup", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect((await cronCleanup(ok)).status).toBe(200);
  });
});
