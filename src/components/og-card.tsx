import type { ReactNode } from "react";

// Shared layout for the link preview images (rendered by next/og, so inline styles only).
export const ogSize = { width: 1200, height: 630 };
export const siteHost = new URL(process.env.APP_URL ?? "http://localhost:3000").host;

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
        background: "linear-gradient(135deg, #0b0c10 0%, #17183a 100%)",
        color: "#ececf1",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 6,
            paddingBottom: 13,
          }}
        >
          <div style={{ width: 7, height: 13, borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
          <div style={{ width: 7, height: 22, borderRadius: 3, background: "#fff" }} />
          <div style={{ width: 7, height: 29, borderRadius: 3, background: "rgba(255,255,255,0.85)" }} />
        </div>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>Survey Platform</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>{children}</div>
      <div style={{ fontSize: 24, color: "#9ea2b0" }}>{footer ?? siteHost}</div>
    </div>
  );
}
