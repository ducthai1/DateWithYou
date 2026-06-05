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
