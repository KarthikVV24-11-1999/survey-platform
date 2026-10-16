"use client";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { GitHubIcon, GoogleIcon } from "../icons";
import { CaptchaWidget, captchaRequired } from "../turnstile";
import { Alert, Button, Field, Input } from "../ui";

type Methods = { github: boolean; google: boolean; email: boolean };

export function SignInPanel({ methods, next, error: initialError }: { methods: Methods; next: string; error: string | null }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const captcha = useRef<TurnstileInstance>(undefined);

  const captchaHeaders = () => (token ? { "x-captcha-response": token } : undefined);
  const resetCaptcha = () => {
    captcha.current?.reset();
    setToken(null);
  };
  const blocked = pending || (captchaRequired && !token);

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
        setError(error.message ?? "Sign-in failed.");
        resetCaptcha();
      }
    });
  }

  function magicLink(e: React.FormEvent) {
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
      if (error) return setError(error.message ?? "Could not send the link.");
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

  const none = !methods.github && !methods.google && !methods.email;
  return (
    <div className="space-y-4">
      {none && <Alert tone="warn">No sign-in methods are configured yet.</Alert>}
      <CaptchaWidget ref={captcha} action="sign-in" onToken={setToken} />
      {(methods.github || methods.google) && (
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
      {methods.email && (methods.github || methods.google) && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
      )}
      {methods.email && (
        <form onSubmit={magicLink} className="space-y-3">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Button type="submit" className="w-full" disabled={blocked || !email}>
            {pending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
