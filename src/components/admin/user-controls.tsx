"use client";

import { useState, useTransition } from "react";
import { setUserBannedAction, setUserRoleAction, setUserTrustAction } from "@/app/actions/admin";
import { Button, Select } from "../ui";

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Failed.");
    });
  };
  return { error, pending, run };
}

const ErrorText = ({ error }: { error: string | null }) => (error ? <p className="mt-1 text-xs text-danger">{error}</p> : null);

export function TrustSelect({ userId, value }: { userId: string; value: "restricted" | "standard" | "trusted" }) {
  const { error, pending, run } = useAction();
  return (
    <span className="inline-block">
      <Select
        aria-label="Posting trust"
        className="h-8 w-auto py-0 text-xs"
        value={value}
        disabled={pending}
        onChange={(e) => run(() => setUserTrustAction(userId, e.target.value))}
      >
        <option value="restricted">Blocked from posting</option>
        <option value="standard">Standard (auto-moderated)</option>
        <option value="trusted">Trusted (skips review)</option>
      </Select>
      <ErrorText error={error} />
    </span>
  );
}

export function RoleSelect({ userId, value }: { userId: string; value: "user" | "moderator" | "admin" }) {
  const { error, pending, run } = useAction();
  return (
    <span className="inline-block">
      <Select
        aria-label="Role"
        className="h-8 w-auto py-0 text-xs"
        value={value}
        disabled={pending}
        onChange={(e) => {
          if (confirm(`Change this user's role to ${e.target.value}?`)) run(() => setUserRoleAction(userId, e.target.value));
        }}
      >
        <option value="user">User</option>
        <option value="moderator">Moderator</option>
        <option value="admin">Admin</option>
      </Select>
      <ErrorText error={error} />
    </span>
  );
}

export function BanButton({ userId, banned }: { userId: string; banned: boolean }) {
  const { error, pending, run } = useAction();
  function toggle() {
    if (banned) return run(() => setUserBannedAction(userId, false));
    const reason = prompt("Reason for the ban (kept in the audit log):");
    if (reason === null) return;
    run(() => setUserBannedAction(userId, true, reason));
  }
  return (
    <span className="inline-block">
      <Button size="sm" variant={banned ? "secondary" : "ghost"} className={banned ? "" : "text-danger"} onClick={toggle} disabled={pending}>
        {banned ? "Unban" : "Ban"}
      </Button>
      <ErrorText error={error} />
    </span>
  );
}
