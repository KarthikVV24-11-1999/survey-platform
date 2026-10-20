import { ImageResponse } from "next/og";
import { z } from "zod";
import { StoryCard, storySize } from "@/components/og-card";
import { getPublicPollPreview } from "@/server/polls/queries";

// Portrait image for Instagram stories. Published polls only, never counts.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poll = z.uuid().safeParse(id).success ? await getPublicPollPreview(id) : null;
  if (!poll) return new Response("Not found", { status: 404 });

  return new ImageResponse(<StoryCard title={poll.title} options={poll.options} more={poll.optionCount - poll.options.length} />, {
    ...storySize,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
  });
}
