"use client";

import { useState, useTransition } from "react";
import { dismissReportsAction, moderatePollAction } from "@/app/actions/admin";
import { Alert, Button, Input } from "../ui";

type Action = "approve" | "reject" | "remove" | "restore";

const AVAILABLE: Record<string, Action[]> = {
  pending_review: ["approve", "reject", "remove"],
  published: ["remove"],
  rejected: ["approve"],
  removed: ["restore"],
};
const LABEL: Record<Action, string> = { approve: "Approve", reject: "Reject", remove: "Remove", restore: "Restore" };

export function PollModerationButtons({ pollId, status, hasOpenReports }: { pollId: string; status: string; hasOpenReports?: boolean }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const actions = AVAILABLE[status] ?? [];

  function run(action: Action) {
    setError(null);
    startTransition(async () => {
      const result = await moderatePollAction(pollId, action, note || undefined);
      if (!result.ok) setError(result.error);
      else setNote("");
    });
  }

  function dismiss() {
    startTransition(async () => {
      const result = await dismissReportsAction(pollId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      {actions.some((a) => a === "reject" || a === "remove") && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Note to the author (optional, shown if rejected/removed)"
          aria-label="Note to the author"
          className="h-9"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            size="sm"
            variant={action === "approve" || action === "restore" ? "primary" : action === "remove" ? "danger" : "secondary"}
            onClick={() => run(action)}
            disabled={pending}
          >
            {LABEL[action]}
          </Button>
        ))}
        {hasOpenReports && status === "published" && (
          <Button size="sm" variant="secondary" onClick={dismiss} disabled={pending}>
            Dismiss reports
          </Button>
        )}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
