import type { Executor } from "./db/client";
import { auditLog } from "./db/schema";

type Actor = { id: string; email: string };

export type AuditAction =
  | "poll.approve"
  | "poll.reject"
  | "poll.remove"
  | "poll.restore"
  | "poll.close"
  | "poll.delete"
  | "report.dismiss"
  | "user.role"
  | "user.trust"
  | "user.ban"
  | "user.unban"
  | "settings.update"
  | "term.add"
  | "term.remove";

// Call this inside the same transaction as the action.
export async function audit(
  executor: Executor,
  actor: Actor,
  action: AuditAction,
  target: { type: "poll" | "user" | "report" | "settings" | "term"; id: string },
  details: Record<string, unknown> = {},
) {
  await executor.insert(auditLog).values({
    actorId: actor.id,
    actorLabel: actor.email,
    action,
    targetType: target.type,
    targetId: target.id,
    details,
  });
}
