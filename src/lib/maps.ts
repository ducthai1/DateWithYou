// Deep-link builders for native turn-by-turn navigation. There is no single
// "universal" URL — iOS without Google Maps falls back to the web — so we offer
// both and let the user pick (Apple on Apple devices, Google elsewhere).

export type LatLng = { lat: number; lng: number };

/**
 * How long a partner's last ping stays usable as "where they are now".
 *
 * Shared deliberately: the server query filters on it, and any client cache of
 * a partner position must check against the same number. They used to disagree
 * by omission — the server returned only pings from the last five minutes, but
 * the map page kept its own copy of the last partner position that was never
 * cleared and never checked, then preferred that copy over asking the server.
 * A cached fix hours old was used to compute a "meeting point in the middle".
 */
export const PARTNER_FIX_FRESH_MS = 5 * 60 * 1000;

/** True when a partner fix is recent enough to treat as their current position. */
export function isPartnerFixFresh(updatedAt: Date | string | number): boolean {
  const ts = new Date(updatedAt).getTime();
  return Number.isFinite(ts) && Date.now() - ts < PARTNER_FIX_FRESH_MS;
}

export function googleMapsDirectionsUrl(dest: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
}

export function appleMapsDirectionsUrl(dest: LatLng): string {
  return `https://maps.apple.com/?daddr=${dest.lat},${dest.lng}`;
}

/** Rough Apple-device detection so we can surface the better default first. */
export function prefersAppleMaps(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
}

/** 
 * Calculate distance between two coordinates in meters using the Haversine formula. 
 */
export function calculateDistance(p1: LatLng, p2: LatLng): number {
  const R = 6371e3; // Earth's radius in meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/** 
 * Calculate the exact geographic midpoint between two coordinates. 
 */
export function calculateMidpoint(p1: LatLng, p2: LatLng): LatLng {
  const lat1 = (p1.lat * Math.PI) / 180;
  const lng1 = (p1.lng * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const lng2 = (p2.lng * Math.PI) / 180;

  const Bx = Math.cos(lat2) * Math.cos(lng2 - lng1);
  const By = Math.cos(lat2) * Math.sin(lng2 - lng1);

  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By),
  );
  const lng3 = lng1 + Math.atan2(By, Math.cos(lat1) + Bx);

  return {
    lat: (lat3 * 180) / Math.PI,
    lng: (lng3 * 180) / Math.PI,
  };
}

/**
 * Whether a place is open at a given moment, from its "HH:mm" opening hours.
 *
 * Extracted from the wheel, which had it inline, because the meeting-point
 * finder needs the same rule. A place that has not been given hours counts as
 * open: there is no basis to exclude it, and silently hiding pins someone saved
 * would look like data loss.
 */
export function parseClockMinutes(value?: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function isOpenAt(
  place: { openTime?: string | null; closeTime?: string | null },
  when: Date,
): boolean {
  const open = parseClockMinutes(place.openTime);
  const close = parseClockMinutes(place.closeTime);
  if (open === null || close === null) return true;

  const now = when.getHours() * 60 + when.getMinutes();
  // A close time earlier than the open time means the place runs past midnight
  // (18:00–02:00), so the open window wraps around the end of the day.
  return open <= close ? now >= open && now <= close : now >= open || now <= close;
}
