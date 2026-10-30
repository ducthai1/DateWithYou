import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * The background tracker's password, derived rather than stored.
 *
 * HMAC of the link's id under the server secret: the setup link can be shown
 * again whenever someone needs to reopen the tracker, with nothing secret in
 * the database. Revoking is deleting the link — a new one has a new id and so
 * a new password. The label keeps this HMAC from ever matching one made for
 * another purpose with the same secret.
 */
const secret = () => env.BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me";

export function trackerPassword(linkId: string): string {
  return createHmac("sha256", secret()).update(`owntracks-link:${linkId}`).digest("base64url");
}

export function checkTrackerPassword(linkId: string, given: string): boolean {
  const want = Buffer.from(trackerPassword(linkId));
  const got = Buffer.from(given);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** `Authorization: Basic base64(user:pass)` → the pair, or null. */
export function readBasicAuth(header: string | null): { user: string; pass: string } | null {
  const m = header?.match(/^Basic\s+(.+)$/i);
  if (!m) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const i = decoded.indexOf(":");
  return i > 0 ? { user: decoded.slice(0, i), pass: decoded.slice(i + 1) } : null;
}
