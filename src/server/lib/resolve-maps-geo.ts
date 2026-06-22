// Server-side coordinate extraction from any pasted map link, on any device.
//
// The hard part is that the *same* link, shared from different places, carries
// its coordinates very differently:
//   - Desktop "Copy link" / address bar  -> coords live in the URL (/@lat,lng, !3d!4d)
//   - Mobile app "Share" (maps.app.goo.gl) -> redirects to a data-only place URL
//        (…/place//data=!4m2!3m1!1s0x…) whose coords exist ONLY in the page HTML,
//        surfaced through the rendered staticmap (…/staticmap?center=lat,lng).
//   - Apple Maps                          -> coords in ?ll= / ?sll= / ?coordinate=
//
// So we: parse the URL string first (instant, no network), and only when that
// is empty do we follow the redirect chain by hand — scanning every hop URL
// (including percent-decoded consent `continue=` targets) plus the final HTML.

export type LatLng = { lat: number; lng: number };

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const MAX_HOPS = 6;
const REQUEST_TIMEOUT_MS = 5000;
// A healthy Google link resolves in ~0.1–0.3s, so the first (desktop-UA) pass
// is held to a tight budget: it catches every legit link well inside this, and
// the cap only ever bites a stalled/hostile first hop.
const FAST_PASS_BUDGET_MS = 2000;
// Hard ceiling across both passes so an interactive mutation can never hang on
// a slow/dead redirect chain. Only ever reached by the fallback pass on a
// genuinely dead/hostile host — and stays under the platform function timeout.
const TOTAL_DEADLINE_MS = 8000;
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

// Most accurate first. The viewport (`@lat,lng`) is the camera centre and can
// sit far from the real pin, so it is the last resort.
const PATTERNS: RegExp[] = [
  new RegExp(`!3d${LAT}!4d${LNG}`), // exact place marker
  new RegExp(`staticmap\\?[^"'<>]*?center=${LAT}${SEP}${LNG}`, "i"), // rendered pin
  new RegExp(`[?&](?:q|query|ll|sll|saddr|daddr|destination|coordinate|viewpoint)=${LAT}${SEP}${LNG}`, "i"),
  new RegExp(`\\[null,null,${LAT},${LNG}\\]`), // modern maps HTML place array
  new RegExp(`[?&]center=${LAT}${SEP}${LNG}`, "i"), // viewport-ish, acceptable fallback
  new RegExp(`@${LAT},${LNG}`), // viewport — last resort
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
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
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

  // 1. Fast path — coords already in the URL string (desktop/full/Apple links).
  const direct = extractGeoFromText(url);
  if (direct) return direct;

  // 2. Network path — short links and data-only place URLs need resolving.
  if (!isFetchableMapsUrl(url)) return null;

  const startedAt = Date.now();
  // Fast pass: a healthy link resolves here in a fraction of a second; bounded
  // so a slow/hostile first hop can never drag a normal paste past ~2s.
  const desktop = await followAndScan(url, DESKTOP_UA, startedAt + FAST_PASS_BUDGET_MS);
  if (desktop) return desktop;

  // 3. Fallback: only on a miss, drawing the remaining budget up to the hard
  // ceiling. The mobile layout returns different (often richer) HTML.
  const totalDeadline = startedAt + TOTAL_DEADLINE_MS;
  if (Date.now() >= totalDeadline) return null;
  return followAndScan(url, IOS_UA, totalDeadline);
}
