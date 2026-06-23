// Server-side coordinate extraction from any pasted map link, on any device.
//
// The same link carries its coordinates very differently by source:
//   - Desktop "Copy link" / address bar    -> coords in the URL (/@lat,lng, !3d!4d)
//   - Mobile app "Share" (maps.app.goo.gl)  -> redirects to a *data-only* place URL
//        (…/place/Name/data=!4m2!3m1!1s0x…) carrying only a feature id — NO coords
//        in the URL. They live only in the page HTML (the rendered
//        …/staticmap?center=lat,lng and the camera triple !2d{lng}!3d{lat}).
//   - Apple Maps                            -> coords in ?ll= / ?sll= / ?coordinate=
//
// Critical: Google's HTML differs by user-agent. The DESKTOP page embeds the
// staticmap + camera coords we can parse; the MOBILE page hides them (coords
// survive only as a bare [lng,lat] array — too ambiguous to parse safely). So
// resolution always fetches with a desktop UA, regardless of the user's device.
//
// We parse the URL string first (instant, no network), and only when that is
// empty follow the redirect chain by hand — scanning every hop URL (incl.
// percent-decoded consent `continue=` targets) plus the final desktop HTML.

export type LatLng = { lat: number; lng: number };

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_HOPS = 6;
// Per-fetch ceiling. A real Google chain (short link 302 → place page + ~170KB
// HTML) lands in ~1–2s, but Google's TTFB from a datacenter IP is variable, so
// this is generous: cutting a fetch off early just to chase "<2s" was throwing
// away the only response that actually carries the coordinates.
const REQUEST_TIMEOUT_MS = 6000;
// Hard ceiling across both attempts so an interactive mutation can never hang
// on a slow/dead redirect chain. Healthy links finish far inside it; only a
// genuinely slow/hostile host ever approaches it.
const TOTAL_DEADLINE_MS = 10000;
// Cap scanned HTML so a huge/hostile body can't blow up memory or regex time.
const MAX_HTML_CHARS = 2_000_000;

// Pre-consent so datacenter IPs get the real maps page, not the consent wall.
const HEADERS = (ua: string): Record<string, string> => ({
  "User-Agent": ua,
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Cookie: "CONSENT=YES+; SOCS=CAISEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg",
});

const LAT = "(-?\\d{1,2}(?:\\.\\d+)?)";
const LNG = "(-?\\d{1,3}(?:\\.\\d+)?)";
const SEP = "(?:,|%2C|%2c)";

// Each pattern says which capture group is latitude vs longitude — Google's
// camera triple is (lng, lat), reversed from everything else. All regexes are
// global so extractGeoFromText can scan every occurrence (see below).
type CoordPattern = { re: RegExp; lat: 1 | 2; lng: 1 | 2 };

// Most accurate first. The viewport (`@lat,lng`) is the camera centre and can
// sit far from the real pin, so it is the last resort.
const PATTERNS: CoordPattern[] = [
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
  { re: new RegExp(`[?&]center=${LAT}${SEP}${LNG}`, "gi"), lat: 1, lng: 2 }, // viewport-ish, acceptable fallback
  { re: new RegExp(`@${LAT},${LNG}`, "g"), lat: 1, lng: 2 }, // viewport — last resort
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

/**
 * Pure: pull the best coordinate pair out of a blob of URL(s) + HTML.
 * Scans both the raw and percent-decoded text so encoded links also match.
 */
export function extractGeoFromText(haystack: string): LatLng | null {
  const text = `${haystack}\n${safeDecode(haystack)}`;
  for (const { re, lat: latIdx, lng: lngIdx } of PATTERNS) {
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

/** Pull the first http(s) URL out of pasted text (mobile clipboards often wrap it). */
export function extractFirstUrl(input: string): string | null {
  const m = input.trim().match(/https?:\/\/[^\s<>"'()]+/i);
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

/** Follow redirects by hand so coords in any hop (or consent target) are not lost. */
async function followAndScan(
  start: string,
  ua: string,
  deadline: number,
): Promise<LatLng | null> {
  let current = start;
  const hopUrls: string[] = [];
  for (let i = 0; i < MAX_HOPS; i++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining)),
        headers: HEADERS(ua),
      });
    } catch (err) {
      console.error("resolve-maps-geo: fetch failed", current, err);
      break;
    }
    hopUrls.push(current);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      let next: string;
      try {
        next = new URL(loc, current).href;
      } catch {
        break;
      }
      // Short-circuit: full links 302 straight to a coord-bearing URL. Reading
      // coords out of the target string is safe even if we won't fetch it.
      const hopGeo = extractGeoFromText(next);
      if (hopGeo) return hopGeo;
      // Never follow a redirect off the allowed map hosts (SSRF guard).
      if (!isFetchableMapsUrl(next)) break;
      hopUrls.push(next);
      current = next;
      continue;
    }
    // Terminal response: scan the body together with every hop URL we saw.
    let html = "";
    try {
      html = (await res.text()).slice(0, MAX_HTML_CHARS);
    } catch {
      /* ignore body read errors */
    }
    return extractGeoFromText(`${hopUrls.join("\n")}\n${html}`);
  }
  return extractGeoFromText(hopUrls.join("\n"));
}

/**
 * Resolve coordinates from any pasted Google/Apple Maps link (short or full),
 * on any device. Returns null when the link carries no recoverable coordinates.
 */
export async function resolveGeoFromMapsUrl(input: string): Promise<LatLng | null> {
  const url = extractFirstUrl(input);
  if (!url) return null;

  // 1. Fast path — coords already in the URL string (full/desktop/Apple links).
  const direct = extractGeoFromText(url);
  if (direct) return direct;

  // 2. Network path — short links and data-only place URLs resolve only via the
  // page HTML. Always fetch with the desktop UA (the mobile layout hides coords
  // from any parseable form). A second desktop attempt covers a transient first
  // failure (cold function, momentary TTFB spike, fleeting consent wall).
  if (!isFetchableMapsUrl(url)) return null;
  const deadline = Date.now() + TOTAL_DEADLINE_MS;
  const first = await followAndScan(url, DESKTOP_UA, deadline);
  if (first) return first;
  if (Date.now() >= deadline) return null;
  return followAndScan(url, DESKTOP_UA, deadline);
}
