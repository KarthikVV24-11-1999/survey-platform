// Integration tests only ever touch TEST_DATABASE_URL.
export function applyTestEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI sets it directly
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL to a disposable database to run integration tests.");
  Object.assign(process.env, {
    DATABASE_URL: url,
    APP_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
    HASH_SECRET: "test-hash-secret-test-hash-secret-1234",
    STORAGE_DRIVER: "local",
    CRON_SECRET: "test-cron-secret-0123456789",
    OPENAI_API_KEY: "",
    TURNSTILE_SECRET_KEY: "",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    RESEND_API_KEY: "",
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  });
  return url;
}
