"use client";

import { useState } from "react";
import { CheckIcon, ShareIcon } from "../icons";
import { Button } from "../ui";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access can be blocked
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy} aria-live="polite">
      {copied ? <CheckIcon width={14} height={14} /> : <ShareIcon width={14} height={14} />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
