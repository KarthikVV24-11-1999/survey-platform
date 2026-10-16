"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button } from "../ui";

export function DeleteAccount() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    const ok = confirm(
      "Delete your account? Your sign-in and profile are erased. Your polls stay up without your name, and your votes stay counted anonymously. This cannot be undone.",
    );
    if (!ok) return;
    startTransition(async () => {
      const { error } = await authClient.deleteUser();
      if (error) {
        setError(
          error.status === 403 || error.status === 401
            ? "For your security, sign out and sign in again, then delete your account within a few minutes."
            : (error.message ?? "Could not delete your account."),
        );
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-sm text-muted">Deleting your account removes your profile and sign-in methods permanently.</p>
      <Button variant="ghost" size="sm" className="text-danger" onClick={remove} disabled={pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
