// Errors with a message that's safe to show users. Anything else is logged and
// replaced with a generic message.
export class AppError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unauthenticated"
      | "forbidden"
      | "not_found"
      | "invalid"
      | "conflict"
      | "rate_limited"
      | "captcha" = "invalid",
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    // let redirect() and notFound() through
    if (err && typeof err === "object" && "digest" in err && typeof err.digest === "string" && err.digest.startsWith("NEXT_")) {
      throw err;
    }
    console.error("[action] unexpected error", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
