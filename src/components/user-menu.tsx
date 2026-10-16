"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/format";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
      >
        {initials(name)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card py-1 text-sm shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link role="menuitem" href="/me" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-subtle">
            My polls &amp; account
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className="block w-full px-3 py-2 text-left hover:bg-subtle">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
