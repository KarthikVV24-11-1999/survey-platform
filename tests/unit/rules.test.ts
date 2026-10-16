import { describe, expect, it } from "vitest";
import { type ContentToCheck, extractUrls, hostnameMatches, normalizeForMatching, runRules } from "@/server/moderation/rules";

const content = (patch: Partial<ContentToCheck> = {}): ContentToCheck => ({
  title: "Which framework do you prefer?",
  description: "",
  options: ["React", "Vue"],
  linkTitles: [],
  urls: [],
  ...patch,
});

describe("normalizeForMatching", () => {
  it("lowercases, strips accents and undoes leetspeak", () => {
    expect(normalizeForMatching("CRÈME Br0wn $p4m")).toBe("creme brown spam");
  });
});

describe("runRules", () => {
  it("passes clean content", () => {
    expect(runRules(content(), [], { profanity: true })).toEqual({ block: [], flag: [] });
  });

  it("matches admin words as whole words, through obfuscation", () => {
    const terms = [{ kind: "word" as const, value: "casino", action: "block" as const }];
    expect(runRules(content({ title: "Best C4SINO bonus?" }), terms, { profanity: false }).block).toHaveLength(1);
    expect(runRules(content({ title: "Casinos near me" }), terms, { profanity: false }).block).toHaveLength(0);
  });

  it("does not let admin terms inject regex patterns", () => {
    const terms = [{ kind: "word" as const, value: "a.*", action: "flag" as const }];
    expect(runRules(content({ title: "anything at all" }), terms, { profanity: false }).flag).toHaveLength(0);
  });

  it("matches blocked domains including subdomains", () => {
    const terms = [{ kind: "domain" as const, value: "bad.example", action: "flag" as const }];
    const r = runRules(content({ urls: ["https://www.bad.example/path"] }), terms, { profanity: false });
    expect(r.flag[0]).toContain("bad.example");
  });

  it("flags profanity only when enabled", () => {
    expect(runRules(content({ title: "this is sh1t" }), [], { profanity: true }).flag).toContain("Profanity");
    expect(runRules(content({ title: "this is sh1t" }), [], { profanity: false }).flag).not.toContain("Profanity");
  });

  it("flags spam heuristics", () => {
    const many = Array.from({ length: 6 }, (_, i) => `https://x${i}.example`).join(" ");
    expect(runRules(content({ description: many }), [], { profanity: false }).flag[0]).toContain("Many links");
    expect(runRules(content({ title: "VOTE FOR THIS RIGHT NOW PLEASE" }), [], { profanity: false }).flag).toContain("Title is mostly capital letters");
    expect(runRules(content({ title: "sooooooooooooo good" }), [], { profanity: false }).flag).toContain("Long runs of repeated characters");
  });
});

describe("hostnameMatches", () => {
  it("does not match lookalike suffixes", () => {
    expect(hostnameMatches("https://notbad.example", "bad.example")).toBe(false);
    expect(hostnameMatches("https://bad.example.evil.com", "bad.example")).toBe(false);
    expect(hostnameMatches("https://BAD.example.", "bad.example")).toBe(true);
  });
});

describe("extractUrls", () => {
  it("finds http(s) links in markdown", () => {
    expect(extractUrls("see [x](https://a.example/p) and http://b.example")).toEqual(["https://a.example/p", "http://b.example"]);
  });
});
