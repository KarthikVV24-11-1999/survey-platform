"use client";

import { type ComponentType, Fragment, type SVGProps, useEffect, useRef, useState } from "react";
import { CheckIcon, LinkIcon, ShareIcon } from "../icons";
import { FacebookIcon, InstagramIcon, LinkedInIcon, RedditIcon, TelegramIcon, WhatsAppIcon, XIcon } from "../share-icons";
import { Button, cx } from "../ui";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type Target = { name: string; href: string; Icon: Icon; color: string };
type Props = { url: string; title: string };

const outline = (p: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  ...p,
});

const MailIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...outline(p)}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

const MoreIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...outline(p)}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </svg>
);

const INSTAGRAM = "#FF0069";

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

const isPhone = () => window.matchMedia("(pointer: coarse)").matches;

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

const itemClass = (compact?: boolean) =>
  cx(
    "flex items-center rounded-xl transition hover:bg-subtle",
    compact ? "size-10 justify-center border border-border bg-card shadow-card" : "w-full gap-3 px-3 py-2 text-left text-sm",
  );

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
      className={itemClass(compact)}
    >
      <Icon style={{ color: target.color }} />
      {!compact && <span>{target.name}</span>}
    </a>
  );
}

const INSTAGRAM_INBOX = "https://www.instagram.com/direct/inbox/";

// Instagram has no share link for websites. Phones list it in the share sheet,
// and it opens its own send screen with the link ready. On a computer we copy
// the link and open Instagram's inbox so it can be pasted into a chat.
function InstagramLink({ url, title, compact }: { url: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      },
      () => {},
    );
  }

  function onClick(e: React.MouseEvent) {
    if (isPhone() && typeof navigator.share === "function") {
      e.preventDefault();
      navigator.share({ title, text: title, url }).catch((err: Error) => {
        if (err.name !== "AbortError") copyLink();
      });
      return;
    }
    copyLink();
  }

  return (
    <a
      href={INSTAGRAM_INBOX}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label="Share on Instagram"
      title={copied ? "Link copied" : "Instagram"}
      className={itemClass(compact)}
    >
      {copied && compact ? <CheckIcon width={18} height={18} className="text-ok" /> : <InstagramIcon style={{ color: INSTAGRAM }} />}
      {!compact && <span>{copied ? "Instagram · link copied" : "Instagram"}</span>}
    </a>
  );
}

/** Share button with a menu of networks. */
export function ShareMenu({ url, title }: Props) {
  const [open, setOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
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

  function toggle() {
    if (!open) setCanNativeShare(typeof navigator.share === "function" && isPhone());
    setOpen((v) => !v);
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
      setOpen(false);
    } catch {
      // closed or not allowed
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
        <ShareIcon width={14} height={14} />
        Share
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-border bg-card p-1.5 shadow-raised">
          {targets(url, title).map((t) => (
            <Fragment key={t.name}>
              <TargetLink target={t} onPick={() => setOpen(false)} />
              {t.name === "WhatsApp" && <InstagramLink url={url} title={title} />}
            </Fragment>
          ))}
          <div className="my-1 h-px bg-border" />
          <button type="button" onClick={copy} className={itemClass()}>
            {copied ? <CheckIcon width={18} height={18} className="text-ok" /> : <LinkIcon width={18} height={18} />}
            {copied ? "Link copied" : "Copy link"}
          </button>
          {canNativeShare && (
            <button type="button" onClick={nativeShare} className={itemClass()}>
              <MoreIcon />
              More options
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Row of share buttons, shown when a poll has just gone live. */
export function ShareRow({ url, title }: Props) {
  const { copied, copy } = useCopy(url);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {targets(url, title).map((t) => (
        <Fragment key={t.name}>
          <TargetLink target={t} compact />
          {t.name === "WhatsApp" && <InstagramLink url={url} title={title} compact />}
        </Fragment>
      ))}
      <Button variant="secondary" onClick={copy} className="h-10">
        {copied ? <CheckIcon width={16} height={16} /> : <LinkIcon width={16} height={16} />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
