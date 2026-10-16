// Only the validated video id is kept. Embed URLs are always rebuilt from it.

export type VideoRef = { provider: "youtube" | "vimeo"; id: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

export function parseVideoUrl(input: string): VideoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    const id = segments[0];
    return id && YOUTUBE_ID.test(id) ? { provider: "youtube", id } : null;
  }
  if (YOUTUBE_HOSTS.has(host)) {
    let id: string | null | undefined;
    if (segments[0] === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(segments[0] ?? "")) id = segments[1];
    return id && YOUTUBE_ID.test(id) ? { provider: "youtube", id } : null;
  }
  if (VIMEO_HOSTS.has(host)) {
    const id = host === "player.vimeo.com" ? (segments[0] === "video" ? segments[1] : undefined) : segments[0];
    return id && VIMEO_ID.test(id) ? { provider: "vimeo", id } : null;
  }
  return null;
}

export function videoEmbedUrl(ref: VideoRef) {
  return ref.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${ref.id}`
    : `https://player.vimeo.com/video/${ref.id}?dnt=1`;
}

export function videoWatchUrl(ref: VideoRef) {
  return ref.provider === "youtube" ? `https://www.youtube.com/watch?v=${ref.id}` : `https://vimeo.com/${ref.id}`;
}

// the thumbnail goes to moderation along with the poll text
export function videoThumbnailUrl(ref: VideoRef) {
  return ref.provider === "youtube" ? `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg` : null;
}
