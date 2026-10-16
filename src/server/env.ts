import { z } from "zod";

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    // e.g. https://polls.example.com, no trailing slash
    APP_URL: z.url().transform((v) => v.replace(/\/+$/, "")),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    // for hashing anonymous voter tokens and IPs
    HASH_SECRET: z.string().min(32, "HASH_SECRET must be at least 32 characters"),

    GITHUB_CLIENT_ID: optional,
    GITHUB_CLIENT_SECRET: optional,
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,

    RESEND_API_KEY: optional,
    EMAIL_FROM: optional,

    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
    TURNSTILE_SECRET_KEY: optional,

    OPENAI_API_KEY: optional,

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    S3_ENDPOINT: optional,
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,

    CRON_SECRET: optional,
    // set by the host's edge, x-real-ip on Vercel
    TRUSTED_IP_HEADER: z.string().default("x-real-ip"),
  })
  .superRefine((env, ctx) => {
    const pair = (a: string | undefined, b: string | undefined, name: string) => {
      if (Boolean(a) !== Boolean(b)) {
        ctx.addIssue({ code: "custom", message: `${name}: set both the client id and secret, or neither` });
      }
    };
    pair(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, "GitHub OAuth");
    pair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, "Google OAuth");
    pair(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, env.TURNSTILE_SECRET_KEY, "Turnstile");
    if (env.RESEND_API_KEY && !env.EMAIL_FROM) {
      ctx.addIssue({ code: "custom", message: "EMAIL_FROM is required when RESEND_API_KEY is set" });
    }
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", message: `${key} is required when STORAGE_DRIVER=s3` });
      }
    }

    if (env.NODE_ENV !== "production") return;
    // production won't start without these
    if (env.STORAGE_DRIVER !== "s3") {
      ctx.addIssue({ code: "custom", message: "STORAGE_DRIVER must be s3 in production" });
    }
    if (!env.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({ code: "custom", message: "Turnstile keys are required in production" });
    }
    if (!env.CRON_SECRET || env.CRON_SECRET.length < 16) {
      ctx.addIssue({ code: "custom", message: "CRON_SECRET (16+ chars) is required in production" });
    }
    if (!env.APP_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", message: "APP_URL must use https in production" });
    }
    if (!env.GITHUB_CLIENT_ID && !env.GOOGLE_CLIENT_ID && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", message: "Configure at least one sign-in method (GitHub, Google or Resend email)" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// parsed on first use so builds don't need secrets
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`);
      throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
