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
export async function geocodeAddress(
  query: string,
  deadline?: number,
): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  const budget = () => (deadline ? deadline - Date.now() : MAX_CALL_MS);

  // Best providers first, on the full "name, address" query: Google (exact) then
  // Mapbox (rich POI). Both are no-ops unless their key/token is configured.
  for (const provider of [viaGoogle, viaMapbox]) {
    if (budget() < 300) return null;
    const hit = await provider(q, Math.min(MAX_CALL_MS, budget()));
    if (hit) return hit;
  }

  // Approximate, key-free fallbacks (OSM-based) with a street-only variant.
  for (const variant of queryVariants(q)) {
    for (const provider of [viaStadia, viaNominatim]) {
      const left = budget();
      if (left < 300) return null; // out of time — don't start another call
      const hit = await provider(variant, Math.min(MAX_CALL_MS, left));
      if (hit) return hit;
    }
  }
  return null;
}
