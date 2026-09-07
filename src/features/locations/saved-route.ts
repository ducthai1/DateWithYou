import type { LegInfo } from "./use-live-navigation";

/**
 * The route of the ride in progress, kept on the device.
 *
 * The ride itself was already remembered (see RIDE_KEY in locations-page) so a
 * killed tab could offer to pick it up — but only the destination was kept and
 * the route was fetched again. Fine on Wi-Fi at home; useless on a bike with no
 * signal, which is exactly when a tab is most likely to have been killed. With
 * the line and its turn list stored, "Tiếp tục" works with no network at all,
 * and a "Chỉ đường" to the same place while offline draws the last known line
 * instead of an error.
 *
 * Three hours, like the ride record: long enough for any trip, short enough
 * that a stale line is never mistaken for today's.
 */
const KEY = "vivu.ride.route";
const MAX_AGE_MS = 3 * 3600_000;

export type SavedRoute = {
  locationId: string;
  savedAt: number;
  geometry: unknown;
  legs: LegInfo[];
  distanceMeters: number;
  durationSeconds: number;
  /** Drawn as coloured legs (a trip with stops) rather than one merged line. */
  multiLeg: boolean;
};

export function rememberRoute(route: Omit<SavedRoute, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...route, savedAt: Date.now() }));
  } catch {
    // Quota or private mode — the ride is unaffected; only offline resume is.
  }
}

export function readSavedRoute(locationId: string): SavedRoute | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedRoute>;
    if (v.locationId !== locationId || typeof v.savedAt !== "number") return null;
    if (Date.now() - v.savedAt > MAX_AGE_MS) return null;
    if (!Array.isArray(v.legs) || typeof v.distanceMeters !== "number" || typeof v.durationSeconds !== "number")
      return null;
    return v as SavedRoute;
  } catch {
    return null;
  }
}

export function forgetSavedRoute(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
