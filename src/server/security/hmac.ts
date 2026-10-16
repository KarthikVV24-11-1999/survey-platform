import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env";

// Lets us compare voter tokens and IPs without storing them.
export function keyedHash(purpose: "voter" | "ip", value: string) {
  return createHmac("sha256", env().HASH_SECRET).update(`${purpose}\0${value}`).digest("base64url");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
