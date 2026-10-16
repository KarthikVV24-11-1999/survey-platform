// OpenAI's moderation endpoint (free, text and images). Swap providers here if needed.
import OpenAI from "openai";
import { env } from "../env";

export type AiResult =
  | { available: true; flagged: boolean; categories: string[]; scores: Record<string, number> }
  | { available: false; reason: string };

export type AiInput = { kind: "text"; text: string } | { kind: "image"; url: string };

const MODEL = "omni-moderation-latest";

let client: OpenAI | undefined;
function getClient() {
  const key = env().OPENAI_API_KEY;
  if (!key) return null;
  client ??= new OpenAI({ apiKey: key, timeout: 10_000, maxRetries: 1 });
  return client;
}

type RawResult = {
  flagged: boolean;
  categories: object;
  category_scores: object;
};

export function mergeResults(results: RawResult[]): Extract<AiResult, { available: true }> {
  const scores: Record<string, number> = {};
  const categories = new Set<string>();
  let flagged = false;
  for (const r of results) {
    flagged ||= r.flagged;
    for (const [name, value] of Object.entries(r.category_scores as Record<string, number>)) {
      if (typeof value === "number") scores[name] = Math.max(scores[name] ?? 0, value);
    }
    for (const [name, value] of Object.entries(r.categories as Record<string, boolean>)) {
      if (value === true) categories.add(name);
    }
  }
  return { available: true, flagged, categories: [...categories], scores };
}

// One request for the text and one per image. On errors this returns
// available: false and the poll is held for review.
export async function moderate(inputs: AiInput[]): Promise<AiResult> {
  const openai = getClient();
  if (!openai) return { available: false, reason: "AI moderation is not configured" };
  const texts = inputs.filter((i) => i.kind === "text").map((i) => i.text.slice(0, 20_000));
  const images = inputs.filter((i): i is Extract<AiInput, { kind: "image" }> => i.kind === "image");

  try {
    const requests: Promise<{ results: RawResult[] }>[] = [];
    if (texts.length) {
      requests.push(openai.moderations.create({ model: MODEL, input: texts.join("\n\n---\n\n") }));
    }
    for (const image of images.slice(0, 12)) {
      requests.push(
        openai.moderations.create({ model: MODEL, input: [{ type: "image_url", image_url: { url: image.url } }] }),
      );
    }
    const responses = await Promise.all(requests);
    return mergeResults(responses.flatMap((r) => r.results));
  } catch (err) {
    console.error("[moderation] provider error", err instanceof Error ? err.message : err);
    return { available: false, reason: "AI moderation request failed" };
  }
}
