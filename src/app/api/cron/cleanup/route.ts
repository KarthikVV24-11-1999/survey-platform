import { lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { rateLimit, session, verification } from "@/server/db/schema";
import { env } from "@/server/env";
import { deleteOrphanMedia } from "@/server/media/service";
import { safeEqual } from "@/server/security/hmac";
import { pruneRateLimits } from "@/server/security/rate-limit";

export const maxDuration = 60;

// Daily Vercel cron (vercel.json). Vercel sends CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orphanMedia = await deleteOrphanMedia();
  await pruneRateLimits();
  await db().delete(session).where(lt(session.expiresAt, sql`now()`));
  await db().delete(verification).where(lt(verification.expiresAt, sql`now()`));
  await db().delete(rateLimit).where(lt(rateLimit.lastRequest, Date.now() - 2 * 86_400_000));

  return NextResponse.json({ ok: true, orphanMedia }, { headers: { "Cache-Control": "no-store" } });
}
