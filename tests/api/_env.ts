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
