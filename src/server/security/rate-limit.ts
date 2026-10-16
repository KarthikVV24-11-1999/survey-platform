import { sql } from "drizzle-orm";
import { type Executor, db } from "../db/client";
import { AppError } from "../errors";

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  createPoll: { limit: 5, windowSeconds: 10 * 60 },
  vote: { limit: 30, windowSeconds: 60 },
  anonymousVoteIp: { limit: 20, windowSeconds: 60 },
  upload: { limit: 30, windowSeconds: 60 * 60 },
  report: { limit: 20, windowSeconds: 24 * 60 * 60 },
  staffAction: { limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

// Fixed window counter in Postgres, shared by all instances. Could move to Redis later.
export async function hitRateLimit(key: string, rule: RateLimitRule, executor: Executor = db()) {
  const rows = await executor.execute<{ count: number; retry_after: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case
        when rate_limits.window_start <= now() - make_interval(secs => ${rule.windowSeconds}) then 1
        else rate_limits.count + 1 end,
      window_start = case
        when rate_limits.window_start <= now() - make_interval(secs => ${rule.windowSeconds}) then now()
        else rate_limits.window_start end
    returning count,
      ceil(extract(epoch from (window_start + make_interval(secs => ${rule.windowSeconds}) - now())))::int as retry_after
  `);
  const row = rows.rows[0];
  return { ok: row.count <= rule.limit, count: row.count, retryAfter: Math.max(row.retry_after, 1) };
}

export async function enforceRateLimit(key: string, rule: RateLimitRule, executor?: Executor) {
  const result = await hitRateLimit(key, rule, executor);
  if (!result.ok) {
    const minutes = Math.ceil(result.retryAfter / 60);
    throw new AppError(
      `You're doing that too often. Try again in ${minutes <= 1 ? "a minute" : `${minutes} minutes`}.`,
      "rate_limited",
    );
  }
}

export async function pruneRateLimits(executor: Executor = db()) {
  // longest window is a day
  await executor.execute(sql`delete from rate_limits where window_start < now() - interval '2 days'`);
}
