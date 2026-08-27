// Region-independent address → coordinates.
//
// Why this exists: a mobile Google Maps share (maps.app.goo.gl) resolves to a
// data-only place URL that carries no coordinates — and Google withholds the
// real coordinates from the scraped page when the request comes from a
// datacenter IP (it region-biases the page to the server's own location, e.g.
// a Vercel sin1 server gets Singapore's coords for a Saigon shop). Geocoding
// the place's own name+address — which names its city — sidesteps that bias
// entirely. Empirically this lands within the right neighbourhood; the user can
// nudge the pin on the map for the last few hundred metres.

export type LatLng = { lat: number; lng: number };

// Upper bound per individual provider call; the overall phase is additionally
// capped by the caller-supplied deadline so a slow provider can't push an
// interactive mutation past the serverless function timeout.
const MAX_CALL_MS = 3500;

function inRange(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

// Google Maps Platform — the only source with the *exact* coordinates of a
// specific place (its own data), and it isn't IP/region-biased like the scraped
// page. Optional: only used when GOOGLE_MAPS_API_KEY is configured. Tries
// Places "Find Place" (matches the business itself) then Geocoding (the street
// address). Free tier ($200/mo credit) covers a couple-app's volume easily.
async function viaGoogle(query: string, timeoutMs: number): Promise<LatLng | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  // 1. Exact POI match for the business.
  try {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?inputtype=textquery&fields=geometry&key=${key}&input=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
      };
      const loc = data.candidates?.[0]?.geometry?.location;
      if (loc && inRange(loc.lat, loc.lng)) return { lat: loc.lat, lng: loc.lng };
    }
  } catch (err) {
    console.error("geocode-address: google find-place failed", err);
  }
  // 2. Street-address geocode fallback.
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?key=${key}&address=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) {
      const data = (await res.json()) as {
        results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
      };
      const loc = data.results?.[0]?.geometry?.location;
      if (loc && inRange(loc.lat, loc.lng)) return { lat: loc.lat, lng: loc.lng };
    }
  } catch (err) {
    console.error("geocode-address: google geocode failed", err);
  }
  return null;
}

