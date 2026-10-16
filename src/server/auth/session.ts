import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { AppError } from "../errors";
import { auth } from "./auth";
import { type Role, type TrustLevel, type Viewer, isAdmin, isStaff } from "./permissions";

// Role, trust and ban status come from the session lookup (no cookie cache), so
// admin changes apply on the user's next request.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // read headers first so the route is dynamic before env() runs at build time
  const requestHeaders = await headers();
  const result = await auth().api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const u = result.user as typeof result.user & { role?: string; trustLevel?: string; banned?: boolean };
  if (u.banned) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    role: (u.role ?? "user") as Role,
    trustLevel: (u.trustLevel ?? "standard") as TrustLevel,
    createdAt: new Date(u.createdAt),
  };
});

export async function requireViewerOrRedirect(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return viewer;
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AppError("Please sign in first.", "unauthenticated");
  return viewer;
}

export async function requireStaff(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!isStaff(viewer)) throw new AppError("You don't have permission to do that.", "forbidden");
  return viewer;
}

// Admin pages call these themselves. The layout check alone isn't enough since
// layouts don't re-render on every navigation.
export async function staffPageGuard(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || !isStaff(viewer)) notFound();
  return viewer;
}

export async function adminPageGuard(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) notFound();
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) throw new AppError("You don't have permission to do that.", "forbidden");
  return viewer;
}
