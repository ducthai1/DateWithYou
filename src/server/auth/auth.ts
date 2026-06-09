import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { env } from "@/lib/env";

/**
 * Better Auth needs a Db at synchronous construction time, while Mongoose's
 * client only exists after an async connect — so a single shared pool isn't
 * feasible. Instead Better Auth gets its own MongoClient with a small pool and
 * Mongoose (app data) also caps its pool, keeping total connections well under
 * Atlas M0's ~500 cap (the real risk behind the connection-authority concern).
 *
 * Fallbacks keep `next build` working without secrets; real values are required
 * at runtime (set them in `.env.local`).
 */
const uri = env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/chuyen-cua-ca";

const globalForAuthDb = globalThis as unknown as {
  _authMongoClient?: MongoClient;
};
const client =
  globalForAuthDb._authMongoClient ?? new MongoClient(uri, { maxPoolSize: 5 });
globalForAuthDb._authMongoClient = client;

export const auth = betterAuth({
  database: mongodbAdapter(client.db(), { client }),
  secret: env.BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me",
  baseURL: env.BETTER_AUTH_URL ?? "http://localhost:4488",
  // Origin allow-list (Better Auth's CSRF guard). In dev we trust both localhost
  // and 127.0.0.1 on the app port so "Invalid origin" never depends on which
  // host string the browser used. Extra origins (e.g. a LAN IP for phone
  // testing) can be added via BETTER_AUTH_TRUSTED_ORIGINS without a code change.
  trustedOrigins: [
    ...(process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:4488", "http://127.0.0.1:4488"]),
    ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ],
  session: {
    // Cache the session in a short-lived signed cookie so most requests resolve
    // the user without a DB round-trip. Every tRPC call goes through
    // getSession; against a remote Atlas cluster that round-trip dominates
    // navigation latency. 5 min is the revocation lag we accept for it.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  emailAndPassword: {
    enabled: true,
    // v1 keeps sign-up frictionless: no email verification, and a tiny password
    // floor so registering means using the app immediately. Invite codes (not
    // verification) gate who can join a couple space.
    requireEmailVerification: false,
    minPasswordLength: 1,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  account: {
    accountLinking: {
      // Disabled in v1: with email verification not hard-blocking, auto-linking
      // would let an attacker pre-register an unverified email/password account
      // and capture a victim's later Google sign-in on the same email. Keeping
      // providers separate closes that takeover path.
      enabled: false,
    },
  },
});

// Fail fast at runtime in production if the real secret/URL weren't provided.
// Skipped during `next build` (phase-production-build) so the build stays green
// without secrets — the fallbacks above only exist for that build step.
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  (!env.BETTER_AUTH_SECRET || !env.MONGODB_URI)
) {
  throw new Error(
    "BETTER_AUTH_SECRET and MONGODB_URI are required in production",
  );
}
