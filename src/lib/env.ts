import "server-only";
import { z } from "zod";

/**
 * Server-side environment variables.
 * Most are optional at build time so `next build` works without secrets;
 * `requireEnv` enforces presence at runtime where the value is actually used.
 * Add new keys here AND in `.env.example` when a phase introduces them.
 */
const serverEnvSchema = z.object({
  // Phase 1 — database
  MONGODB_URI: z.string().min(1).optional(),

  // Phase 2 — auth (Better Auth + Google OAuth)
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),
  // Comma-separated extra origins to trust (e.g. a LAN IP for phone testing).
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Phase 2/7 — transactional email
  RESEND_API_KEY: z.string().optional(),

  // Phase 3 — Stadia Maps (Valhalla motor_scooter directions, server only)
  STADIA_API_KEY: z.string().optional(),
  // Google Maps Platform (server only) — exact place coords for pasted map
  // links via Places/Geocoding. Optional: without it, link resolution falls
  // back to approximate Stadia/OSM geocoding.
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Phase 5 — Cloudinary asset cleanup (server only)
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

export const env = serverEnvSchema.parse(process.env);

/** Throws a clear error if a required env var is missing at the point of use. */
export function requireEnv<K extends keyof typeof env>(
  key: K,
): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return value as NonNullable<(typeof env)[K]>;
}
