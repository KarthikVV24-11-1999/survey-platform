"use client";

import { useState, useTransition } from "react";
import { addTermAction, removeTermAction } from "@/app/actions/admin";
import { Alert, Badge, Button, Card, Input, Select } from "../ui";

type Term = { id: string; kind: "word" | "domain"; value: string; action: "flag" | "block" };

export function TermsManager({ terms }: { terms: Term[] }) {
  const [kind, setKind] = useState<"word" | "domain">("word");
  const [action, setAction] = useState<"flag" | "block">("flag");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addTermAction({ kind, value, action });
      if (!result.ok) return setError(result.error);
      setValue("");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeTermAction(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-32">
            <option value="word">Word</option>
            <option value="domain">Domain</option>
          </Select>
          <Input
            aria-label={kind === "word" ? "Word or phrase" : "Domain"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === "word" ? "word or phrase" : "example.com"}
            maxLength={100}
            className="w-56 flex-1"
          />
          <Select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value as typeof action)} className="w-56">
            <option value="flag">Flag for review</option>
            <option value="block">Block automatically</option>
          </Select>
          <Button type="submit" disabled={pending || !value.trim()}>
            Add
          </Button>
        </form>
        {error && (
          <div className="mt-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
      </Card>

      {(["word", "domain"] as const).map((group) => {
        const items = terms.filter((t) => t.kind === group);
        return (
          <section key={group} className="space-y-2">
            <h2 className="font-semibold">{group === "word" ? "Words & phrases" : "Link domains"}</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted">None yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {items.map((t) => (
                  <li key={t.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-sm">
                    <span className="font-mono">{t.value}</span>
                    <Badge tone={t.action === "block" ? "danger" : "warn"}>{t.action}</Badge>
                    <button type="button" aria-label={`Remove ${t.value}`} onClick={() => remove(t.id)} disabled={pending} className="rounded-full px-1.5 text-muted hover:bg-subtle hover:text-fg">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
