"use client";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createPollAction } from "@/app/actions/polls";
import { type CreatePollInput, LIMITS, createPollInput, fieldErrors } from "@/lib/validation";
import { Markdown } from "../markdown";
import { CaptchaWidget, captchaRequired } from "../turnstile";
import { Alert, Button, Card, Field, Input, Select, Textarea, cx } from "../ui";

type Image = { id: string; url: string };
type OptionDraft = { key: string; label: string; image: Image | null };
type AttachmentDraft =
  | { key: string; kind: "image"; image: Image }
  | { key: string; kind: "link"; url: string; title: string }
  | { key: string; kind: "video"; url: string };

let counter = 0;
const newKey = () => `k${++counter}`;
const blankOption = (): OptionDraft => ({ key: newKey(), label: "", image: null });

async function uploadImage(file: File): Promise<Image> {
  if (file.size > LIMITS.imageMaxBytes) throw new Error("Images must be 4 MB or smaller.");
  const body = new FormData();
  body.set("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: string };
  if (!res.ok || !json.id || !json.url) throw new Error(json.error ?? "Upload failed.");
  return { id: json.id, url: json.url };
}

// datetime-local value for n hours from now
function localDateTime(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 3_600_000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function PollComposer({ allowAnonymous }: { allowAnonymous: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState(false);
  const [options, setOptions] = useState<OptionDraft[]>([blankOption(), blankOption()]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [kind, setKind] = useState<"single" | "multiple">("single");
  const [maxChoices, setMaxChoices] = useState(2);
  const [voterMode, setVoterMode] = useState<"signed_in" | "anonymous_allowed">("signed_in");
  const [resultsVisibility, setResultsVisibility] = useState<"always" | "after_vote" | "after_close">("after_vote");
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState(() => localDateTime(72));
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const captcha = useRef<TurnstileInstance>(undefined);

  const updateOption = (key: string, patch: Partial<OptionDraft>) =>
    setOptions((cur) => cur.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const updateAttachment = (key: string, patch: Partial<AttachmentDraft>) =>
    setAttachments((cur) => cur.map((a) => (a.key === key ? ({ ...a, ...patch } as AttachmentDraft) : a)));

  async function handleUpload(file: File | undefined, slot: string, onDone: (img: Image) => void) {
    if (!file) return;
    setFormError(null);
    setUploading(slot);
    try {
      onDone(await uploadImage(file));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  function buildInput(): CreatePollInput {
    return {
      title,
      description,
      kind,
      maxChoices: kind === "single" ? 1 : maxChoices,
      voterMode,
      resultsVisibility,
      closesAt: hasDeadline && deadline ? new Date(deadline).toISOString() : null,
      options: options.map((o) => ({ label: o.label, mediaId: o.image?.id ?? null })),
      attachments: attachments.map((a) =>
        a.kind === "image"
          ? { kind: "image" as const, mediaId: a.image.id }
          : a.kind === "link"
            ? { kind: "link" as const, url: a.url, title: a.title || undefined }
            : { kind: "video" as const, url: a.url },
      ),
      turnstileToken: token ?? undefined,
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = buildInput();
    const local = createPollInput.safeParse(input);
    if (!local.success) {
      setErrors(fieldErrors(local.error));
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createPollAction(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        captcha.current?.reset();
        setToken(null);
        return;
      }
      router.push(`/polls/${result.data.id}`);
    });
  }

  const busy = pending || uploading !== null;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card className="space-y-5 p-4 sm:p-6">
        <Field label="Question" htmlFor="title" error={errors.title} hint={`${title.length}/${LIMITS.titleMax}`}>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.titleMax} placeholder="What should we ask?" aria-invalid={Boolean(errors.title)} required />
        </Field>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="description" className="text-sm font-medium">
              Details <span className="font-normal text-muted">(optional, Markdown supported)</span>
            </label>
            <button type="button" className="text-xs text-accent" onClick={() => setPreview((v) => !v)}>
              {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <div className="min-h-24 rounded-lg border border-border p-3 text-sm">
              {description ? <Markdown>{description}</Markdown> : <p className="text-muted">Nothing to preview.</p>}
            </div>
          ) : (
            <Textarea id="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={LIMITS.descriptionMax} placeholder="Add some context or links. Markdown works here." aria-invalid={Boolean(errors.description)} />
          )}
          {errors.description && <p className="text-sm text-danger">{errors.description}</p>}
        </div>
      </Card>

      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Options</h2>
          <span className="text-xs text-muted">{options.length}/{LIMITS.optionsMax}</span>
        </div>
        <ol className="space-y-3">
          {options.map((option, i) => (
            <li key={option.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 text-right text-sm text-muted">{i + 1}.</span>
                {option.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview of an uploaded image
                  <img src={option.image.url} alt="" className="size-10 rounded-md object-cover" />
                )}
                <Input value={option.label} onChange={(e) => updateOption(option.key, { label: e.target.value })} maxLength={LIMITS.optionLabelMax} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} aria-invalid={Boolean(errors[`options.${i}.label`])} />
                <label className={cx("shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs text-muted hover:bg-subtle", busy && "pointer-events-none opacity-50")} title="Add an image to this option">
                  {uploading === option.key ? "…" : option.image ? "Replace" : "Image"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={busy} onChange={(e) => handleUpload(e.target.files?.[0], option.key, (img) => updateOption(option.key, { image: img }))} />
                </label>
                {option.image && (
                  <button type="button" className="shrink-0 text-xs text-muted hover:text-fg" onClick={() => updateOption(option.key, { image: null })}>
                    Remove image
                  </button>
                )}
                {options.length > LIMITS.optionsMin && (
                  <button type="button" aria-label={`Remove option ${i + 1}`} className="shrink-0 rounded-md px-2 py-1 text-muted hover:bg-subtle hover:text-fg" onClick={() => setOptions((cur) => cur.filter((o) => o.key !== option.key))}>
                    ✕
                  </button>
                )}
              </div>
              {errors[`options.${i}.label`] && <p className="pl-7 text-sm text-danger">{errors[`options.${i}.label`]}</p>}
            </li>
          ))}
        </ol>
        {errors.options && <p className="text-sm text-danger">{errors.options}</p>}
        {options.length < LIMITS.optionsMax && (
          <Button variant="secondary" size="sm" onClick={() => setOptions((cur) => [...cur, blankOption()])}>
            + Add option
          </Button>
        )}
      </Card>

      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Attachments <span className="text-sm font-normal text-muted">(optional)</span></h2>
          {attachments.length < LIMITS.attachmentsMax && (
            <div className="flex flex-wrap gap-2">
              <label className={cx("inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-subtle", busy && "pointer-events-none opacity-50")}>
                {uploading === "attachment" ? "Uploading…" : "+ Image"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={busy} onChange={(e) => handleUpload(e.target.files?.[0], "attachment", (img) => setAttachments((cur) => [...cur, { key: newKey(), kind: "image", image: img }]))} />
              </label>
              <Button variant="secondary" size="sm" onClick={() => setAttachments((cur) => [...cur, { key: newKey(), kind: "link", url: "", title: "" }])}>
                + Link
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAttachments((cur) => [...cur, { key: newKey(), kind: "video", url: "" }])}>
                + YouTube / Vimeo
              </Button>
            </div>
          )}
        </div>
        {attachments.length === 0 && <p className="text-sm text-muted">Add images, links or a video to give voters context.</p>}
        <ul className="space-y-3">
          {attachments.map((a, i) => (
            <li key={a.key} className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                {a.kind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview of an uploaded image
                  <img src={a.image.url} alt="" className="max-h-40 rounded-lg border border-border" />
                )}
                {a.kind === "link" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input value={a.url} onChange={(e) => updateAttachment(a.key, { url: e.target.value })} placeholder="https://…" aria-label="Link URL" type="url" maxLength={LIMITS.urlMax} aria-invalid={Boolean(errors[`attachments.${i}.url`])} />
                    <Input value={a.title} onChange={(e) => updateAttachment(a.key, { title: e.target.value })} placeholder="Title (optional)" aria-label="Link title" maxLength={LIMITS.linkTitleMax} />
                  </div>
                )}
                {a.kind === "video" && (
                  <Input value={a.url} onChange={(e) => updateAttachment(a.key, { url: e.target.value })} placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…" aria-label="Video URL" type="url" maxLength={LIMITS.urlMax} aria-invalid={Boolean(errors[`attachments.${i}.url`])} />
                )}
                {errors[`attachments.${i}.url`] && <p className="text-sm text-danger">{errors[`attachments.${i}.url`]}</p>}
              </div>
              <button type="button" aria-label="Remove attachment" className="rounded-md px-2 py-2 text-muted hover:bg-subtle hover:text-fg" onClick={() => setAttachments((cur) => cur.filter((x) => x.key !== a.key))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="grid gap-5 p-4 sm:grid-cols-2 sm:p-6">
        <Field label="Answer type" htmlFor="kind" error={errors.maxChoices}>
          <div className="flex gap-2">
            <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as "single" | "multiple")}>
              <option value="single">One choice</option>
              <option value="multiple">Multiple choices</option>
            </Select>
            {kind === "multiple" && (
              <Select aria-label="Maximum choices" value={maxChoices} onChange={(e) => setMaxChoices(Number(e.target.value))} className="w-28">
                {Array.from({ length: Math.max(1, options.length - 1) }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    up to {n}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </Field>

        <Field
          label="Who can vote"
          htmlFor="voterMode"
          error={errors.voterMode}
          hint={voterMode === "anonymous_allowed" ? "Limited per browser and network, but easier to game." : "One vote per account, so results are more reliable."}
        >
          <Select id="voterMode" value={voterMode} onChange={(e) => setVoterMode(e.target.value as typeof voterMode)}>
            <option value="signed_in">Signed-in users</option>
            {allowAnonymous && <option value="anonymous_allowed">Anyone, no sign-in needed</option>}
          </Select>
        </Field>

        <Field label="Show results" htmlFor="results">
          <Select id="results" value={resultsVisibility} onChange={(e) => setResultsVisibility(e.target.value as typeof resultsVisibility)}>
            <option value="after_vote">After someone votes</option>
            <option value="always">Always</option>
            <option value="after_close">Only when voting closes</option>
          </Select>
        </Field>

        <Field label="Deadline" htmlFor="deadline" error={errors.closesAt} hint={hasDeadline ? "In your local time zone." : "Voting stays open until you close it."}>
          <div className="flex items-center gap-2">
            <Select aria-label="Has deadline" value={hasDeadline ? "yes" : "no"} onChange={(e) => setHasDeadline(e.target.value === "yes")} className="w-32">
              <option value="no">None</option>
              <option value="yes">Closes at</option>
            </Select>
            {hasDeadline && (
              <Input id="deadline" type="datetime-local" value={deadline} min={localDateTime(0.1)} max={localDateTime(24 * 365)} onChange={(e) => setDeadline(e.target.value)} aria-invalid={Boolean(errors.closesAt)} />
            )}
          </div>
        </Field>
      </Card>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <div className="space-y-3">
        <CaptchaWidget ref={captcha} action="create-poll" onToken={setToken} />
        <div className="flex items-center gap-3">
          <Button type="submit" size="lg" disabled={busy || (captchaRequired && !token)}>
            {pending ? "Publishing…" : "Publish poll"}
          </Button>
          <p className="text-xs text-muted">Polls are checked automatically and may be held for review.</p>
        </div>
      </div>
    </form>
  );
}
