import type { PollAttachmentView } from "@/server/polls/queries";
import { LinkIcon } from "../icons";

export function PollAttachments({ items }: { items: PollAttachmentView[] }) {
  if (!items.length) return null;
  const images = items.filter((i) => i.kind === "image");
  const videos = items.filter((i) => i.kind === "video");
  const links = items.filter((i) => i.kind === "link");

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className={images.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
          {images.map((img) => (
            <a key={img.url} href={img.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-2xl border border-border bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element -- resized at upload */}
              <img src={img.url} width={img.width} height={img.height} alt="" loading="lazy" className="h-auto max-h-[28rem] w-full object-contain" />
            </a>
          ))}
        </div>
      )}
      {videos.map((video) => (
        <div key={video.embedUrl} className="aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-card">
          <iframe
            src={video.embedUrl}
            title={`${video.provider === "youtube" ? "YouTube" : "Vimeo"} video`}
            className="size-full"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ))}
      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="nofollow ugc noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-card transition hover:border-accent/40"
              >
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><LinkIcon width={14} height={14} /></span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{link.title || link.host}</span>
                  <span className="block truncate text-xs text-muted">{link.host}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
