"use client";

import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions/admin";
import type { SiteSettings } from "@/server/settings";
import { Alert, Button, Card, Field, Input, Select } from "../ui";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [s, setS] = useState(initial);
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setS((cur) => ({ ...cur, [key]: value }));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateSettingsAction(s);
      setMessage(result.ok ? { tone: "ok", text: "Settings saved." } : { tone: "danger", text: result.error });
    });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card className="space-y-5 p-4 sm:p-6">
        <h2 className="font-semibold">Who can post</h2>
        <Field label="Posting policy" htmlFor="postingPolicy" hint="Trusted users and staff always skip policy review (but never AI or rule checks).">
          <Select id="postingPolicy" value={s.postingPolicy} onChange={(e) => set("postingPolicy", e.target.value as SiteSettings["postingPolicy"])}>
            <option value="open">Open: clean polls publish immediately</option>
            <option value="review_all">Review all: a moderator approves every poll</option>
            <option value="trusted_only">Trusted only: only trusted users may post</option>
          </Select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Review polls from accounts younger than (hours)" htmlFor="newAccountReviewHours">
            <Input id="newAccountReviewHours" type="number" min={0} max={720} value={s.newAccountReviewHours} onChange={(e) => set("newAccountReviewHours", num(e.target.value))} />
          </Field>
          <Field label="Max polls per user per day" htmlFor="maxPollsPerDay">
            <Input id="maxPollsPerDay" type="number" min={1} max={100} value={s.maxPollsPerDay} onChange={(e) => set("maxPollsPerDay", num(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-4 sm:p-6">
        <h2 className="font-semibold">Voting</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.allowAnonymousPolls} onChange={(e) => set("allowAnonymousPolls", e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Allow polls that accept votes without signing in
        </label>
        <Field label="Anonymous votes allowed per poll from one network" htmlFor="anonymousVotesPerIp" hint="Households and offices share an IP address, so keep this above 1.">
          <Input id="anonymousVotesPerIp" type="number" min={1} max={100} value={s.anonymousVotesPerIp} onChange={(e) => set("anonymousVotesPerIp", num(e.target.value))} />
        </Field>
      </Card>

      <Card className="space-y-5 p-4 sm:p-6">
        <h2 className="font-semibold">Automatic moderation</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Review threshold (0.05–1)" htmlFor="aiReviewThreshold" hint="Any AI category score at or above this sends a poll to review. Lower is stricter.">
            <Input id="aiReviewThreshold" type="number" step={0.05} min={0.05} max={1} value={s.aiReviewThreshold} onChange={(e) => set("aiReviewThreshold", num(e.target.value))} />
          </Field>
          <Field label="Reject threshold (0.05–1)" htmlFor="aiRejectThreshold" hint="Severe categories (sexual, graphic violence, threats…) at or above this are rejected outright.">
            <Input id="aiRejectThreshold" type="number" step={0.05} min={0.05} max={1} value={s.aiRejectThreshold} onChange={(e) => set("aiRejectThreshold", num(e.target.value))} />
          </Field>
          <Field label="Hide a poll after this many reports" htmlFor="reportThreshold">
            <Input id="reportThreshold" type="number" min={1} max={100} value={s.reportThreshold} onChange={(e) => set("reportThreshold", num(e.target.value))} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.reviewProfanity} onChange={(e) => set("reviewProfanity", e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Send polls containing profanity to review
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={s.publishWhenAiUnavailable} onChange={(e) => set("publishWhenAiUnavailable", e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            Publish when AI moderation is unavailable <span className="text-muted">(not recommended: by default such polls wait for review)</span>
          </span>
        </label>
      </Card>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
