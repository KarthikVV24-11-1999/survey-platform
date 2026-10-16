import "server-only";
import { NextResponse } from "next/server";
import { env } from "./env";
import { AppError } from "./errors";

const STATUS: Record<AppError["code"], number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 422,
  conflict: 409,
  rate_limited: 429,
  captcha: 400,
};

// Route handlers don't get the server-action origin check, so do it here.
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(env().APP_URL).origin;
  if (origin !== expected) throw new AppError("Cross-site request blocked.", "forbidden");
}

export function jsonError(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: STATUS[err.code], headers: { "Cache-Control": "no-store" } });
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
