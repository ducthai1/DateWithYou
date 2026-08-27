// TEMPORARY diagnostic — surfaces exactly what the SERVER (this Vercel region's
// datacenter IP) sees when resolving a maps link, plus how address-geocoding
// performs, so we can pick the right fix. Open on your phone:
//   /api/debug-maps?url=https://maps.app.goo.gl/XXXX
// SSRF-guarded (only Google map hosts, re-checked per hop). Remove after debug.
import { NextResponse } from "next/server";
import {
  resolveGeoFromMapsUrl,
  extractGeoFromText,
  isFetchableMapsUrl,
} from "@/server/lib/resolve-maps-geo";
import { geocodeAddress } from "@/server/lib/geocode-address";

export const dynamic = "force-dynamic";

const COOKIE = "CONSENT=YES+; SOCS=CAISEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg";
const UAS = {
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ios:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
};

// Every distinct high-precision coord pair in the text — so we can SEE whether
// the real place coords are present at all, or only the region-biased viewport.
function allCoordCandidates(text: string): string[] {
  const decoded = (() => { try { return decodeURIComponent(text); } catch { return text; } })();
  const hay = `${text}\n${decoded}`;
  const seen = new Set<string>();
  const res: string[] = [];
  const push = (lat: number, lng: number, tag: string) => {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return;
    const k = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (!seen.has(k)) { seen.add(k); res.push(`${k} [${tag}]`); }
  };
  for (const m of hay.matchAll(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/g)) push(+m[1], +m[2], "3d4d");
  for (const m of hay.matchAll(/!2d(-?\d{1,3}\.\d+)!3d(-?\d{1,2}\.\d+)/g)) push(+m[2], +m[1], "2d3d");
  for (const m of hay.matchAll(/staticmap\?[^"'<>]*?center=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/gi)) push(+m[1], +m[2], "staticmap");
  for (const m of hay.matchAll(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/g)) push(+m[1], +m[2], "@");
  for (const m of hay.matchAll(/\[null,null,(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)\]/g)) push(+m[1], +m[2], "nullnull");
  return res.slice(0, 25);
}

async function trace(url: string, ua: string) {
  const hops: Array<{ status: number; to: string | null }> = [];
  let current = url;
  let html = "";
  let error: string | null = null;
  for (let i = 0; i < 8; i++) {
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(7000),
        headers: {
          "User-Agent": ua,
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Cookie: COOKIE,
        },
      });
    } catch (e) {
      // Name only. These fetches build URLs containing an API key, and some
      // failure types carry the request URL in their message.
      error = e instanceof Error ? e.name : "unknown error";
      break;
    }
    const loc = res.headers.get("location");
    hops.push({ status: res.status, to: loc ? loc.slice(0, 110) : null });
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, current).href;
      if (!isFetchableMapsUrl(next)) { error = "redirect off allowed hosts"; break; }
      current = next;
      continue;
    }
    try { html = await res.text(); } catch (e) { error = `read: ${e}`; }
    break;
  }
  return {
    finalUrl: current.slice(0, 240),
    hops,
    htmlLen: html.length,
    error,
    consentWall: /consent\.google|\/sorry\/|unusual traffic|enablejs|recaptcha|captcha/i.test(html),
    title: (html.match(/<title[^>]*>([^<]{0,90})/i) || [])[1] ?? null,
    pickedCoords: extractGeoFromText(`${current}\n${html}`),
    allCoords: allCoordCandidates(`${current}\n${html}`),
  };
}

// Pull the "Name, address" out of …/maps/place/<here>/data=…
function extractPlaceQuery(finalUrl: string): string | null {
  const m = finalUrl.match(/\/maps\/place\/([^/]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " ")).trim() || null;
  } catch {
    return m[1].replace(/\+/g, " ");
  }
}

async function stadiaGeocode(query: string) {
  const key = process.env.STADIA_API_KEY;
  if (!key) return { error: "no STADIA_API_KEY" };
  try {
    const u = `https://api.stadiamaps.com/geocoding/v1/search?api_key=${key}&size=1&text=${encodeURIComponent(query)}`;
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { error: `status ${r.status}` };
    const j = (await r.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: { label?: string; confidence?: number } }> };
    const f = j.features?.[0];
    if (!f?.geometry?.coordinates) return { error: "no result" };
    const [lng, lat] = f.geometry.coordinates;
    return { coords: { lat, lng }, label: f.properties?.label ?? null, confidence: f.properties?.confidence ?? null };
  } catch (e) {
    // Name only — the URL above carries STADIA_API_KEY.
    return { error: e instanceof Error ? e.name : "unknown error" };
  }
}

/*
 * Debug endpoint, and it was reachable by anyone.
 *
 * It makes the server fetch a URL, run the geocoding chain and spend the
 * provider quota, and it reports the running commit — all useful while
 * diagnosing why a pasted Maps link resolves differently from a datacenter IP,
 * and none of it anyone else's business. It exists precisely to debug
 * production, so disabling it there would remove the point; it takes a token
 * instead.
 *
 * Fails closed: with no DEBUG_MAPS_TOKEN configured the route is off entirely,
 * so forgetting to set it cannot leave the endpoint open.
 */
function isAuthorised(req: Request): boolean {
  const expected = process.env.DEBUG_MAPS_TOKEN;
  if (!expected) return false;
  return new URL(req.url).searchParams.get("token") === expected;
}

export async function GET(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!url) return NextResponse.json({ error: "pass ?url=<maps link>" }, { status: 400 });
  if (!isFetchableMapsUrl(url))
    return NextResponse.json({ error: "not a fetchable Google maps URL", url }, { status: 400 });

  const [resolved, desktop] = await Promise.all([
    resolveGeoFromMapsUrl(url, geocodeAddress),
    trace(url, UAS.desktop),
  ]);

  const placeQuery = extractPlaceQuery(desktop.finalUrl);
  const geocode = placeQuery ? await stadiaGeocode(placeQuery) : { error: "no place name in URL" };

  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    region: process.env.VERCEL_REGION ?? null,
    /*
     * Presence only, never values. Adding an environment variable in Vercel
     * does not affect deployments that were already built, so "the key is set"
     * and "the running build can see the key" are different facts — and only
     * the second one matters. This reports the second.
     */
    keysVisibleToThisBuild: {
      trackasia: Boolean(process.env.TRACKASIA_API_KEY),
      google: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      mapbox: Boolean(process.env.MAPBOX_TOKEN),
      stadia: Boolean(process.env.STADIA_API_KEY),
    },
    input: url,
    resolvedByCurrentCode: resolved, // what the live resolver returns (the bug)
    placeQuery, // the "Name, address" we'd geocode
    stadiaGeocode: geocode, // Stadia's coords + precision for that address
    desktop, // finalUrl, every coord candidate in the HTML, what got picked
  });
}
