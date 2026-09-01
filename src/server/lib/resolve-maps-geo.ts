// Server-side coordinate extraction from any pasted map link, on any device.
//
// Coordinates come from one of three places, tried in order:
//   1. The URL string itself — desktop "Copy link" / address-bar URLs and Apple
//      Maps links carry coords inline (/@lat,lng, !3d!4d, ?ll=…). Exact, instant.
//   2. A redirect hop's URL — some short links 302 straight to a coord URL.
//   3. Geocoding the place's name+address — a mobile "Share" (maps.app.goo.gl)
//      resolves to a *data-only* place URL (…/place/Name/data=!1s0x…) with NO
//      coords in it, and Google WITHHOLDS the real coords from the scraped page
//      for datacenter IPs (it region-biases the page to the server's own
//      location — a Vercel sin1 box gets Singapore's coords for a Saigon shop).
//      So we never scrape the page body; instead we geocode the place's own
//      name+address (which names its city → region-independent).
//
// We never read the HTML body: it's both unreliable (region bias) and large.
// The address geocoder is injected (see resolveGeoFromMapsUrl) so this module
// has no network deps of its own and its parsers stay trivially testable.

export type LatLng = { lat: number; lng: number };

const FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_HOPS = 6;
// Per-redirect ceiling. We only follow redirects (no body download), so each
// hop is fast; this just bounds a stalled hop.
const REQUEST_TIMEOUT_MS = 5000;
// The two network phases are capped separately so their SUM stays well under a
// serverless function timeout (≈7s worst case, + DB ≈ under 10s). A healthy
// link finishes far inside both.
const REDIRECT_DEADLINE_MS = 3500;
const GEOCODE_DEADLINE_MS = 3500;

// Pre-consent so a datacenter IP isn't bounced to the consent interstitial
// before reaching the place URL we read the redirect target from.
const HEADERS: Record<string, string> = {
  "User-Agent": FETCH_UA,
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Cookie: "CONSENT=YES+; SOCS=CAISEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg",
};

const LAT = "(-?\\d{1,2}(?:\\.\\d+)?)";
const LNG = "(-?\\d{1,3}(?:\\.\\d+)?)";
const SEP = "(?:,|%2C|%2c)";

// Each pattern says which capture group is latitude vs longitude — Google's
// camera triple is (lng, lat), reversed from everything else. All regexes are
// global so extractGeoFromText can scan every occurrence (see below).
type CoordPattern = { re: RegExp; lat: 1 | 2; lng: 1 | 2 };

/*
 * Two tiers, and the difference between them is the whole bug this file exists
 * to avoid.
 *
 * EXACT patterns are the place's own marker: whatever they say IS the pin.
 * VIEWPORT patterns are where the camera happened to be pointing, which is
 * near the pin but not it — measured 3.02km away on a real shared link.
 *
 * They used to sit in one list, "most accurate first", and be searched as one.
 * That reads as a safe fallback and is not: a link WITHOUT a marker — the shape
 * a phone's Share button produces — matched the camera instead, returned a
 * non-null answer, and so the place's own name, sitting right there in the same
 * URL, was never looked up. Desktop links carry a marker and were exact; phone
 * links quietly landed kilometres out. Keeping the tiers apart is what lets the
 * name be tried in between.
 */
const EXACT_PATTERNS: CoordPattern[] = [
  { re: new RegExp(`!3d${LAT}!4d${LNG}`, "g"), lat: 1, lng: 2 }, // exact place marker
  // Rendered pin — unambiguously the page's subject. Ordered above the camera
  // triple so a page's *nearby* places (each with their own camera triple)
  // can't shadow the real pin.
  { re: new RegExp(`staticmap\\?[^"'<>]*?center=${LAT}${SEP}${LNG}`, "gi"), lat: 1, lng: 2 },
  // Camera/place triple `!2d{lng}!3d{lat}` — the form a mobile app-share's
  // data-only place page embeds when no staticmap is present. Decimals required
  // so it can't match integer zoom/index fields in the same `!Nd…` run.
  { re: new RegExp(`!2d(-?\\d{1,3}\\.\\d+)!3d(-?\\d{1,2}\\.\\d+)`, "g"), lat: 2, lng: 1 },
  { re: new RegExp(`[?&](?:q|query|ll|sll|saddr|daddr|destination|coordinate|viewpoint)=${LAT}${SEP}${LNG}`, "gi"), lat: 1, lng: 2 },
  // Desktop place array `[null,null,lat,lng]` — distinct from the mobile bare
  // `[lng,lat]` array we deliberately don't parse (too ambiguous).
  { re: new RegExp(`\\[null,null,${LAT},${LNG}\\]`, "g"), lat: 1, lng: 2 },
];

