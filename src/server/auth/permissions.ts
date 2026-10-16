// All permission rules live here as plain functions, which keeps them easy to test.
import type { SiteSettings } from "../settings";

export type Role = "user" | "moderator" | "admin";
export type TrustLevel = "restricted" | "standard" | "trusted";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  trustLevel: TrustLevel;
  createdAt: Date;
};

export const isStaff = (v: Pick<Viewer, "role"> | null | undefined) =>
  v?.role === "moderator" || v?.role === "admin";

export const isAdmin = (v: Pick<Viewer, "role"> | null | undefined) => v?.role === "admin";

export type PostingDecision =
  | { allowed: false; reason: string }
  | { allowed: true; forceReview: boolean; reviewReason?: string };

export function postingDecision(
  viewer: Pick<Viewer, "role" | "trustLevel" | "createdAt">,
  settings: Pick<SiteSettings, "postingPolicy" | "newAccountReviewHours">,
  now: Date,
): PostingDecision {
  if (isStaff(viewer)) return { allowed: true, forceReview: false };
  if (viewer.trustLevel === "restricted") {
    return { allowed: false, reason: "Your account is not allowed to post polls." };
  }
  const trusted = viewer.trustLevel === "trusted";
  if (settings.postingPolicy === "trusted_only" && !trusted) {
    return { allowed: false, reason: "Posting is currently limited to trusted members." };
  }
  if (trusted) return { allowed: true, forceReview: false };
  if (settings.postingPolicy === "review_all") {
    return { allowed: true, forceReview: true, reviewReason: "Site policy: all new polls are reviewed" };
  }
  const ageHours = (now.getTime() - viewer.createdAt.getTime()) / 3_600_000;
  if (ageHours < settings.newAccountReviewHours) {
    return { allowed: true, forceReview: true, reviewReason: "New account: first polls are reviewed" };
  }
  return { allowed: true, forceReview: false };
}

type PollAccess = { status: string; authorId: string | null };

export function canViewPoll(viewer: Viewer | null, poll: PollAccess) {
  if (poll.status === "published") return true;
  if (!viewer) return false;
  if (isStaff(viewer)) return true;
  // authors can see their pending and rejected polls, but not removed ones
  return poll.authorId === viewer.id && poll.status !== "removed";
}

export function canSeeResults(args: {
  visibility: "always" | "after_vote" | "after_close";
  isClosed: boolean;
  hasVoted: boolean;
  isAuthor: boolean;
  isStaff: boolean;
}) {
  if (args.isAuthor || args.isStaff || args.isClosed) return true;
  if (args.visibility === "always") return true;
  if (args.visibility === "after_vote") return args.hasVoted;
  return false;
}

export function canManagePoll(viewer: Viewer | null, poll: PollAccess) {
  if (!viewer) return false;
  return isStaff(viewer) || poll.authorId === viewer.id;
}

// Admins can't change their own account (avoids lockouts). Moderators can only
// change posting trust for regular users.
export function canManageUser(
  actor: Pick<Viewer, "id" | "role">,
  target: { id: string; role: Role },
  change: "role" | "ban" | "trust",
) {
  if (actor.id === target.id) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "moderator") return change === "trust" && target.role === "user";
  return false;
}
