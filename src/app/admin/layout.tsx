import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdmin, isStaff } from "@/server/auth/permissions";
import { requireViewerOrRedirect } from "@/server/auth/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewerOrRedirect("/admin");
  // 404 instead of 403 so the admin area isn't advertised
  if (!isStaff(viewer)) notFound();
  return (
    <div className="space-y-6">
      <AdminNav admin={isAdmin(viewer)} />
      {children}
    </div>
  );
}
