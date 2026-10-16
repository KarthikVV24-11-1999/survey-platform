"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closePollAction, deletePollAction } from "@/app/actions/polls";
import { Alert, Button } from "../ui";

export function OwnerActions({ pollId, canClose, canDelete }: { pollId: string; canClose: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (!confirm("Close voting now? This can't be undone.")) return;
    startTransition(async () => {
      const result = await closePollAction(pollId);
      if (!result.ok) setError(result.error);
    });
  }

  function remove() {
    if (!confirm("Delete this poll and all of its votes permanently?")) return;
    startTransition(async () => {
      const result = await deletePollAction(pollId);
      if (!result.ok) return setError(result.error);
      router.push("/me");
      router.refresh();
    });
  }

  if (!canClose && !canDelete) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canClose && (
          <Button variant="secondary" size="sm" onClick={close} disabled={pending}>
            Close voting
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-danger">
            Delete poll
          </Button>
        )}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
