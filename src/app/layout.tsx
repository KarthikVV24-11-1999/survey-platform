import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Survey Platform", template: "%s · Survey Platform" },
  description: "Ask questions, vote, and see what people think.",
  referrer: "strict-origin-when-cross-origin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-border/70">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
            <span className="flex items-center gap-2">
              <LogoMark className="size-5" />
              Survey Platform
            </span>
            <nav className="flex gap-5">
              <Link href="/terms" className="transition hover:text-fg">
                Terms
              </Link>
              <Link href="/privacy" className="transition hover:text-fg">
                Privacy
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
