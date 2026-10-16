import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <ButtonLink href="/" className="mt-6">
        Back to polls
      </ButtonLink>
    </div>
  );
}
