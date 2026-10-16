import { describe, expect, it } from "vitest";
import { parseVideoUrl, videoEmbedUrl } from "@/lib/embeds";

describe("parseVideoUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("parses YouTube %s", (url, id) => {
    expect(parseVideoUrl(url)).toEqual({ provider: "youtube", id });
  });

  it.each([
    ["https://vimeo.com/76979871", "76979871"],
    ["https://player.vimeo.com/video/76979871", "76979871"],
  ])("parses Vimeo %s", (url, id) => {
    expect(parseVideoUrl(url)).toEqual({ provider: "vimeo", id });
  });

  it.each([
    "javascript:alert(1)",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload%3D",
    "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/abc",
    "not a url",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });

  it("builds privacy-enhanced embed URLs from the id only", () => {
    expect(videoEmbedUrl({ provider: "youtube", id: "dQw4w9WgXcQ" })).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl({ provider: "vimeo", id: "76979871" })).toBe("https://player.vimeo.com/video/76979871?dnt=1");
  });
});
