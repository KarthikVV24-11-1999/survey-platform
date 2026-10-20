import { ImageResponse } from "next/og";
import { OgCard, ogSize } from "@/components/og-card";

export const alt = "Survey Platform";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgCard>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1 }}>What do people think?</div>
        <div style={{ fontSize: 32, color: "#9ea2b0" }}>Ask a question, share the link, and see how people vote.</div>
      </OgCard>
    ),
    size,
  );
}
