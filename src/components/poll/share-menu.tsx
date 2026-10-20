"use client";

import { type ComponentType, type SVGProps, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, LinkIcon, ShareIcon } from "../icons";
import { FacebookIcon, InstagramIcon, LinkedInIcon, MessengerIcon, RedditIcon, TelegramIcon, WhatsAppIcon, XIcon } from "../share-icons";
import { Button, cx } from "../ui";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type Device = "desktop" | "ios" | "android";
type Props = { url: string; title: string };

type Target = {
  name: string;
  href: string;
  Icon: Icon;
  color: string;
  // app links (instagram://, intent://) open in place rather than in a new tab
  sameTab?: boolean;
  // copies the poll link first, for apps that can't take it in the link
  note?: string;
  // shown next to the icon in the compact row
  short?: string;
};

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

// Android opens apps through intent links, with a web page to fall back to
// when the app isn't installed.
const androidIntent = (path: string, scheme: string, pkg: string, fallback: string) =>
  `intent://${path}#Intent;scheme=${scheme};package=${pkg};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;

const INSTAGRAM_INBOX = "https://www.instagram.com/direct/inbox/";
const MESSENGER_WEB = "https://www.facebook.com/messages/";

// Notes on the links below, checked against each app's own link settings:
// - Instagram can't take text in a link, so its options copy the link first.
//   The instagram:// links aren't documented by Meta but are widely used. Its
//   app opens instagram.com/direct/inbox on the home feed, hence direct-inbox.
// - Messenger has no share link for websites on phones, so this uses the app's
//   own fb-messenger://share link. On a computer it copies and opens chats.
// - X's iPhone app opens its web share links in a built-in browser, so iPhones
//   get the app's twitter://post link, which opens the compose screen.
// - Facebook's app opens sharer.php but ignores the link, so phones copy it
//   first, ready to paste into a post or story.
// - LinkedIn's app claims /cws/share and opens its share screen for it.
function targets(url: string, title: string, device: Device): Target[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const msg = encodeURIComponent(`${title} ${url}`);
  const phone = device !== "desktop";
  const list: (Target | false)[] = [
    { name: "WhatsApp", href: `https://wa.me/?text=${msg}`, Icon: WhatsAppIcon, color: "#25D366" },
    {
      name: "Instagram DM",
      href:
        device === "ios"
          ? "instagram://direct-inbox"
          : device === "android"
            ? androidIntent("direct-inbox", "instagram", "com.instagram.android", INSTAGRAM_INBOX)
            : INSTAGRAM_INBOX,
      Icon: InstagramIcon,
      color: "#FF0069",
      sameTab: phone,
      note: "Link copied. Paste it in an Instagram chat.",
    },
    phone && {
      name: "Instagram Story",
      href:
        device === "android"
          ? androidIntent("story-camera", "instagram", "com.instagram.android", "https://www.instagram.com/")
          : "instagram://story-camera",
      Icon: InstagramIcon,
      color: "#FF0069",
      sameTab: true,
      note: "Link copied. Add it to your story with a Link sticker.",
      short: "Story",
    },
    phone
      ? {
          name: "Messenger",
          href:
            device === "android"
              ? androidIntent(`share/?link=${u}`, "fb-messenger", "com.facebook.orca", MESSENGER_WEB)
              : `fb-messenger://share/?link=${u}`,
          Icon: MessengerIcon,
          color: "#0866FF",
          sameTab: true,
        }
      : {
          name: "Messenger",
          href: MESSENGER_WEB,
          Icon: MessengerIcon,
          color: "#0866FF",
          note: "Link copied. Paste it in a Messenger chat.",
        },
    {
      name: "X",
      href: device === "ios" ? `twitter://post?message=${msg}` : `https://x.com/intent/post?text=${t}&url=${u}`,
      Icon: XIcon,
      color: "currentColor",
      sameTab: device === "ios",
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      Icon: FacebookIcon,
      color: "#1877F2",
      note: phone ? "Link copied. Paste it in a new Facebook post or story." : undefined,
    },
    { name: "LinkedIn", href: `https://www.linkedin.com/cws/share?url=${u}`, Icon: LinkedInIcon, color: "#0A66C2" },
    { name: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, Icon: TelegramIcon, color: "#26A5E4" },
    { name: "Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}`, Icon: RedditIcon, color: "#FF4500" },
    { name: "Email", href: `mailto:?subject=${t}&body=${msg}`, Icon: MailIcon, color: "currentColor", sameTab: true },
  ];
  return list.filter((x): x is Target => Boolean(x));
}

