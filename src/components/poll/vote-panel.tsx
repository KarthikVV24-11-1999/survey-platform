"use client";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { castVoteAction } from "@/app/actions/polls";
import { plural } from "@/lib/format";
import { CheckIcon, UsersIcon } from "../icons";
import { CaptchaWidget, captchaRequired } from "../turnstile";
import { Alert, Button, buttonClass, cx } from "../ui";

type Option = {
  id: string;
  label: string;
  votes: number | null;
  image: { url: string; width: number; height: number } | null;
};

export type VotePanelProps = {
  pollId: string;
  kind: "single" | "multiple";
  maxChoices: number;
  options: Option[];
  ballotCount: number | null;
  myChoices: string[];
  resultsVisible: boolean;
  resultsVisibility: "always" | "after_vote" | "after_close";
  // null when the viewer can vote
  blocked: null | { reason: "closed" | "not_published" | "sign_in"; signInHref?: string };
  anonymous: boolean;
};

export function VotePanel(props: VotePanelProps) {
  const { options, kind, maxChoices, myChoices, resultsVisible, blocked } = props;
  const [selected, setSelected] = useState<string[]>(myChoices);
  const [editing, setEditing] = useState(myChoices.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const captcha = useRef<TurnstileInstance>(undefined);

  const hasVoted = myChoices.length > 0;
  const canVote = blocked === null;
  const showForm = canVote && editing;
  const total = props.ballotCount ?? 0;
  const maxVotes = Math.max(0, ...options.map((o) => o.votes ?? 0));
  const needsCaptcha = props.anonymous && captchaRequired;

  function toggle(id: string) {
    setError(null);
    if (kind === "single") return setSelected([id]);
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= maxChoices) {
        setError(`You can pick up to ${maxChoices} options.`);
        return cur;
      }
      return [...cur, id];
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await castVoteAction({ pollId: props.pollId, optionIds: selected, turnstileToken: token ?? undefined });
      if (!result.ok) {
        setError(result.error);
        captcha.current?.reset();
        setToken(null);
        return;
      }
      setEditing(false);
    });
  }

  return (
    <div className="space-y-4">
      {kind === "multiple" && showForm && <p className="text-sm text-muted">Pick up to {maxChoices} options.</p>}

      <fieldset disabled={!showForm || pending} className="space-y-2.5">
        <legend className="sr-only">Options</legend>
        {options.map((option) => {
          const checked = selected.includes(option.id);
          const mine = myChoices.includes(option.id);
          const share = resultsVisible && total > 0 ? Math.round(((option.votes ?? 0) / total) * 100) : 0;
          const leading = resultsVisible && (option.votes ?? 0) > 0 && option.votes === maxVotes;
          const active = showForm ? checked : mine;
          return (
            <label
              key={option.id}
              className={cx(
                "relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 transition",
                showForm ? "cursor-pointer hover:border-accent/50 hover:bg-subtle/60" : "cursor-default",
                active ? "border-accent/70 ring-1 ring-accent/40" : "border-border",
              )}
            >
              {resultsVisible && (
                <span
                  aria-hidden
                  className={cx(
                    "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out",
                    leading ? "bg-linear-to-r from-[var(--accent-soft)] to-[color-mix(in_oklab,var(--accent-2)_18%,transparent)]" : "bg-subtle",
                  )}
                  style={{ width: `${share}%` }}
                />
              )}
              <input
                type={kind === "single" ? "radio" : "checkbox"}
                name="option"
                value={option.id}
                aria-label={option.label}
                checked={checked}
                onChange={() => toggle(option.id)}
                className="peer sr-only"
              />
              {showForm && (
                <span
                  aria-hidden
                  className={cx(
                    "relative grid size-5 shrink-0 place-items-center border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-ring/30",
                    kind === "single" ? "rounded-full" : "rounded-md",
                    checked ? "border-accent bg-accent text-accent-fg" : "border-muted/40 bg-transparent",
                  )}
                >
                  {checked && (kind === "single" ? <span className="size-2 rounded-full bg-accent-fg" /> : <CheckIcon width={12} height={12} strokeWidth={3} />)}
                </span>
              )}
              {option.image && (
                // eslint-disable-next-line @next/next/no-img-element -- resized at upload
                <img src={option.image.url} width={option.image.width} height={option.image.height} alt="" loading="lazy" className="relative size-12 shrink-0 rounded-lg object-cover" />
              )}
              <span className="relative min-w-0 flex-1">
                <span className={cx("break-words", leading && "font-medium")}>{option.label}</span>
                {mine && !showForm && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-medium text-accent">
                    <CheckIcon width={11} height={11} strokeWidth={3} />
                    Your vote
                  </span>
                )}
              </span>
              {resultsVisible && (
                <span className="relative shrink-0 text-sm tabular-nums text-muted">
                  <span className="font-semibold text-fg">{share}%</span>
                  <span className="ml-1.5 text-xs">({option.votes ?? 0})</span>
                </span>
              )}
            </label>
          );
        })}
      </fieldset>

      {error && <Alert tone="danger">{error}</Alert>}

      {showForm && (
        <div className="space-y-3">
          {needsCaptcha && <CaptchaWidget ref={captcha} action="anonymous-vote" onToken={setToken} />}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={submit} disabled={pending || selected.length === 0 || (needsCaptcha && !token)}>
              {pending ? "Saving…" : hasVoted ? "Update vote" : "Vote"}
            </Button>
            {hasVoted && (
              <Button variant="ghost" onClick={() => { setSelected(myChoices); setEditing(false); setError(null); }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <UsersIcon width={14} height={14} />
          {resultsVisible
            ? plural(total, "vote")
            : props.resultsVisibility === "after_vote"
              ? "Results appear after you vote."
              : "Results appear when voting closes."}
        </span>
        {canVote && hasVoted && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Change vote
          </Button>
        )}
        {blocked?.reason === "sign_in" && (
          <Link href={blocked.signInHref ?? "/sign-in"} className={buttonClass({ size: "sm" })}>
            Sign in to vote
          </Link>
        )}
        {blocked?.reason === "closed" && <span>Voting has closed.</span>}
      </div>
    </div>
  );
}
