"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameAccountAction } from "@/app/actions/account";
import { Button, Field, Input } from "../ui";

export function DisplayNameForm({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await renameAccountAction(value);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setValue(result.data);
      setMessage({ ok: true, text: "Saved." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <Field label="Display name" htmlFor="display-name" hint="Shown on the polls you post.">
        <div className="flex gap-2">
          <Input id="display-name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} required className="max-w-xs" />
          <Button type="submit" variant="secondary" disabled={pending || value.trim() === name}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </Field>
      {message && <p className={`text-sm ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>}
    </form>
  );
}
