"use server";

// Server actions are public endpoints, so the services validate every input
// and each action checks the session itself.
import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { getViewer, requireViewer } from "@/server/auth/session";
import { env } from "@/server/env";
import { toActionResult } from "@/server/errors";
import { createPoll } from "@/server/polls/create";
import { closePoll, deleteOwnPoll, reportPoll } from "@/server/polls/manage";
import { castVote } from "@/server/polls/vote";
import { randomToken } from "@/server/security/hmac";
import { getClientIp } from "@/server/security/ip";

const VOTER_COOKIE = "sp_voter";
const VOTER_TOKEN = /^[A-Za-z0-9_-]{43}$/;

async function clientIp() {
  return getClientIp(await headers());
}

export async function createPollAction(input: unknown) {
  return toActionResult(async () => {
    const viewer = await requireViewer();
    return createPoll(viewer, input, { ip: await clientIp() });
  });
}

// Identifies an anonymous voter's browser. Only an HMAC of it is stored.
async function anonymousVoterToken(create: boolean) {
  const jar = await cookies();
  const existing = jar.get(VOTER_COOKIE)?.value;
  if (existing && VOTER_TOKEN.test(existing)) return existing;
  if (!create) return null;
  const token = randomToken(32);
  jar.set(VOTER_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return token;
}

export async function castVoteAction(input: unknown) {
  return toActionResult(async () => {
    const viewer = await getViewer();
    const anonToken = viewer ? null : await anonymousVoterToken(true);
    const result = await castVote({ viewer, input, anonToken, ip: await clientIp() });
    refresh();
    return result;
  });
}

const pollIdSchema = z.uuid();

export async function closePollAction(pollId: unknown) {
  return toActionResult(async () => {
    const viewer = await requireViewer();
    await closePoll(viewer, pollIdSchema.parse(pollId));
    refresh();
  });
}

export async function deletePollAction(pollId: unknown) {
  return toActionResult(async () => {
    const viewer = await requireViewer();
    await deleteOwnPoll(viewer, pollIdSchema.parse(pollId));
  });
}

export async function reportPollAction(input: unknown) {
  return toActionResult(async () => {
    const viewer = await requireViewer();
    return reportPoll(viewer, input);
  });
}
