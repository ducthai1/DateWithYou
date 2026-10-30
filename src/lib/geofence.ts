import { calculateDistance, type LatLng } from "@/lib/maps";

/**
 * Inside or outside one circle — "Nhà" or today's meeting point — decided from
 * what the background tracker sends.
 *
 * Two kinds of evidence arrive. A plain fix every 25 s while moving, and a
 * `transition` the phone itself raises when it crosses a region we installed
 * on it (src/lib/owntracks.ts). The transition is what works with the phone
 * asleep on a table; the fixes are what works if the region never got
 * installed, or iOS dropped it. Both feed the same state, so one crossing is
 * announced once whichever arrives first.
 */

export type FenceState = {
  inside: boolean | null;
  /** The newest evidence already counted, ms. Anything older is a late queue flush. */
  at: number | null;
};

export const EMPTY_FENCE: FenceState = { inside: null, at: null };

/**
 * Past the edge by at least this before "left" — a fix wobbling on the line
 * would otherwise announce leaving and coming home every few minutes.
 */
export const FENCE_LEAVE_MARGIN_M = 60;
/** A fix vaguer than this cannot say which side of the line it is on. */
export const FENCE_MAX_ACCURACY_M = 200;

export type FenceInput =
  | { kind: "fix"; lat: number; lng: number; accuracy: number | null; at: number }
  | { kind: "transition"; event: "enter" | "leave"; at: number };

export function stepFence(
  state: FenceState,
  fence: LatLng & { radiusM: number },
  input: FenceInput,
): { state: FenceState; event: "enter" | "leave" | null } {
  if (state.at !== null && input.at <= state.at) return { state, event: null };

  let inside: boolean;
  if (input.kind === "transition") {
    inside = input.event === "enter";
  } else {
    const acc = input.accuracy ?? 50;
    if (acc > FENCE_MAX_ACCURACY_M) return { state, event: null };
    const d = calculateDistance(fence, input);
    if (d <= fence.radiusM) inside = true;
    else if (d > fence.radiusM + Math.max(FENCE_LEAVE_MARGIN_M, acc)) inside = false;
    // On the line: keep what we knew rather than guess.
    else return { state, event: null };
  }

  const next = { inside, at: input.at };
  /*
   * The first reading after a circle is set says where someone is, not that
   * they just moved: setting "Nhà" while standing in the living room must not
   * tell the other person "vừa về nhà".
   */
  if (state.inside === null || state.inside === inside) return { state: next, event: null };
  return { state: next, event: inside ? "enter" : "leave" };
}

/** Two announcements for the same circle closer than this: the second is GPS, not a trip. */
export const FENCE_REPEAT_MS = 10 * 60_000;
/** Evidence older than this is history; telling someone about it now would mislead. */
export const FENCE_NEWS_MAX_AGE_MS = 10 * 60_000;

export function shouldAnnounce(
  eventAt: number,
  lastAnnouncedAt: number | null,
  now: number,
): boolean {
  if (now - eventAt > FENCE_NEWS_MAX_AGE_MS) return false;
  return lastAnnouncedAt === null || now - lastAnnouncedAt >= FENCE_REPEAT_MS;
}
