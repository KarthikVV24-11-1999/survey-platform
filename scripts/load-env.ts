// Loads .env.local, or only the file in ENV_FILE (e.g. ENV_FILE=.env.deploy).
// Variables already set in the environment win.
const explicit = process.env.ENV_FILE;
try {
  process.loadEnvFile(explicit ?? ".env.local");
} catch (err) {
  // a missing .env.local is fine in CI
  if (explicit) throw new Error(`Couldn't read ${explicit}`, { cause: err });
}
