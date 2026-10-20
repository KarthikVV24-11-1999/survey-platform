import { ImageResponse } from "next/og";
import { z } from "zod";
import { OgCard, ogSize, siteHost } from "@/components/og-card";
import { getPublicPollPreview } from "@/server/polls/queries";

export const alt = "Poll on Survey Platform";
export const size = ogSize;
export const contentType = "image/png";

// Options only, never counts, so the image can't reveal results early.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poll = z.uuid().safeParse(id).success ? await getPublicPollPreview(id) : null;
  const title = poll?.title ?? "What do people think?";
  const fontSize = title.length > 90 ? 48 : title.length > 50 ? 58 : 68;

  return new ImageResponse(
    (
      <OgCard footer={poll ? `${poll.optionCount} options · Vote on ${siteHost}` : undefined}>
        <div style={{ fontSize, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.12 }}>{title}</div>
        {poll && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {poll.options.map((label, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  padding: "12px 22px",
                  borderRadius: 14,
                  border: "2px solid #2f3247",
                  background: "rgba(255,255,255,0.04)",
                  fontSize: 28,
                  color: "#d6d8e4",
                  maxWidth: 520,
                }}
              >
                {label.length > 34 ? `${label.slice(0, 33)}...` : label}
              </div>
            ))}
          </div>
        )}
      </OgCard>
    ),
    size,
  );
}
