"use client";

import { useState, useTransition } from "react";
import { reportPollAction } from "@/app/actions/polls";
import { LIMITS } from "@/lib/validation";
import { Alert, Button, Field, Select, Textarea } from "../ui";

const REASONS = [
  ["spam", "Spam or advertising"],
  ["harassment", "Harassment or bullying"],
  ["hate", "Hate speech"],
  ["sexual", "Sexual content"],
  ["violence", "Violence or threats"],
  ["self_harm", "Self-harm"],
  ["misinformation", "Misleading information"],
  ["illegal", "Illegal content"],
  ["other", "Something else"],
] as const;

export function ReportButton({ pollId, alreadyReported }: { pollId: string; alreadyReported: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("spam");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(alreadyReported);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) return <p className="text-sm text-muted">Thanks, we got your report.</p>;
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Report
      </Button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await reportPollAction({ pollId, reason, details: details || undefined });
      if (!result.ok) return setError(result.error);
      setDone(true);
    });
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-border p-4">
      <p className="font-medium">Report this poll</p>
      <Field label="Reason" htmlFor="report-reason">
        <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Details (optional)" htmlFor="report-details">
        <Textarea id="report-details" rows={3} maxLength={LIMITS.reportDetailsMax} value={details} onChange={(e) => setDetails(e.target.value)} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <Button variant="danger" size="sm" onClick={submit} disabled={pending}>
          {pending ? "Sending…" : "Send report"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
