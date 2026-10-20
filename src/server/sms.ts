import { APIError } from "better-auth/api";
import { env } from "./env";
import { RATE_LIMITS, hitRateLimit } from "./security/rate-limit";

// Twilio Verify sends and checks the codes. Without Twilio (local dev) Better
// Auth makes the code and it's printed to the console instead.

export const usingTwilio = () => Boolean(env().TWILIO_VERIFY_SERVICE_SID);
export const phoneSignInEnabled = () => usingTwilio() || env().NODE_ENV !== "production";

async function twilio(path: string, body: Record<string, string>) {
  const e = env();
  const res = await fetch(`https://verify.twilio.com/v2/Services/${e.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; code?: number };
  return { ok: res.ok, status: data.status, code: data.code };
}

export async function sendPhoneCode(phoneNumber: string, localCode: string) {
  const [perNumber, daily] = await Promise.all([
    hitRateLimit(`sms:${phoneNumber}`, RATE_LIMITS.smsPerNumber),
    hitRateLimit("sms:all", RATE_LIMITS.smsDaily),
  ]);
  if (!perNumber.ok) throw new APIError("TOO_MANY_REQUESTS", { message: "Too many codes for this number. Try again later." });
  if (!daily.ok) throw new APIError("TOO_MANY_REQUESTS", { message: "Phone sign-in is busy right now. Try another method." });

  if (!usingTwilio()) {
    console.info(`\n[dev] Sign-in code for ${phoneNumber}: ${localCode}\n`);
    return;
  }
  const result = await twilio("Verifications", { To: phoneNumber, Channel: "sms" });
  if (!result.ok) {
    console.error("[sms] Twilio could not send the code", result.code);
    throw new APIError("BAD_GATEWAY", { message: "We couldn't send a code to that number." });
  }
}

export async function checkPhoneCode(phoneNumber: string, code: string) {
  if (!/^\d{4,10}$/.test(code)) return false;
  const result = await twilio("VerificationCheck", { To: phoneNumber, Code: code });
  return result.ok && result.status === "approved";
}
