"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const captchaRequired = Boolean(SITE_KEY);

type Props = {
  action: "create-poll" | "anonymous-vote" | "sign-in";
  onToken: (token: string | null) => void;
};

// Renders nothing when Turnstile isn't configured (local dev).
export const CaptchaWidget = forwardRef<TurnstileInstance | undefined, Props>(function CaptchaWidget({ action, onToken }, ref) {
  if (!SITE_KEY) return null;
  return (
    <Turnstile
      ref={ref}
      siteKey={SITE_KEY}
      options={{ action, theme: "auto", size: "flexible", appearance: "interaction-only" }}
      onSuccess={(token) => onToken(token)}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
    />
  );
});