const isPhone = () => window.matchMedia("(pointer: coarse)").matches;

const subscribeDevice = (onChange: () => void) => {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const deviceSnapshot = (): Device => {
  if (!isPhone()) return "desktop";
  if (/android/i.test(navigator.userAgent)) return "android";
  // iPadOS reports itself as a Mac
  return /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) ? "ios" : "android";
};

// "desktop" on the server, so phone-only options appear after hydration
const useDevice = () => useSyncExternalStore(subscribeDevice, deviceSnapshot, () => "desktop" as Device);

// iPhone Safari can leave a share hanging when the sheet hands off to another
// app, and the page stops responding when you come back. Reloading clears it.
function openShareSheet(data: ShareData) {
  let settled = false;
  let left = false;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") left = true;
    else if (left) setTimeout(() => !settled && location.reload(), 1000);
  };
  document.addEventListener("visibilitychange", onVisibility);
  navigator
    .share(data)
    .catch(() => {})
    .finally(() => {
      settled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    });
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

function useNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = (text: string) => {
    clearTimeout(timer.current);
    setNotice(text);
    timer.current = setTimeout(() => setNotice(null), 4000);
  };
  const node = notice && (
    <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto w-fit rounded-full bg-fg px-4 py-2 text-sm text-bg shadow-raised">
      {notice}
    </div>
  );
  return { show, node };
}

const itemClass = (compact?: boolean, short?: boolean) =>
  cx(
    "flex items-center rounded-xl transition hover:bg-subtle",
    !compact && "w-full gap-3 px-3 py-2 text-left text-sm",
    compact && "h-10 justify-center border border-border bg-card shadow-card",
    compact && (short ? "gap-2 px-3 text-sm" : "w-10"),
  );

function TargetLink({ target, url, compact, onPick }: { target: Target; url: string; compact?: boolean; onPick: (note?: string) => void }) {
  const { Icon } = target;

  function onClick() {
    if (target.note) navigator.clipboard?.writeText(url).catch(() => {});
    onPick(target.note);
  }

  return (
    <a
      href={target.href}
      {...(target.sameTab ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      onClick={onClick}
      aria-label={target.note ? `Copy link and open ${target.name}` : `Share on ${target.name}`}
      title={target.note ? `Copies the link and opens ${target.name}` : target.name}
      className={itemClass(compact, Boolean(target.short))}
    >
      <Icon style={{ color: target.color }} />
      {!compact && <span>{target.name}</span>}
      {!compact && target.note && <span className="ml-auto text-xs text-muted">Copies link</span>}
      {compact && target.short && <span>{target.short}</span>}
    </a>
  );
}

/** Share button with a menu of networks. */
export function ShareMenu({ url, title }: Props) {
  const [open, setOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { copied, copy } = useCopy(url);
  const notice = useNotice();
  const device = useDevice();

  useEffect(() => {
    if (!open) return;
    // pointerdown, since iPhone Safari doesn't send mouse events for taps on plain content
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function toggle() {
    if (!open) setCanNativeShare(typeof navigator.share === "function" && isPhone());
    setOpen((v) => !v);
  }

  function pick(note?: string) {
    setOpen(false);
    if (note) notice.show(note);
  }

  function nativeShare() {
    openShareSheet({ title, url });
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
        <ShareIcon width={14} height={14} />
        Share
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-raised">
          {targets(url, title, device).map((t) => (
            <TargetLink key={t.name} target={t} url={url} onPick={pick} />
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
      {notice.node}
    </div>
  );
}

/** Row of share buttons, shown when a poll has just gone live. */
export function ShareRow({ url, title }: Props) {
  const { copied, copy } = useCopy(url);
  const notice = useNotice();
  const device = useDevice();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {targets(url, title, device).map((t) => (
          <TargetLink key={t.name} target={t} url={url} compact onPick={(note) => note && notice.show(note)} />
        ))}
        <Button variant="secondary" onClick={copy} className="h-10">
          {copied ? <CheckIcon width={16} height={16} /> : <LinkIcon width={16} height={16} />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p className="text-xs text-muted">Apps that can&apos;t take a link directly, like Instagram, get it copied first so it&apos;s ready to paste.</p>
      {notice.node}
    </div>
  );
}
