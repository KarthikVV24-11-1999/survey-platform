"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";

const LINKS = [
  { href: "/admin", label: "Overview", adminOnly: false },
  { href: "/admin/queue", label: "Review queue", adminOnly: false },
  { href: "/admin/reports", label: "Reports", adminOnly: false },
  { href: "/admin/rejected", label: "Rejected", adminOnly: false },
  { href: "/admin/users", label: "Users", adminOnly: false },
  { href: "/admin/terms", label: "Word & domain lists", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
  { href: "/admin/audit", label: "Audit log", adminOnly: true },
];

export function AdminNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px text-sm">
      {LINKS.filter((l) => admin || !l.adminOnly).map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2",
              active ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
