import { and, eq, inArray, like, sql } from "drizzle-orm";
import { castVoteInput, fieldErrors } from "@/lib/validation";
import type { Viewer } from "../auth/permissions";
import { db } from "../db/client";
import { ballotChoices, ballots, pollOptions, polls } from "../db/schema";
import { env } from "../env";
import { AppError } from "../errors";
import { keyedHash } from "../security/hmac";
import { enforceRateLimit, RATE_LIMITS } from "../security/rate-limit";
import { verifyTurnstile } from "../security/turnstile";
import { getSettings } from "../settings";

export function voterKeyFor(viewer: Pick<Viewer, "id"> | null, anonToken: string | null) {
  if (viewer) return `u:${viewer.id}`;
  if (anonToken) return `a:${keyedHash("voter", anonToken)}`;
  return null;
}

export type CastVoteArgs = {
  viewer: Viewer | null;
  input: unknown;
  // anonymous voter cookie, only used when signed out
  anonToken: string | null;
  ip: string | null;
};

// The poll row stays locked for the transaction, so concurrent votes can't double
// count, and the deadline is checked against the database clock.
export async function castVote({ viewer, input, anonToken, ip }: CastVoteArgs) {
  const parsed = castVoteInput.safeParse(input);
  if (!parsed.success) throw new AppError("That vote isn't valid.", "invalid", fieldErrors(parsed.error));
  const { pollId, optionIds, turnstileToken } = parsed.data;

  const poll = await db().query.polls.findFirst({
    where: eq(polls.id, pollId),
    columns: { status: true, voterMode: true, kind: true, maxChoices: true },
  });
  if (!poll || poll.status !== "published") throw new AppError("This poll isn't available.", "not_found");

  const settings = await getSettings();
  const anonymous = !viewer;
  if (anonymous && (poll.voterMode !== "anonymous_allowed" || !settings.allowAnonymousPolls)) {
    throw new AppError("Sign in to vote on this poll.", "unauthenticated");
  }
  if (poll.kind === "single" && optionIds.length !== 1) throw new AppError("Pick exactly one option.");
  if (optionIds.length > poll.maxChoices) throw new AppError(`You can pick up to ${poll.maxChoices} options.`);

  const voterKey = voterKeyFor(viewer, anonToken);
  if (!voterKey) throw new AppError("Your browser must allow cookies to vote anonymously.");
  if (anonymous && !ip && env().NODE_ENV === "production") {
    // without the IP header the per-network limit can't work
    console.error("[vote] no trusted client IP header; check TRUSTED_IP_HEADER");
    throw new AppError("Anonymous voting is temporarily unavailable. Sign in to vote.", "unauthenticated");
  }
  const ipHash = anonymous && ip ? keyedHash("ip", `${pollId}:${ip}`) : null;

  if (anonymous) {
    await verifyTurnstile(turnstileToken, "anonymous-vote", ip);
    await enforceRateLimit(`vote:ip:${ip ? keyedHash("ip", ip) : "unknown"}`, RATE_LIMITS.anonymousVoteIp);
  } else {
    await enforceRateLimit(`vote:user:${viewer.id}`, RATE_LIMITS.vote);
  }

  return db().transaction(async (tx) => {
    const locked = await tx.execute<{ open: boolean; status: string }>(sql`
      select status,
             (closed_at is null and (closes_at is null or closes_at > now())) as open
      from polls where id = ${pollId}
      for no key update
    `);
    const state = locked.rows[0];
    if (!state || state.status !== "published") throw new AppError("This poll isn't available.", "not_found");
    if (!state.open) throw new AppError("Voting on this poll has closed.", "conflict");

    const validOptions = await tx
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(and(eq(pollOptions.pollId, pollId), inArray(pollOptions.id, optionIds)));
    if (validOptions.length !== optionIds.length) throw new AppError("That option isn't part of this poll.");

    const existing = await tx
      .select({ id: ballots.id })
      .from(ballots)
      .where(and(eq(ballots.pollId, pollId), eq(ballots.voterKey, voterKey)));

    let ballotId: string;
    if (existing.length === 0) {
      if (anonymous && ipHash) {
        const [{ fromIp }] = await tx
          .select({ fromIp: sql<number>`count(*)::int` })
          .from(ballots)
          .where(and(eq(ballots.pollId, pollId), eq(ballots.ipHash, ipHash), like(ballots.voterKey, "a:%")));
        if (fromIp >= settings.anonymousVotesPerIp) {
          throw new AppError("Too many anonymous votes on this poll from your network. Sign in to vote.", "rate_limited");
        }
      }
      const [created] = await tx
        .insert(ballots)
        .values({ pollId, userId: viewer?.id ?? null, voterKey, ipHash })
        .returning({ id: ballots.id });
      ballotId = created.id;
      await tx.update(polls).set({ ballotCount: sql`${polls.ballotCount} + 1` }).where(eq(polls.id, pollId));
    } else {
      ballotId = existing[0].id;
      const previous = await tx
        .delete(ballotChoices)
        .where(eq(ballotChoices.ballotId, ballotId))
        .returning({ optionId: ballotChoices.optionId });
      if (previous.length) {
        await tx
          .update(pollOptions)
          .set({ voteCount: sql`${pollOptions.voteCount} - 1` })
          .where(inArray(pollOptions.id, previous.map((p) => p.optionId)));
      }
      await tx.update(ballots).set({ updatedAt: new Date() }).where(eq(ballots.id, ballotId));
    }

    await tx.insert(ballotChoices).values(optionIds.map((optionId) => ({ ballotId, optionId, pollId })));
    await tx
      .update(pollOptions)
      .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
      .where(inArray(pollOptions.id, optionIds));

    return { choices: optionIds };
  });
}
