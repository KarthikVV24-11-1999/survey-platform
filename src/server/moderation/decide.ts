// Decides publish, review or reject from the rule and AI results.
import type { SiteSettings } from "../settings";
import type { AiResult } from "./ai";
import type { RuleFindings } from "./rules";

export type Outcome = "publish" | "review" | "reject";
export type Decision = { outcome: Outcome; reasons: string[] };

// rejected even at low scores
const ZERO_TOLERANCE = ["sexual/minors"];
// rejected above the reject threshold
const SEVERE = ["sexual", "violence/graphic", "self-harm/instructions", "hate/threatening", "illicit/violent", "harassment/threatening"];

const pct = (score: number) => `${Math.round(score * 100)}%`;

export function decide(input: {
  rules: RuleFindings;
  ai: AiResult;
  // e.g. new account or review_all policy
  forceReview?: string;
  settings: Pick<SiteSettings, "aiReviewThreshold" | "aiRejectThreshold" | "publishWhenAiUnavailable">;
}): Decision {
  const { rules, ai, settings } = input;

  if (rules.block.length) return { outcome: "reject", reasons: rules.block };

  const reasons: string[] = [];
  if (ai.available) {
    for (const category of ZERO_TOLERANCE) {
      const score = ai.scores[category] ?? 0;
      if (ai.categories.includes(category) || score >= Math.min(settings.aiReviewThreshold, 0.2)) {
        return { outcome: "reject", reasons: [`AI: ${category} (${pct(score)})`] };
      }
    }
    const severe = SEVERE.filter((c) => (ai.scores[c] ?? 0) >= settings.aiRejectThreshold);
    if (severe.length) {
      return { outcome: "reject", reasons: severe.map((c) => `AI: ${c} (${pct(ai.scores[c])})`) };
    }
    const elevated = Object.entries(ai.scores)
      .filter(([c, score]) => score >= settings.aiReviewThreshold || ai.categories.includes(c))
      .sort((a, b) => b[1] - a[1]);
    reasons.push(...elevated.map(([c, score]) => `AI: ${c} (${pct(score)})`));
  } else if (!settings.publishWhenAiUnavailable) {
    reasons.push(`Automatic moderation unavailable (${ai.reason})`);
  }

  reasons.push(...rules.flag);
  if (input.forceReview) reasons.push(input.forceReview);

  return reasons.length ? { outcome: "review", reasons } : { outcome: "publish", reasons: [] };
}
