// Deep-link builders for native turn-by-turn navigation. There is no single
// "universal" URL — iOS without Google Maps falls back to the web — so we offer
// both and let the user pick (Apple on Apple devices, Google elsewhere).

export type LatLng = { lat: number; lng: number };

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
