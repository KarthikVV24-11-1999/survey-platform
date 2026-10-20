// Word and domain lists, a profanity filter and a few spam checks.
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

export type ModerationTerm = { kind: "word" | "domain"; value: string; action: "flag" | "block" };

export type ContentToCheck = {
  title: string;
  description: string;
  options: string[];
  linkTitles: string[];
  // links, video URLs and links in the description
  urls: string[];
};

export type RuleFindings = { block: string[]; flag: string[] };

const profanityMatcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

export const hasProfanity = (text: string) => profanityMatcher.hasMatch(text);

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

export function normalizeForMatching(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function containsTerm(haystack: string, term: string) {
  const needle = normalizeForMatching(term).trim();
  if (!needle) return false;
  // whole word only, escaped so a term can't act as a regex
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, "u").test(haystack);
}

export function hostnameMatches(url: string, domain: string) {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return false;
  }
  const d = domain.toLowerCase().replace(/^\*?\./, "").replace(/\.$/, "");
  return host === d || host.endsWith(`.${d}`);
}

const URL_IN_TEXT = /https?:\/\/[^\s<>()[\]"'`]+/gi;

export function extractUrls(text: string, max = 50) {
  return (text.match(URL_IN_TEXT) ?? []).slice(0, max);
}

export function runRules(content: ContentToCheck, terms: ModerationTerm[], opts: { profanity: boolean }): RuleFindings {
  const block = new Set<string>();
  const flag = new Set<string>();
  const combined = [content.title, content.description, ...content.options, ...content.linkTitles].join("\n");
  const normalized = normalizeForMatching(combined);

  for (const term of terms) {
    const hit =
      term.kind === "word"
        ? containsTerm(normalized, term.value)
        : content.urls.some((url) => hostnameMatches(url, term.value));
    if (!hit) continue;
    const label = term.kind === "word" ? `Listed term "${term.value}"` : `Listed domain "${term.value}"`;
    (term.action === "block" ? block : flag).add(label);
  }

  if (opts.profanity && profanityMatcher.hasMatch(combined)) flag.add("Profanity");

  const descriptionLinks = extractUrls(content.description).length;
  if (descriptionLinks > 5) flag.add(`Many links in description (${descriptionLinks})`);

  const letters = content.title.replace(/[^\p{L}]/gu, "");
  const upper = letters.replace(/[^\p{Lu}]/gu, "");
  if (letters.length >= 12 && upper.length / letters.length > 0.8) flag.add("Title is mostly capital letters");

  if (/(.)\1{9,}/u.test(combined)) flag.add("Long runs of repeated characters");

  return { block: [...block], flag: [...flag] };
}
