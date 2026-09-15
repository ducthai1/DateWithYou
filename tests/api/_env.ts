/*
 * Points everything loaded after this module at a throwaway database.
 *
 * Two things force this to run first, before any app import:
 *   - `@/lib/env` parses process.env once, at module load, so a later
 *     assignment is never seen.
 *   - `connectToDatabase()` takes the database name from the URI path and
 *     caches the connection globally, so the first connect decides where the
 *     whole process writes.
 *
 * Hence a module with no imports of its own: ES modules evaluate their
 * dependencies in source order, so `import "./_env"` placed first in the
 * harness is guaranteed to have already run by the time the routers load.
 */

/** Every API test writes here, and nowhere else. */
export const TEST_DB = "DateWithYou_Test";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    "MONGODB_URI is not set. Run the API tests through `npm run test:api`, which passes --env-file.",
  );
}

const parts = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^?]*)(\?.*)?$/);
if (!parts) {
  throw new Error(
    "MONGODB_URI has no database in its path. Refusing to guess which database the tests would drop.",
  );
}

const [, base, current, query = ""] = parts;

/*
 * The tests drop their database on every run. Creating it next to production
 * data — same cluster, one typo away — is not a risk worth taking for a test
 * suite, so a production-looking URI stops the run instead.
 */
if (/prod|production/i.test(current)) {
  throw new Error(
    `MONGODB_URI points at "${current}", which looks like production. Refusing to run API tests against it.`,
  );
}

process.env.MONGODB_URI = `${base}/${TEST_DB}${query}`;

/** The database name the tests are actually about to use. */
export const TEST_URI = process.env.MONGODB_URI;

/*
 * The blog admin allowlist, pinned so the gating is testable.
 *
 * `@/lib/env` reads it once at module load, so it has to be decided here and
 * not inside a test. A file that wants the empty (fail-closed) list sets
 * TEST_ADMIN_EMAILS to "" before importing the harness — see
 * tests/api/_no-admins.ts.
 */
export const TEST_ADMIN_EMAIL = "admin@example.test";
process.env.ADMIN_EMAILS = process.env.TEST_ADMIN_EMAILS ?? TEST_ADMIN_EMAIL;

/*
 * No test may spend a real API call.
 *
 * `npm run test:api` loads the app's own `.env`, which carries live provider
 * keys — so the day planner's "find somewhere new" branch would quietly call
 * Google or Stadia for real, from a suite that runs on every push. That is
 * somebody's money and somebody's rate limit, spent by a test.
 *
 * Cleared here rather than remembered in each file: "no network in the tests"
 * has to be a property of the harness, not a habit. A test that WANTS a
 * provider sets its own key after importing this, and says so out loud.
 */
for (const key of [
  "GOOGLE_MAPS_API_KEY",
  "STADIA_API_KEY",
  // The key `suggestPlaces`, `placeDetail` and `areaAt` reach for FIRST — and
  // the one this list forgot, which made "no network" a claim rather than a
  // property on any machine that had it set.
  "TRACKASIA_API_KEY",
  "DAY_PLAN_LLM_URL",
  "DAY_PLAN_LLM_KEY",
]) {
  delete process.env[key];
}
/*
 * The forecast needs no key, so deleting one cannot switch it off. Its
 * endpoint is configurable — Open-Meteo is open source and people self-host it
 * — and an empty one means "no forecast", which is exactly what a test suite
 * wants. A test that WANTS weather points this at a fixture server.
 */
process.env.WEATHER_API_BASE = "";
