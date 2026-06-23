// TEMPORARY diagnostic — surfaces exactly what the SERVER (this Vercel region's
// datacenter IP) sees when resolving a maps link, so we can tell a Google
// bot-wall apart from a fetch/parse failure. Open on your phone:
//   /api/debug-maps?url=https://maps.app.goo.gl/XXXX
// SSRF-guarded (only Google map hosts, re-checked per hop). Remove after debug.
import { NextResponse } from "next/server";
import {
  resolveGeoFromMapsUrl,
  extractGeoFromText,
  isFetchableMapsUrl,
} from "@/server/lib/resolve-maps-geo";

export const dynamic = "force-dynamic";

const COOKIE = "CONSENT=YES+; SOCS=CAISEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg";
const UAS = {
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ios:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
};

async function trace(url: string, ua: string) {
  const hops: Array<{ status: number; from: string; to: string | null }> = [];
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
      error = String(e);
      break;
    }
    const loc = res.headers.get("location");
    hops.push({ status: res.status, from: current.slice(0, 110), to: loc ? loc.slice(0, 110) : null });
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, current).href;
      if (!isFetchableMapsUrl(next)) {
        error = "redirect off allowed hosts";
        break;
      }
      current = next;
      continue;
    }
    try {
      html = await res.text();
    } catch (e) {
      error = `read: ${e}`;
    }
    break;
  }
  return {
    finalUrl: current.slice(0, 240),
    hops,
    htmlLen: html.length,
    error,
    consentWall: /consent\.google|\/sorry\/|unusual traffic|enablejs|recaptcha|captcha/i.test(html),
    title: (html.match(/<title[^>]*>([^<]{0,90})/i) || [])[1] ?? null,
    hasStaticmap: /staticmap\?[^"'<>]*?center=/i.test(html),
    coords: extractGeoFromText(`${current}\n${html}`),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!url) return NextResponse.json({ error: "pass ?url=<maps link>" }, { status: 400 });
  if (!isFetchableMapsUrl(url))
    return NextResponse.json({ error: "not a fetchable Google maps URL", url }, { status: 400 });

  const [resolved, desktop, ios] = await Promise.all([
    resolveGeoFromMapsUrl(url),
    trace(url, UAS.desktop),
    trace(url, UAS.ios),
  ]);

  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    region: process.env.VERCEL_REGION ?? null,
    input: url,
    resolved, // what the real resolver returns on this server — the bottom line
    desktop, // does the desktop UA get coords, or a consent/sorry wall, on this IP?
    ios,
  });
}
