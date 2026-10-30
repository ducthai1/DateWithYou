import { calculateDistance } from "@/lib/maps";

/**
 * "Hai bạn đã gặp nhau", decided on the server.
 *
 * The in-app version (src/features/locations/meeting-flare.tsx) only runs while
 * both screens are open, and uses 30 m because a phone in hand on navigation
 * has a few metres of error. Here at least one side is a tracker in a pocket,
 * reporting every 25 s with tens of metres of error, so the radius widens with
 * the two fixes' own accuracy — capped, or two people a street apart in heavy
 * cloud would "meet".
 */

export type MeetFix = { lat: number; lng: number; accuracy: number | null; at: number };
export type MeetState = { together: boolean | null; at: number | null };

export const MEET_BASE_M = 40;
export const MEET_ACCURACY_CAP_M = 80;
/** Apart again only past this — otherwise a jittery fix re-announces the same meeting. */
export const APART_M = 200;
/** A fix older than this is not where someone IS. */
export const MEET_FIX_FRESH_MS = 3 * 60_000;

export function stepMeeting(
  state: MeetState,
  a: MeetFix,
  b: MeetFix,
  now: number,
): { state: MeetState; met: boolean } {
  if (now - a.at > MEET_FIX_FRESH_MS || now - b.at > MEET_FIX_FRESH_MS) return { state, met: false };
  const d = calculateDistance(a, b);
  const allowance = Math.min((a.accuracy ?? 30) + (b.accuracy ?? 30), MEET_ACCURACY_CAP_M);

  let together: boolean;
  if (d <= MEET_BASE_M + allowance) together = true;
  else if (d >= APART_M) together = false;
  else return { state, met: false };

  const next = { together, at: now };
  // First look: already side by side is not a meeting that just happened.
  if (state.together === null || state.together === together) return { state: next, met: false };
  return { state: next, met: together };
}
