import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/icons";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { Card } from "@/components/ui";
import { signInMethods } from "@/server/auth/auth";
import { getViewer } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

// only relative paths, to avoid an open redirect
function safeNext(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value.slice(0, 500);
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const destination = safeNext(next);
  if (await getViewer()) redirect(destination);

  return (
    <div className="mx-auto max-w-sm py-10">
      <Card className="space-y-6 p-7 shadow-raised">
        <div className="flex flex-col items-center space-y-3 text-center">
          <LogoMark className="size-11" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted">Post polls and keep track of your votes.</p>
          </div>
        </div>
        <SignInPanel methods={signInMethods()} next={destination} error={error ? "Sign-in failed. Please try again." : null} />
        <p className="text-center text-xs text-muted">
          By continuing you agree to the <a href="/terms" className="underline">Terms</a> and{" "}
          <a href="/privacy" className="underline">Privacy Policy</a>.
        </p>
      </Card>
    </div>
  );
}
