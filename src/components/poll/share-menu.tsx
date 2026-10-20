"use client";

import { type ComponentType, type SVGProps, useEffect, useRef, useState } from "react";
import { CheckIcon, LinkIcon, ShareIcon } from "../icons";
import { FacebookIcon, LinkedInIcon, RedditIcon, TelegramIcon, WhatsAppIcon, XIcon } from "../share-icons";
import { Button, cx } from "../ui";

type Target = { name: string; href: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; color: string };

function MailIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function targets(url: string, title: string): Target[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const msg = encodeURIComponent(`${title} ${url}`);
  return [
    { name: "WhatsApp", href: `https://wa.me/?text=${msg}`, Icon: WhatsAppIcon, color: "#25D366" },
    { name: "X", href: `https://x.com/intent/post?text=${t}&url=${u}`, Icon: XIcon, color: "currentColor" },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, Icon: FacebookIcon, color: "#1877F2" },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, Icon: LinkedInIcon, color: "#0A66C2" },
    { name: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, Icon: TelegramIcon, color: "#26A5E4" },
    { name: "Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}`, Icon: RedditIcon, color: "#FF4500" },
    { name: "Email", href: `mailto:?subject=${t}&body=${msg}`, Icon: MailIcon, color: "currentColor" },
  ];
}

function useCopy(url: string) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access can be blocked
    }
  }
  return { copied, copy };
}

function TargetLink({ target, compact, onPick }: { target: Target; compact?: boolean; onPick?: () => void }) {
  const { Icon } = target;
  return (
    <a
      href={target.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onPick}
      aria-label={`Share on ${target.name}`}
      title={target.name}
      className={cx(
        "flex items-center rounded-xl transition hover:bg-subtle",
        compact ? "size-10 justify-center border border-border bg-card shadow-card" : "gap-3 px-3 py-2 text-sm",
      )}
    >
      <Icon style={{ color: target.color }} />
      {!compact && <span>{target.name}</span>}
    </a>
  );
}

/** Share button: the native share sheet on phones, a menu of networks elsewhere. */
export function ShareMenu({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { copied, copy } = useCopy(url);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function onShare() {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    setOpen((v) => !v);
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={onShare} aria-haspopup="menu" aria-expanded={open}>
        <ShareIcon width={14} height={14} />
        Share
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-raised">
          {targets(url, title).map((t) => (
            <TargetLink key={t.name} target={t} onPick={() => setOpen(false)} />
          ))}
          <div className="my-1 h-px bg-border" />
          <button type="button" onClick={copy} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-subtle">
            {copied ? <CheckIcon width={18} height={18} className="text-ok" /> : <LinkIcon width={18} height={18} />}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Row of share buttons, shown when a poll has just gone live. */
export function ShareRow({ url, title }: { url: string; title: string }) {
  const { copied, copy } = useCopy(url);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {targets(url, title).map((t) => (
        <TargetLink key={t.name} target={t} compact />
      ))}
      <Button variant="secondary" onClick={copy} className="h-10">
        {copied ? <CheckIcon width={16} height={16} /> : <LinkIcon width={16} height={16} />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
