import { env } from "../env";
import { AppError } from "../errors";
import { randomToken } from "./hmac";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileAction = "create-poll" | "anonymous-vote" | "sign-in";

export const turnstileEnabled = () => Boolean(env().TURNSTILE_SECRET_KEY);

// Tokens are single use and checked against the expected action and hostname.
export async function verifyTurnstile(token: unknown, action: TurnstileAction, ip: string | null) {
  const e = env();
  if (!e.TURNSTILE_SECRET_KEY) {
    // only possible outside production
    return;
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    throw new AppError("Please complete the verification challenge.", "captcha");
  }

  const body = new URLSearchParams({
    secret: e.TURNSTILE_SECRET_KEY,
    response: token,
    idempotency_key: randomToken(16),
  });
  if (ip) body.set("remoteip", ip);

  let outcome: { success?: boolean; action?: string; hostname?: string };
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    outcome = await res.json();
  } catch {
    // if Cloudflare can't be reached, don't let it through
    throw new AppError("Verification is temporarily unavailable. Please try again.", "captcha");
  }

  const expectedHost = new URL(e.APP_URL).hostname;
  const hostOk = e.NODE_ENV !== "production" || outcome.hostname === expectedHost;
  if (!outcome.success || outcome.action !== action || !hostOk) {
    throw new AppError("Verification failed. Please try again.", "captcha");
  }
}
