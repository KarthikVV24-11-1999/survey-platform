import Link from "next/link";
import { isStaff } from "@/server/auth/permissions";
import { getViewer } from "@/server/auth/session";
import { LogoMark, PlusIcon } from "./icons";
import { ButtonLink } from "./ui";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <LogoMark className="size-8" />
          <span className="hidden sm:inline">Survey Platform</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-2.5 py-1.5 text-muted transition hover:bg-subtle hover:text-fg">
            Explore
          </Link>
          {isStaff(viewer) && (
            <Link href="/admin" className="rounded-md px-2.5 py-1.5 text-muted transition hover:bg-subtle hover:text-fg">
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ButtonLink href="/polls/new" size="sm">
            <PlusIcon width={15} height={15} />
            <span>New poll</span>
          </ButtonLink>
          {viewer ? (
            <UserMenu name={viewer.name} email={viewer.email} />
          ) : (
            <ButtonLink href="/sign-in" variant="secondary" size="sm">
              Sign in
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
