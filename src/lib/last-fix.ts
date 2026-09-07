/**
 * The last place this device knew it was.
 *
 * Different from the last place the MAP was looking. The map remembers its
 * camera after every move, programmatic ones included — so after a route was
 * framed, or a trip to the border was drawn, the remembered "view" could be a
 * point in the middle of nowhere, and the next visit with location switched
 * off opened there. What a person means by "where I was" is their last GPS
 * fix, and that is what this keeps: written every time a fix arrives from
 * anywhere in the app, read once when the map opens.
 */

const KEY = "vivu.map.lastFix";
/** Older than this and the fix is history, not a hint. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type LastFix = { lat: number; lng: number; at: number };

export function rememberLastFix(geo: { lat: number; lng: number }): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ lat: geo.lat, lng: geo.lng, at: Date.now() }));
  } catch {
    /* storage full or unavailable — the map still has its other fallbacks */
  }
}

export function readLastFix(): LastFix | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastFix>;
    if (typeof v.lat !== "number" || typeof v.lng !== "number" || typeof v.at !== "number") return null;
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return null;
    if (Date.now() - v.at > MAX_AGE_MS) return null;
    return { lat: v.lat, lng: v.lng, at: v.at };
  } catch {
    return null;
  }
}