// Mapbox — richer POI data than OSM (can find a chain business by name), and a
// free token needs no credit card. Optional: only used when MAPBOX_TOKEN is set.
async function viaMapbox(query: string, timeoutMs: number): Promise<LatLng | null> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url = `https://api.mapbox.com/search/geocode/v6/forward?limit=1&access_token=${token}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    const [lng, lat] = coords; // GeoJSON order is [lng, lat]
    return inRange(lat, lng) ? { lat, lng } : null;
  } catch (err) {
    console.error("geocode-address: mapbox failed", err);
    return null;
  }
}

// Stadia Maps (the app's existing routing provider) — Pelias geocoder. Reliable
// from datacenter IPs since it's an authenticated API, not a scraped page.
async function viaStadia(query: string, timeoutMs: number): Promise<LatLng | null> {
  const key = process.env.STADIA_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.stadiamaps.com/geocoding/v1/search?api_key=${key}&size=1&text=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    const [lng, lat] = coords; // GeoJSON order is [lng, lat]
    return inRange(lat, lng) ? { lat, lng } : null;
  } catch (err) {
    console.error("geocode-address: stadia failed", err);
    return null;
  }
}

// OpenStreetMap Nominatim — free fallback when Stadia has no match. Low volume
// only; a descriptive User-Agent is required by their usage policy.
async function viaNominatim(query: string, timeoutMs: number): Promise<LatLng | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "DateWithYou/1.0 (couple-space app; maps link resolver)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = data[0];
    if (!hit?.lat || !hit?.lon) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    return inRange(lat, lng) ? { lat, lng } : null;
  } catch (err) {
    console.error("geocode-address: nominatim failed", err);
    return null;
  }
}

// Google place labels are "Business Name, 404 Street, Ward, City". The full
// string geocodes best when the provider knows the POI; when it doesn't, a
// leading business name (no house number) just confuses it — so we also try the
// plain street address. Most specific first.
function queryVariants(q: string): string[] {
  const variants = [q];
  const parts = q.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2 && !/\d/.test(parts[0])) {
    const streetOnly = parts.slice(1).join(", ");
    /*
     * Only worth trying if something street-like survives. "Cà phê Cộng, Hà
     * Nội" reduces to "Hà Nội", and geocoding a bare city name returns its
     * centre — a confident-looking hit that is nowhere near the café. A
     * variant needs a number or at least two remaining components before it
     * says anything more specific than "this city".
     */
    if (/\d/.test(streetOnly) || parts.length >= 3) {
      variants.push(streetOnly);
    }
  }

  /*
   * Country-qualified variants.
   *
   * A bare Vietnamese address is ambiguous to a global geocoder: street names
   * like "Nguyễn Huệ" or "Lê Lợi" repeat in dozens of countries' datasets and
   * in most Vietnamese towns, so a query with no country can land on the wrong
   * continent and still look like a confident hit. Appending the country — and
   * the city when the text does not already name one — narrows it without
   * needing a Vietnam-specific provider.
   *
   * Added last: these are broader than what was typed, so they only run after
   * the more specific forms have missed.
   */
  const hasCountry = /việt\s*nam|vietnam/i.test(q);
  const hasCity = /hồ chí minh|ho chi minh|hcm|sài gòn|sai gon|hà nội|ha noi|đà nẵng|da nang|cần thơ|can tho|huế|hue/i.test(q);
  const tail = hasCity ? "Việt Nam" : "Thành phố Hồ Chí Minh, Việt Nam";
  if (!hasCountry) {
    for (const base of [...variants]) variants.push(`${base}, ${tail}`);
  }

  // De-duplicate: the two rules above can produce the same string, and each
  // duplicate is a wasted provider call against the time budget.
  return [...new Set(variants)];
}

/**
 * Best-effort address → coordinates. For each query variant, tries Stadia
 * (robust on server IPs) then OSM Nominatim; returns the first usable hit.
 *
 * `deadline` (absolute ms timestamp) caps the WHOLE phase so it can't push an
 * interactive mutation past the function timeout — each call is bounded by the
 * smaller of MAX_CALL_MS and the time left, and we stop once the budget runs
 * out. Best-effort: returns null rather than throwing when time/options run out.
 */
/**
 * Which service answered, and how much the query had to be widened to get an
 * answer.
 *
 * Worth returning because the caller shows the result for confirmation before
 * saving it, and "confirm this pin" is a much easier decision when you know
 * whether it came from Google's POI database or from a street-name guess on
 * OpenStreetMap. Without it the person is agreeing to a coordinate with no idea
 * how it was arrived at.
 */
export type GeocodeSource = "google" | "mapbox" | "stadia" | "nominatim";

export type GeocodeHit = LatLng & {
  source: GeocodeSource;
  /**
   * True when the hit came from a widened query rather than what was typed —
   * the street-only or country-appended variants. Those are looser by
   * construction, so a hit from one deserves a closer look on the map.
   */
  broadened: boolean;
};

const NAMED_PROVIDERS: Array<{
  source: GeocodeSource;
  run: (q: string, timeoutMs: number) => Promise<LatLng | null>;
}> = [
  // Most precise first. Each is a no-op unless its key is configured, so the
  // chain degrades to the key-free OSM providers on its own.
  { source: "google", run: viaGoogle },
  { source: "mapbox", run: viaMapbox },
];

const FALLBACK_PROVIDERS: typeof NAMED_PROVIDERS = [
  { source: "stadia", run: viaStadia },
  { source: "nominatim", run: viaNominatim },
];

/**
 * Best-effort address → coordinates, with attribution.
 *
 * `deadline` (absolute ms timestamp) caps the WHOLE phase so it cannot push an
 * interactive request past the function timeout — each call is bounded by the
 * smaller of MAX_CALL_MS and the time left, and the walk stops once the budget
 * runs out. Returns null rather than throwing when time or options run out.
 */
export async function geocodeAddressDetailed(
  query: string,
  deadline?: number,
): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (!q) return null;
  const budget = () => (deadline ? deadline - Date.now() : MAX_CALL_MS);

  // The exact query first, through the providers that know POIs.
  for (const { source, run } of NAMED_PROVIDERS) {
    if (budget() < 300) return null;
    const hit = await run(q, Math.min(MAX_CALL_MS, budget()));
    if (hit) return { ...hit, source, broadened: false };
  }

  // Then the key-free OSM providers, walking the widened variants. The first
  // variant is the original query, so a hit there is not "broadened".
  const variants = queryVariants(q);
  for (const [index, variant] of variants.entries()) {
    for (const { source, run } of FALLBACK_PROVIDERS) {
      const left = budget();
      if (left < 300) return null;
      const hit = await run(variant, Math.min(MAX_CALL_MS, left));
      if (hit) return { ...hit, source, broadened: index > 0 };
    }
  }
  return null;
}

/**
 * Coordinate-only form, kept because the save path only needs the point — it
 * resolves a pasted Maps link and has nowhere to show attribution.
 */
export async function geocodeAddress(
  query: string,
  deadline?: number,
): Promise<LatLng | null> {
  const hit = await geocodeAddressDetailed(query, deadline);
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}