/** Where the camera was, not where the place is. Last resort, never first. */
const VIEWPORT_PATTERNS: CoordPattern[] = [
  { re: new RegExp(`[?&]center=${LAT}${SEP}${LNG}`, "gi"), lat: 1, lng: 2 },
  { re: new RegExp(`@${LAT},${LNG}`, "g"), lat: 1, lng: 2 },
];

function inRange(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    // 0,0 is almost always a parse artefact (Null Island), never a real pin here.
    !(lat === 0 && lng === 0)
  );
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function scan(haystack: string, patterns: CoordPattern[]): LatLng | null {
  const text = `${haystack}\n${safeDecode(haystack)}`;
  for (const { re, lat: latIdx, lng: lngIdx } of patterns) {
    // Scan every occurrence and take the first in-range one, so a leading
    // junk/out-of-range hit (or a nearby-place coordinate) doesn't shadow a
    // valid later match of the same pattern. matchAll needs the global flag
    // and is safe to reuse — it doesn't mutate the regex's lastIndex.
    for (const m of text.matchAll(re)) {
      const lat = Number(m[latIdx]);
      const lng = Number(m[lngIdx]);
      if (inRange(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

/*
 * A dropped pin's coordinate lives in the /place/ path segment, not in a data
 * blob, and in one of two spellings.
 *
 * This is how a phone shares somewhere that is not a listed business: long-press
 * the map, Share. Google names the "place" by its coordinate — either decimal
 * (`/place/10.762622,106.660172`) or degrees-minutes-seconds
 * (`/place/10°45'45.4"N 106°39'36.6"E`) — and then points the camera at a round
 * number nearby. Neither spelling matched anything, so the exact position sat
 * in the URL unread while the camera answered instead, about a kilometre out.
 *
 * Anchored to /place/ on purpose: a bare pair of decimals appears all over these
 * URLs (zoom levels, data indices, nearby places) and matching them loosely
 * would be worse than matching nothing.
 */
const PLACE_DECIMAL = new RegExp(`/place/${LAT}${SEP}${LNG}(?:[/?#]|$)`, "i");
const PLACE_DMS =
  /\/place\/(\d{1,2})[°\s](\d{1,2})['′](\d{1,2}(?:\.\d+)?)["″]?([NS])[+\s]+(\d{1,3})[°\s](\d{1,2})['′](\d{1,2}(?:\.\d+)?)["″]?([EW])/i;

function dms(deg: string, min: string, sec: string, hemi: string): number {
  const value = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return /[SW]/i.test(hemi) ? -value : value;
}

function extractPlaceSegmentGeo(haystack: string): LatLng | null {
  const text = `${haystack}\n${safeDecode(haystack).replace(/\+/g, " ")}`;
  const dec = text.match(PLACE_DECIMAL);
  if (dec) {
    const lat = Number(dec[1]);
    const lng = Number(dec[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }
  const m = text.match(PLACE_DMS);
  if (m) {
    const lat = dms(m[1], m[2], m[3], m[4]);
    const lng = dms(m[5], m[6], m[7], m[8]);
    if (inRange(lat, lng)) return { lat, lng };
  }
  return null;
}

/** The place's own marker, if the text carries one. Trustworthy as the pin. */
export function extractExactGeo(haystack: string): LatLng | null {
  return scan(haystack, EXACT_PATTERNS) ?? extractPlaceSegmentGeo(haystack);
}

/** The camera centre. Near the place, not the place. */
export function extractViewportGeo(haystack: string): LatLng | null {
  return scan(haystack, VIEWPORT_PATTERNS);
}

/**
 * Best coordinate pair in a blob of URL(s) + HTML, marker before camera.
 *
 * Callers that can do better than a camera centre should use the two tiers
 * directly — see resolveGeoFromMapsUrl.
 */
export function extractGeoFromText(haystack: string): LatLng | null {
  return extractExactGeo(haystack) ?? extractViewportGeo(haystack);
}

/** Straight-line metres between two points. */
function metresBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Pull the first http(s) URL out of pasted text (mobile clipboards often wrap it).
 *
 * The apostrophe is allowed on purpose. It used to be excluded along with the
 * other characters that delimit markup, and that silently cut a dropped-pin
 * link in half: Google writes those coordinates as degrees-minutes-seconds and
 * leaves the minute mark unencoded — `/place/10°45'45.4"N+106°39'36.6"E`. The
 * URL was truncated at the apostrophe, the stub was fetched anyway, and Google
 * answered with a place in Newfoundland for a pin in Saigon. This function only
 * ever reads text a person pasted, never HTML, so there is no attribute
 * delimiter here for it to protect against.
 */
export function extractFirstUrl(input: string): string | null {
  const m = input.trim().match(/https?:\/\/[^\s<>"()]+/i);
  if (!m) return null;
  let url = m[0].replace(/[.,)\]]+$/, ""); // trailing punctuation from prose
  // Unwrap Google's `…/url?q=<real-url>` and search redirect wrappers (one level).
  try {
    const u = new URL(url);
    if (/\.google\.[a-z.]+$/i.test(u.hostname)) {
      const inner = u.searchParams.get("q") || u.searchParams.get("url");
      if (inner && /^https?:\/\//i.test(inner)) url = inner;
    }
  } catch {
    /* keep url as-is */
  }
  return url;
}

// Resolution must never become a server-side request forgery (SSRF) primitive.
// We only ever fetch Google's own map hosts and their short-link domains, and
// re-check this on EVERY redirect hop — goo.gl is a general shortener and could
// otherwise open-redirect to an internal address. IP literals, IPv6 and
// localhost-family hosts are always refused.
function isAllowedMapsHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h || h.includes(":")) return false; // empty or IPv6 literal
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return false; // IPv4 literal
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (h === "maps.app.goo.gl" || h === "goo.gl" || h === "g.co" || h === "g.page") return true;
  // google.com, www.google.com, consent.google.com, google.co.uk, google.com.vn …
  // Anchored to the end so "google.com.evil.com" / "evilgoogle.com" never match.
  return /(?:^|\.)google(?:\.[a-z]{2,3}){1,2}$/.test(h);
}

// Exported for testing — the entire SSRF defence rests on this gate.
export function isFetchableMapsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (!isAllowedMapsHost(u.hostname)) return false;
    // goo.gl is a general-purpose shortener; only its /maps* links are maps.
    if (u.hostname === "goo.gl" && !u.pathname.startsWith("/maps")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull the place's own "Name, address" out of …/maps/place/<HERE>/data=… — the
 * label Google puts in the resolved URL. It names the city, so geocoding it is
 * region-independent. Returns null for the degenerate empty-place segment.
 */
export function extractPlaceQuery(url: string): string | null {
  const m = url.match(/\/maps\/place\/([^/?#]+)/);
  if (!m) return null;
  const decoded = safeDecode(m[1].replace(/\+/g, " ")).trim();
  return decoded && decoded !== "," ? decoded : null;
}

/**
 * Follow redirects by hand (SSRF-guarded per hop), returning coords found in any
 * hop URL plus the final resolved URL. The HTML body is never read — Google
 * region-biases the scraped page for datacenter IPs, so its body coords are
 * unreliable; we geocode the place name from the final URL instead.
 */
async function resolveFinalUrl(
  start: string,
  deadline: number,
): Promise<{ exact: LatLng | null; viewport: LatLng | null; finalUrl: string }> {
  let current = start;
  for (let i = 0; i < MAX_HOPS; i++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    /*
     * One retry, because the first attempt fails for reasons that have nothing
     * to do with the link.
     *
     * A bare `TypeError: fetch failed` — DNS not yet warm, a connection reset,
     * a cold serverless container reaching out for the first time — used to end
     * the whole resolution: the loop broke, the short link had no place name to
     * fall back to, and the answer was "no coordinates". The person saw a paste
     * that worked yesterday and refuses today, which is exactly how it was
     * reported. The identical request a moment later succeeds, so it is worth
     * asking twice before giving up.
     *
     * Timeouts are not retried — the deadline is there to be respected, and a
     * second wait would spend the caller's remaining budget on the same stall.
     */
    let res: Response | null = null;
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      const left = deadline - Date.now();
      if (left <= 0) break;
      try {
        res = await fetch(current, {
          redirect: "manual",
          signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, left)),
          headers: HEADERS,
        });
      } catch (err) {
        const timedOut = err instanceof Error && err.name === "TimeoutError";
        if (timedOut || attempt === 1) {
          console.error("resolve-maps-geo: fetch failed", current, err);
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    if (!res) break;
    void res.body?.cancel(); // never need the body
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      let next: string;
      try {
        next = new URL(loc, current).href;
      } catch {
        break;
      }
      // Only a real marker short-circuits here. Accepting a camera centre at
      // this point is what used to end resolution kilometres from the place.
      const hopGeo = extractExactGeo(next);
      if (hopGeo) return { exact: hopGeo, viewport: extractViewportGeo(next), finalUrl: next };
      if (!isFetchableMapsUrl(next)) break; // SSRF guard on every hop
      current = next;
      continue;
    }
    break; // terminal 2xx — `current` is the resolved place URL
  }
  return {
    exact: extractExactGeo(current),
    viewport: extractViewportGeo(current),
    finalUrl: current,
  };
}

/**
 * How far a name lookup may land from the camera before it is disbelieved.
 *
 * The camera in a shared place link sits within a few kilometres of the place —
 * 3km on the link this was measured against. A name lookup that comes back
 * further than this has found a different place with the same name, which the
 * geocoder warns about itself: a bare POI name earns a confident ROOFTOP answer
 * in the wrong province. The camera is then the honest answer, because it is at
 * least near where the person was looking.
 */
const NAME_DRIFT_LIMIT_M = 30_000;

/** Resolves a place name to a venue coordinate, biased toward a point. */
export type FindPlaceNear = (name: string, near: LatLng) => Promise<LatLng | null>;

/**
 * Resolve coordinates from any pasted Google/Apple Maps link (short or full),
 * on any device. Returns null when nothing usable can be recovered.
 *
 * Order matters, and it is not the order the patterns are listed in:
 *
 *   1. The place's own marker, from the pasted URL or any redirect hop. Exact.
 *   2. The place's NAME, resolved against a search biased to the camera centre
 *      from the same URL. This is the step a phone's Share link depends on:
 *      those resolve to a page carrying a name and a camera but no marker.
 *      The two signals check each other — the name gives the venue, the camera
 *      says which one of that name — and a result that drifts too far from the
 *      camera is rejected rather than believed.
 *   3. The camera centre. Kilometres out, but near, and the form says the
 *      position may be approximate and invites a tap on the map.
 *
 * `geocode` and `findPlaceNear` are injected so this module carries no network
 * dependency: callers pass the real resolvers; tests can omit them. Without
 * them, only links with inline/redirect coordinates resolve exactly.
 */
export async function resolveGeoFromMapsUrl(
  input: string,
  geocode: (query: string, deadline?: number) => Promise<LatLng | null> = async () => null,
  findPlaceNear?: FindPlaceNear,
): Promise<LatLng | null> {
  const url = extractFirstUrl(input);
  if (!url) return null;

  // 1a. A marker already in the pasted URL (full/desktop/Apple links).
  const direct = extractExactGeo(url);
  if (direct) return direct;
  // Nothing else can be done for a host we will not fetch; the camera in the
  // pasted link is better than refusing outright.
  if (!isFetchableMapsUrl(url)) return extractViewportGeo(url);

  // 1b. Resolve the short link to its place URL (redirects only, no body).
  const { exact, viewport, finalUrl } = await resolveFinalUrl(
    url,
    Date.now() + REDIRECT_DEADLINE_MS,
  );
  if (exact) return exact;

  const camera = viewport ?? extractViewportGeo(url);

  // 2. The place's own name, decided against the camera.
  const query = extractPlaceQuery(finalUrl);
  if (query) {
    const deadline = Date.now() + GEOCODE_DEADLINE_MS;
    const believable = (hit: LatLng | null) =>
      hit && (!camera || metresBetween(camera, hit) <= NAME_DRIFT_LIMIT_M) ? hit : null;

    if (findPlaceNear && camera) {
      const hit = believable(await findPlaceNear(query, camera).catch(() => null));
      if (hit) return hit;
    }
    const hit = believable(await geocode(query, deadline).catch(() => null));
    if (hit) return hit;
  }

  // 3. Near, and honest about it.
  return camera;
}
