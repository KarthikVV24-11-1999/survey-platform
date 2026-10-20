"use client";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { PHONE_COUNTRIES, type PhoneCountry, formatPhone, toE164 } from "@/lib/phone";
import { GitHubIcon, GoogleIcon } from "../icons";
import { CaptchaWidget, captchaRequired } from "../turnstile";
import { Alert, Button, Field, Input, Select } from "../ui";

type Methods = { github: boolean; google: boolean; email: boolean; phone: boolean };
type AuthError = { code?: string; status?: number; message?: string };

const PHONE_ERRORS: Record<string, string> = {
  INVALID_OTP: "That code isn't right. Check it and try again.",
  OTP_EXPIRED: "That code has expired. Send a new one.",
  OTP_NOT_FOUND: "That code has expired. Send a new one.",
  TOO_MANY_ATTEMPTS: "Too many tries. Send a new code.",
  INVALID_PHONE_NUMBER: "Enter a valid mobile number.",
};

function errorText(error: AuthError, fallback: string) {
  if (error.status === 429) return "Too many attempts. Please wait a few minutes.";
  return (error.code && PHONE_ERRORS[error.code]) || error.message || fallback;
}

export function SignInPanel({ methods, next, error: initialError }: { methods: Methods; next: string; error: string | null }) {
  const [error, setError] = useState<string | null>(initialError);
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<"phone" | "email">(methods.phone ? "phone" : "email");
  const [pending, startTransition] = useTransition();
  const captcha = useRef<TurnstileInstance>(undefined);

  const captchaHeaders = () => (token ? { "x-captcha-response": token } : undefined);
  const resetCaptcha = () => {
    captcha.current?.reset();
    setToken(null);
  };
  const blocked = pending || (captchaRequired && !token);
  const shared = { next, captchaHeaders, resetCaptcha, blocked, pending, startTransition, setError };

  function social(provider: "github" | "google") {
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: next,
        errorCallbackURL: "/sign-in?error=1",
        fetchOptions: { headers: captchaHeaders() },
      });
      if (error) {
        setError(errorText(error, "Sign-in failed."));
        resetCaptcha();
      }
    });
  }

  const hasSocial = methods.github || methods.google;
  const hasForm = methods.phone || methods.email;
  return (
    <div className="space-y-4">
      {!hasSocial && !hasForm && <Alert tone="warn">Sign-in isn&apos;t set up yet.</Alert>}
      <CaptchaWidget ref={captcha} action="sign-in" onToken={setToken} />
      {hasSocial && (
        <div className="grid gap-2">
          {methods.google && (
            <Button variant="secondary" size="lg" onClick={() => social("google")} disabled={blocked}>
              <GoogleIcon />
              Continue with Google
            </Button>
          )}
          {methods.github && (
            <Button variant="secondary" size="lg" onClick={() => social("github")} disabled={blocked}>
              <GitHubIcon />
              Continue with GitHub
            </Button>
          )}
        </div>
      )}
      {hasSocial && hasForm && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
      )}
      {methods.phone && methods.email && (
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1 text-sm">
          {(["phone", "email"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={`rounded-md py-1.5 font-medium ${tab === t ? "bg-card shadow-card" : "text-muted hover:text-fg"}`}
            >
              {t === "phone" ? "Phone" : "Email"}
            </button>
          ))}
        </div>
      )}
      {methods.phone && (tab === "phone" || !methods.email) && <PhoneForm {...shared} />}
      {methods.email && (tab === "email" || !methods.phone) && <EmailForm {...shared} />}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

type FormProps = {
  next: string;
  captchaHeaders: () => Record<string, string> | undefined;
  resetCaptcha: () => void;
  blocked: boolean;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setError: (error: string | null) => void;
};

function PhoneForm({ next, captchaHeaders, resetCaptcha, blocked, pending, startTransition, setError }: FormProps) {
  const router = useRouter();
  const [country, setCountry] = useState<PhoneCountry>("IN");
  const [number, setNumber] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const placeholder = PHONE_COUNTRIES.find((c) => c.code === country)?.placeholder;

  function send(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const phoneNumber = sentTo ?? toE164(country, number);
    if (!phoneNumber) return setError("Enter a valid mobile number for the selected country.");
    startTransition(async () => {
      const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber, fetchOptions: { headers: captchaHeaders() } });
      resetCaptcha();
      if (error) return setError(errorText(error, "We couldn't send a code."));
      setSentTo(phoneNumber);
      setCode("");
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.phoneNumber.verify({ phoneNumber: sentTo, code: code.trim() });
      if (error) return setError(errorText(error, "We couldn't verify that code."));
      router.push(next);
      router.refresh();
    });
  }

  if (sentTo) {
    return (
      <form onSubmit={verify} className="space-y-3">
        <p className="text-sm text-muted">
          Enter the code we sent to <strong className="text-fg">{formatPhone(sentTo)}</strong>.
        </p>
        <Field label="Code" htmlFor="otp">
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{4,10}"
            maxLength={10}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending || code.length < 4}>
          {pending ? "Checking…" : "Verify and sign in"}
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-muted hover:text-fg" onClick={() => setSentTo(null)}>
            Change number
          </button>
          <button type="button" className="text-accent disabled:opacity-50" onClick={() => send()} disabled={blocked}>
            Send a new code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <Field label="Mobile number" htmlFor="phone">
        <div className="flex gap-2">
          <div className="w-28 shrink-0">
            <Select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value as PhoneCountry)}>
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.dial}
                </option>
              ))}
            </Select>
          </div>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            maxLength={20}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1"
          />
        </div>
      </Field>
      <Button type="submit" className="w-full" disabled={blocked || !number}>
        {pending ? "Sending…" : "Text me a code"}
      </Button>
      <p className="text-xs text-muted">Available for India and US numbers. Standard message rates may apply.</p>
    </form>
  );
}

function EmailForm({ next, captchaHeaders, resetCaptcha, blocked, pending, startTransition, setError }: FormProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.signIn.magicLink({
        email: email.trim(),
        callbackURL: next,
        errorCallbackURL: "/sign-in?error=1",
        fetchOptions: { headers: captchaHeaders() },
      });
      resetCaptcha();
      if (error) return setError(errorText(error, "We couldn't send the link."));
      setSent(true);
    });
  }

  if (sent) {
    return (
      <Alert tone="ok" title="Check your email">
        We sent a sign-in link to <strong>{email}</strong>. It expires in 10 minutes.
      </Alert>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      <Button type="submit" className="w-full" disabled={blocked || !email}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
