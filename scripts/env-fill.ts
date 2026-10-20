import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { parseEnv } from "node:util";

// Prompts for env values (hidden for secrets) and writes them to the file.
// Press Enter to skip one. --status just shows what's set.
//
//   npm run env:fill -- .env.deploy [KEY ...]
//   npm run env:fill -- .env.deploy --status
const SECRET = /SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL/;

const HINTS: Record<string, string> = {
  S3_ENDPOINT: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
  S3_BUCKET: "bucket name, e.g. survey-media",
  APP_URL: "https://<project>.vercel.app (no trailing slash)",
  OPENAI_API_KEY: "starts with sk-",
  TWILIO_ACCOUNT_SID: "starts with AC",
  TWILIO_VERIFY_SERVICE_SID: "starts with VA",
};

function normalize(key: string, value: string): { value: string } | { error: string } {
  const v = value.trim().replace(/^["']|["']$/g, "");
  if (/\s/.test(v)) return { error: "contains spaces, copy it again" };
  if (key === "S3_ENDPOINT" || key === "APP_URL") {
    try {
      const url = new URL(v);
      if (url.protocol !== "https:") return { error: "must start with https://" };
      // R2's dashboard shows the endpoint with the bucket on the end
      return { value: url.origin };
    } catch {
      return { error: "not a valid URL" };
    }
  }
  if (key === "OPENAI_API_KEY" && !v.startsWith("sk-")) return { error: "OpenAI keys start with sk-" };
  return { value: v };
}

// one reader for the whole run so piped input isn't dropped between prompts
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
const lines = rl[Symbol.asyncIterator]();
let muted = false;
let currentPrompt = "";
// Mask secret input. Readline redraws prompt + input together, so keep the prompt.
const output = rl as unknown as { _writeToOutput(s: string): void };
const echo = output._writeToOutput.bind(rl);
const bullets = (n: number) => "•".repeat(Math.min(n, 8));
output._writeToOutput = (s) => {
  if (!muted || /^\r?\n$/.test(s)) return echo(s);
  return echo(s.startsWith(currentPrompt) ? currentPrompt + bullets(s.length - currentPrompt.length) : bullets(s.length));
};

async function ask(question: string, hidden: boolean): Promise<string> {
  currentPrompt = question;
  rl.setPrompt(question);
  rl.prompt();
  muted = hidden;
  const { value, done } = await lines.next();
  muted = false;
  if (!process.stdin.isTTY) process.stdout.write("\n");
  return done ? "" : String(value);
}

async function main() {
  const args = process.argv.slice(2);
  const statusOnly = args.includes("--status");
  const [file, ...only] = args.filter((a) => a !== "--status");
  if (!file) throw new Error("Usage: npm run env:fill -- <env-file> [--status] [KEY ...]");
  const text = readFileSync(file, "utf8");
  const current = parseEnv(text);
  const inFileOrder = text.split("\n").flatMap((line) => line.match(/^([A-Z0-9_]+)=/)?.[1] ?? []);
  if (statusOnly) {
    for (const key of inFileOrder) console.log(`${current[key] ? "  set   " : "  EMPTY "} ${key}`);
    return;
  }
  const keys = only.length ? only : inFileOrder.filter((k) => !current[k]);
  if (!keys.length) return console.log("Nothing to fill.");

  const answers: Record<string, string> = {};
  console.log(`Paste each value and press Enter (input is hidden for secrets). Enter on its own skips.\n`);
  for (const key of keys) {
    for (;;) {
      const hint = HINTS[key] ? ` (${HINTS[key]})` : "";
      const raw = await ask(`${key}${hint}: `, SECRET.test(key));
      if (!raw.trim()) break;
      const result = normalize(key, raw);
      if ("error" in result) {
        console.log(`  ✗ ${result.error}`);
        continue;
      }
      answers[key] = result.value;
      console.log("  ✓ saved");
      break;
    }
  }

  const lines = text.split("\n").map((line) => {
    const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
    return key && key in answers ? `${key}=${answers[key]}` : line;
  });
  for (const key of Object.keys(answers)) {
    if (!lines.some((l) => l.startsWith(`${key}=`))) lines.push(`${key}=${answers[key]}`);
  }
  writeFileSync(file, lines.join("\n"), { mode: 0o600 });
  chmodSync(file, 0o600); // mode above only applies to new files
  console.log(`\nUpdated ${Object.keys(answers).length} value(s) in ${file}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
