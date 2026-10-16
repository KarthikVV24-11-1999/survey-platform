"use client";

import { Button } from "@/components/ui";

// Only the digest is shown. It matches the entry in the server logs.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted">Please try again. If it keeps happening, let us know.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
