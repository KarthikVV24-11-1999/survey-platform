import { isIP } from "node:net";
import { env } from "../env";

type HeaderSource = { get(name: string): string | null };

// Only trusts the header in TRUSTED_IP_HEADER. Vercel sets x-real-ip itself and
// clients can't override it.
export function getClientIp(headers: HeaderSource): string | null {
  const raw = headers.get(env().TRUSTED_IP_HEADER);
  if (!raw) return null;
  // first entry if it's a list
  const candidate = raw.split(",")[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : null;
}

export function ipOrUnknown(headers: HeaderSource) {
  return getClientIp(headers) ?? "unknown";
}
