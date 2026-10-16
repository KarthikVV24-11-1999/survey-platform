import { describe, expect, it } from "vitest";
import { castVoteInput, cleanLine, createPollInput, fieldErrors, httpUrl, validateDeadline } from "@/lib/validation";

const valid = {
  title: "Best editor?",
  description: "",
  kind: "single",
  maxChoices: 1,
  voterMode: "signed_in",
  resultsVisibility: "always",
  closesAt: null,
  options: [
    { label: "Vim", mediaId: null },
    { label: "Emacs", mediaId: null },
  ],
  attachments: [],
};

describe("createPollInput", () => {
  it("accepts a valid poll", () => {
    expect(createPollInput.safeParse(valid).success).toBe(true);
  });

  it("strips invisible characters and collapses whitespace", () => {
    const parsed = createPollInput.parse({ ...valid, title: "  Best​   editor?‮ " });
    expect(parsed.title).toBe("Best editor?");
    expect(cleanLine("a\u0000b")).toBe("a b");
  });

  it("requires distinct options (case-insensitive)", () => {
    const r = createPollInput.safeParse({ ...valid, options: [{ label: "Vim", mediaId: null }, { label: "vim", mediaId: null }] });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!)["options.1.label"]).toBe("Options must be different");
  });

  it("enforces option counts and choice limits", () => {
    expect(createPollInput.safeParse({ ...valid, options: [{ label: "Only", mediaId: null }] }).success).toBe(false);
    expect(createPollInput.safeParse({ ...valid, maxChoices: 2 }).success).toBe(false);
    expect(createPollInput.safeParse({ ...valid, kind: "multiple", maxChoices: 3 }).success).toBe(false);
    expect(createPollInput.safeParse({ ...valid, kind: "multiple", maxChoices: 2 }).success).toBe(true);
  });

  it("rejects unsupported attachments", () => {
    const bad = [
      { kind: "link", url: "javascript:alert(1)" },
      { kind: "link", url: "https://user:pw@example.com" },
      { kind: "video", url: "https://example.com/video.mp4" },
      { kind: "image", mediaId: "not-a-uuid" },
      { kind: "script", url: "https://x.example" },
    ];
    for (const attachment of bad) {
      expect(createPollInput.safeParse({ ...valid, attachments: [attachment] }).success, JSON.stringify(attachment)).toBe(false);
    }
  });

  it("rejects oversized fields", () => {
    expect(createPollInput.safeParse({ ...valid, title: "x".repeat(201) }).success).toBe(false);
    expect(createPollInput.safeParse({ ...valid, description: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("httpUrl", () => {
  it("normalizes valid links and rejects other schemes", () => {
    expect(httpUrl.parse("https://Example.com/a b")).toBe("https://example.com/a%20b");
    expect(httpUrl.safeParse("data:text/html,hi").success).toBe(false);
    expect(httpUrl.safeParse("https://localhost").success).toBe(false);
  });
});

describe("validateDeadline", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("allows no deadline and sensible future deadlines", () => {
    expect(validateDeadline(null, now)).toBeNull();
    expect(validateDeadline("2026-01-02T00:00:00Z", now)).toBeNull();
  });
  it("rejects past, too-soon and too-far deadlines", () => {
    expect(validateDeadline("2025-12-31T00:00:00Z", now)).toMatch(/at least/);
    expect(validateDeadline("2026-01-01T00:01:00Z", now)).toMatch(/at least/);
    expect(validateDeadline("2027-06-01T00:00:00Z", now)).toMatch(/within a year/);
  });
});

describe("castVoteInput", () => {
  it("rejects duplicate and empty selections", () => {
    const id = "6f1c1b2e-8a7d-4c1e-9b0a-1d2e3f4a5b6c";
    expect(castVoteInput.safeParse({ pollId: id, optionIds: [] }).success).toBe(false);
    expect(castVoteInput.safeParse({ pollId: id, optionIds: [id, id] }).success).toBe(false);
    expect(castVoteInput.safeParse({ pollId: id, optionIds: [id] }).success).toBe(true);
  });
});
