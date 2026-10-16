import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins/captcha";
import { magicLink } from "better-auth/plugins/magic-link";
import { eq } from "drizzle-orm";
import { cleanLine } from "@/lib/validation";
import { db } from "../db/client";
import { account, rateLimit, session, user, verification } from "../db/schema";
import { emailSignInEnabled, sendMagicLinkEmail } from "../email";
import { env } from "../env";

function displayName(name: string | null | undefined, email: string) {
  return (cleanLine(name ?? "") || email.split("@")[0] || "user").slice(0, 60);
}

function createAuth() {
  const e = env();
  const production = e.NODE_ENV === "production";

  const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};
  if (e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET) {
    socialProviders.github = { clientId: e.GITHUB_CLIENT_ID, clientSecret: e.GITHUB_CLIENT_SECRET };
  }
  if (e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: e.GOOGLE_CLIENT_ID,
      clientSecret: e.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    };
  }

  return betterAuth({
    appName: "Survey Platform",
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.APP_URL],
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit },
    }),
    // no passwords, only OAuth and email links
    emailAndPassword: { enabled: false },
    socialProviders,
    account: {
      // we don't use the tokens, but they get stored, so encrypt them
      encryptOAuthTokens: true,
      accountLinking: { enabled: true },
    },
    user: {
      additionalFields: {
        // input: false so users can't set these themselves
        role: { type: "string", input: false, defaultValue: "user" },
        trustLevel: { type: "string", input: false, defaultValue: "standard" },
        banned: { type: "boolean", input: false, defaultValue: false },
      },
      deleteUser: { enabled: true },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Off so bans and sign-outs apply immediately. Turn on if session lookups get expensive.
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/magic-link": { window: 300, max: 3 },
        "/sign-in/social": { window: 60, max: 10 },
        "/delete-user": { window: 3600, max: 3 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: [e.TRUSTED_IP_HEADER] },
      useSecureCookies: production,
      cookiePrefix: "sp",
    },
    telemetry: { enabled: false },
    databaseHooks: {
      user: {
        create: {
          // email sign-ups have no name, so use the part before the @
          before: async (newUser) => ({ data: { ...newUser, name: displayName(newUser.name, newUser.email) } }),
        },
        update: {
          before: async (changes) =>
            typeof changes.name === "string" ? { data: { ...changes, name: displayName(changes.name, "user@") } } : undefined,
        },
      },
      session: {
        create: {
          // existing sessions are deleted when the ban is applied
          before: async (newSession) => {
            const row = await db().query.user.findFirst({
              where: eq(user.id, newSession.userId),
              columns: { banned: true },
            });
            if (row?.banned) {
              throw new APIError("FORBIDDEN", { message: "This account has been suspended." });
            }
          },
        },
      },
    },
    plugins: [
      ...(emailSignInEnabled()
        ? [
            magicLink({
              expiresIn: 600,
              storeToken: "hashed",
              sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(email, url),
            }),
          ]
        : []),
      ...(e.TURNSTILE_SECRET_KEY
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: e.TURNSTILE_SECRET_KEY,
              endpoints: ["/sign-in/magic-link", "/sign-in/social"],
              expectedAction: "sign-in",
              ...(production ? { allowedHostnames: [new URL(e.APP_URL).hostname] } : {}),
            }),
          ]
        : []),
      // must be last
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}

export function signInMethods() {
  const e = env();
  return {
    github: Boolean(e.GITHUB_CLIENT_ID),
    google: Boolean(e.GOOGLE_CLIENT_ID),
    email: emailSignInEnabled(),
  };
}
