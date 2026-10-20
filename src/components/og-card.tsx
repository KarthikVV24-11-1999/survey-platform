import type { ReactNode } from "react";

// Shared pieces for the generated share images (rendered by next/og, so inline styles only).
export const ogSize = { width: 1200, height: 630 };
export const storySize = { width: 1080, height: 1920 };
export const siteHost = new URL(process.env.APP_URL ?? "http://localhost:3000").host;

const background = "linear-gradient(135deg, #0b0c10 0%, #17183a 100%)";

export function OgLogo({ scale = 1 }: { scale?: number }) {
  const s = (n: number) => n * scale;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s(18) }}>
      <div
        style={{
          width: s(56),
          height: s(56),
          borderRadius: s(14),
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: s(6),
          paddingBottom: s(13),
        }}
      >
        <div style={{ width: s(7), height: s(13), borderRadius: s(3), background: "rgba(255,255,255,0.7)" }} />
        <div style={{ width: s(7), height: s(22), borderRadius: s(3), background: "#fff" }} />
        <div style={{ width: s(7), height: s(29), borderRadius: s(3), background: "rgba(255,255,255,0.85)" }} />
      </div>
      <div style={{ fontSize: s(30), fontWeight: 600, letterSpacing: -0.5 }}>Survey Platform</div>
    </div>
  );
}

export function OgCard({ children, footer }: { children: ReactNode; footer?: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background,
        color: "#ececf1",
        fontFamily: "sans-serif",
      }}
    >
      <OgLogo />
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>{children}</div>
      <div style={{ fontSize: 24, color: "#9ea2b0" }}>{footer ?? siteHost}</div>
    </div>
  );
}

// Portrait version for Instagram and other stories.
export function StoryCard({ title, options, more }: { title: string; options: string[]; more: number }) {
  const fontSize = title.length > 90 ? 64 : title.length > 50 ? 76 : 90;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "150px 90px 200px",
        background,
        color: "#ececf1",
        fontFamily: "sans-serif",
      }}
    >
      <OgLogo scale={1.4} />
      <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
        <div style={{ fontSize, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {options.map((label, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                padding: "30px 36px",
                borderRadius: 28,
                border: "3px solid #2f3247",
                background: "rgba(255,255,255,0.04)",
                fontSize: 40,
                color: "#d6d8e4",
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 17, border: "4px solid #6366f1", flexShrink: 0 }} />
              {label.length > 40 ? `${label.slice(0, 39)}...` : label}
            </div>
          ))}
          {more > 0 && <div style={{ fontSize: 34, color: "#9ea2b0", paddingLeft: 8 }}>+{more} more</div>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 46, fontWeight: 600 }}>Cast your vote</div>
        <div style={{ fontSize: 34, color: "#9ea2b0" }}>{siteHost}</div>
      </div>
    </div>
  );
}
