// Used by the form for quick feedback and by the server as the real check.
import { z } from "zod";
import { parseVideoUrl } from "./embeds";

export const LIMITS = {
  titleMax: 200,
  descriptionMax: 5000,
  optionsMin: 2,
  optionsMax: 10,
  optionLabelMax: 200,
  attachmentsMax: 6,
  urlMax: 2048,
  linkTitleMax: 120,
  reportDetailsMax: 1000,
  deadlineMinMinutes: 5,
  deadlineMaxDays: 365,
  imageMaxBytes: 4 * 1024 * 1024,
} as const;

// Zero-width and bidi characters are stripped so they can't be used to get past filters.
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/g;
const CONTROL_SINGLE = /[\u0000-\u001F\u007F]/g;
const CONTROL_MULTI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanLine(value: string) {
  return value.normalize("NFC").replace(INVISIBLE, "").replace(CONTROL_SINGLE, " ").replace(/\s+/g, " ").trim();
}

export function cleanMultiline(value: string) {
  return value
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_MULTI, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

const line = (min: number, max: number, label: string) =>
  z
    .string()
    .transform(cleanLine)
    .pipe(
      z
        .string()
        .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`),
    );

export const httpUrl = z
  .string()
  .trim()
  .max(LIMITS.urlMax, "Link is too long")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Enter a valid http(s) link")
  .transform((value) => new URL(value).toString());

export const pollAttachmentInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), mediaId: z.uuid() }),
  z.object({
    kind: z.literal("link"),
    url: httpUrl,
    title: z.string().transform(cleanLine).pipe(z.string().max(LIMITS.linkTitleMax)).optional(),
  }),
  z.object({
    kind: z.literal("video"),
    url: z
      .string()
      .trim()
      .max(LIMITS.urlMax)
      .refine((v) => parseVideoUrl(v) !== null, "Only YouTube and Vimeo links are supported"),
  }),
]);

export const createPollInput = z
  .object({
    title: line(1, LIMITS.titleMax, "Question"),
    description: z
      .string()
      .transform(cleanMultiline)
      .pipe(z.string().max(LIMITS.descriptionMax, `Description must be at most ${LIMITS.descriptionMax} characters`)),
    kind: z.enum(["single", "multiple"]),
    maxChoices: z.number().int().min(1).max(LIMITS.optionsMax),
    voterMode: z.enum(["signed_in", "anonymous_allowed"]),
    resultsVisibility: z.enum(["always", "after_vote", "after_close"]),
    closesAt: z.iso.datetime({ offset: true }).nullable(),
    options: z
      .array(z.object({ label: line(1, LIMITS.optionLabelMax, "Option"), mediaId: z.uuid().nullable() }))
      .min(LIMITS.optionsMin, `Add at least ${LIMITS.optionsMin} options`)
      .max(LIMITS.optionsMax, `At most ${LIMITS.optionsMax} options`),
    attachments: z.array(pollAttachmentInput).max(LIMITS.attachmentsMax, `At most ${LIMITS.attachmentsMax} attachments`),
    turnstileToken: z.string().max(2048).optional(),
  })
  .superRefine((poll, ctx) => {
    const seen = new Set<string>();
    poll.options.forEach((option, i) => {
      const key = option.label.toLocaleLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["options", i, "label"], message: "Options must be different" });
      seen.add(key);
    });
    if (poll.kind === "single" && poll.maxChoices !== 1) {
      ctx.addIssue({ code: "custom", path: ["maxChoices"], message: "Single-choice polls allow exactly one choice" });
    }
    if (poll.kind === "multiple" && (poll.maxChoices < 2 || poll.maxChoices > poll.options.length)) {
      ctx.addIssue({ code: "custom", path: ["maxChoices"], message: "Max choices must be between 2 and the number of options" });
    }
  });

export type CreatePollInput = z.input<typeof createPollInput>;
export type CreatePollData = z.output<typeof createPollInput>;

export function validateDeadline(closesAt: string | null, now: Date): string | null {
  if (!closesAt) return null;
  const at = new Date(closesAt).getTime();
  if (Number.isNaN(at)) return "Invalid deadline";
  if (at < now.getTime() + LIMITS.deadlineMinMinutes * 60_000) {
    return `Deadline must be at least ${LIMITS.deadlineMinMinutes} minutes from now`;
  }
  if (at > now.getTime() + LIMITS.deadlineMaxDays * 86_400_000) return "Deadline must be within a year";
  return null;
}

export const castVoteInput = z.object({
  pollId: z.uuid(),
  optionIds: z
    .array(z.uuid())
    .min(1, "Pick an option")
    .max(LIMITS.optionsMax)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate options"),
  turnstileToken: z.string().max(2048).optional(),
});

export const reportInput = z.object({
  pollId: z.uuid(),
  reason: z.enum(["spam", "harassment", "hate", "sexual", "violence", "self_harm", "misinformation", "illegal", "other"]),
  details: z
    .string()
    .transform(cleanMultiline)
    .pipe(z.string().max(LIMITS.reportDetailsMax))
    .optional(),
});

// { "options.1.label": "message" } for the form
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
