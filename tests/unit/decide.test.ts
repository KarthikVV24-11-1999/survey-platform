import { describe, expect, it } from "vitest";
import { decide } from "@/server/moderation/decide";
import { defaultSettings } from "@/server/settings";

const clean = { block: [], flag: [] };
const aiClean = { available: true as const, flagged: false, categories: [], scores: { harassment: 0.01, sexual: 0.02 } };
const settings = defaultSettings;

describe("decide", () => {
  it("publishes clean content", () => {
    expect(decide({ rules: clean, ai: aiClean, settings })).toEqual({ outcome: "publish", reasons: [] });
  });

  it("rejects on a blocked term without consulting AI", () => {
    const d = decide({ rules: { block: ['Listed term "x"'], flag: [] }, ai: aiClean, settings });
    expect(d.outcome).toBe("reject");
  });

  it("rejects zero-tolerance categories even at modest scores", () => {
    const d = decide({ rules: clean, ai: { ...aiClean, scores: { "sexual/minors": 0.25 } }, settings });
    expect(d.outcome).toBe("reject");
    expect(d.reasons[0]).toContain("sexual/minors");
  });

  it("rejects severe categories above the reject threshold", () => {
    const d = decide({ rules: clean, ai: { ...aiClean, scores: { "violence/graphic": 0.95 } }, settings });
    expect(d.outcome).toBe("reject");
  });

  it("reviews when a score crosses the review threshold", () => {
    const d = decide({ rules: clean, ai: { ...aiClean, scores: { harassment: 0.5 } }, settings });
    expect(d).toEqual({ outcome: "review", reasons: ["AI: harassment (50%)"] });
  });

  it("reviews when the provider flags a category below threshold", () => {
    const d = decide({ rules: clean, ai: { ...aiClean, flagged: true, categories: ["hate"], scores: { hate: 0.2 } }, settings });
    expect(d.outcome).toBe("review");
  });

  it("fails closed when AI is unavailable", () => {
    const d = decide({ rules: clean, ai: { available: false, reason: "down" }, settings });
    expect(d.outcome).toBe("review");
  });

  it("can be configured to publish when AI is unavailable", () => {
    const d = decide({ rules: clean, ai: { available: false, reason: "down" }, settings: { ...settings, publishWhenAiUnavailable: true } });
    expect(d.outcome).toBe("publish");
  });

  it("reviews on rule flags and policy-forced review", () => {
    expect(decide({ rules: { block: [], flag: ["Profanity"] }, ai: aiClean, settings }).outcome).toBe("review");
    expect(decide({ rules: clean, ai: aiClean, forceReview: "New account", settings }).reasons).toEqual(["New account"]);
  });
});
