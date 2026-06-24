// Deterministic regression tests for the maps-link → coordinate resolver.
// No network: covers the pure parsers and — critically — the SSRF host gate
// (isFetchableMapsUrl), which is the single point the whole fetch defence rests
// on. Run:  node --experimental-strip-types test-maps-geo.ts
import assert from "node:assert";
import {
  extractFirstUrl,
  extractGeoFromText,
  extractPlaceQuery,
  isFetchableMapsUrl,
} from "./src/server/lib/resolve-maps-geo.ts";

let n = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
function ok(name: string, cond: boolean) {
  n++;
  assert.ok(cond, `FAILED: ${name}`);
  console.log(`  ✓ ${name}`);
}

console.log("extractFirstUrl");
ok("bare", extractFirstUrl("https://maps.app.goo.gl/abc") === "https://maps.app.goo.gl/abc");
ok("text-wrapped", extractFirstUrl("Quán ngon https://maps.app.goo.gl/x ghé nhé") === "https://maps.app.goo.gl/x");
ok("trailing punct", extractFirstUrl("see (https://goo.gl/maps/AbC).") === "https://goo.gl/maps/AbC");
ok("google url-wrapper", extractFirstUrl("https://www.google.com/url?q=https://maps.app.goo.gl/d&sa=D") === "https://maps.app.goo.gl/d");
ok("no url", extractFirstUrl("plain text") === null);

console.log("extractGeoFromText");
{
  const g = extractGeoFromText("/maps/place/X/@10.7770,106.6953,17z");
  ok("@lat,lng", !!g && near(g.lat, 10.777) && near(g.lng, 106.6953));
}
{
  const g = extractGeoFromText("data=!3m1!4b1!4m6!3d10.776!4d106.700");
  ok("!3d!4d marker", !!g && near(g.lat, 10.776) && near(g.lng, 106.7));
}
{
  // exact marker must win over a viewport @ appearing earlier in the string
  const g = extractGeoFromText("/@21.03,105.85,17z/data=!3d10.776!4d106.700");
  ok("marker beats viewport", !!g && near(g.lat, 10.776));
}
{
  // Google camera triple is (lng, lat) — must NOT come out swapped. This is the
  // form a mobile app-share's data-only place page embeds.
  const g = extractGeoFromText("!1d5000!2d106.7122688!3d10.819993599999998!2m3");
  ok("camera !2d{lng}!3d{lat} (not swapped)", !!g && near(g.lat, 10.82) && near(g.lng, 106.712));
}
{
  // Rendered staticmap (the subject pin) must win over a nearby-place camera
  // triple that appears earlier in the HTML.
  const g = extractGeoFromText("nearby !2d100.5!3d13.7 … staticmap?center=10.8199936%2C106.7122688&");
  ok("staticmap beats earlier nearby camera", !!g && near(g.lat, 10.82) && near(g.lng, 106.712));
}
{
  // A leading out-of-range hit of a pattern must not block a later valid one.
  const g = extractGeoFromText("!2d200.0!3d10.8 … !2d106.7122688!3d10.819993599999998");
  ok("out-of-range first match skipped for later valid", !!g && near(g.lat, 10.82) && near(g.lng, 106.712));
}
{
  const g = extractGeoFromText('staticmap?center=10.82%2C106.71&zoom=15');
  ok("staticmap center (encoded)", !!g && near(g.lat, 10.82) && near(g.lng, 106.71));
}
{
  const g = extractGeoFromText("https://maps.apple.com/?ll=37.331,-122.031&q=Apple");
  ok("apple ll", !!g && near(g.lat, 37.331) && near(g.lng, -122.031));
}
{
  const g = extractGeoFromText("?api=1&destination=1.234,103.5");
  ok("destination", !!g && near(g.lat, 1.234) && near(g.lng, 103.5));
}
ok("0,0 rejected", extractGeoFromText("?q=0,0") === null);
ok("out-of-range rejected", extractGeoFromText("@999,999") === null);
ok("no coords", extractGeoFromText("https://maps.app.goo.gl/abc") === null);

console.log("extractPlaceQuery (name+address from resolved place URL)");
{
  const u = "https://www.google.com/maps/place/Nh%C3%A0+Thu%E1%BB%91c+FPT+Long+Ch%C3%A2u,+404+Nguy%E1%BB%85n+Oanh,+An+Nh%C6%A1n,+H%E1%BB%93+Ch%C3%AD+Minh+700000/data=!4m2!3m1!1s0x317529e8652ccba9:0x5e195207235c6c98";
  const q = extractPlaceQuery(u);
  ok("decodes name+address (HCMC)", q === "Nhà Thuốc FPT Long Châu, 404 Nguyễn Oanh, An Nhơn, Hồ Chí Minh 700000");
}
ok("no /place/ segment -> null", extractPlaceQuery("https://www.google.com/maps/@10.8,106.7,17z") === null);
ok("empty place segment -> null", extractPlaceQuery("https://www.google.com/maps/place//data=!1s0x0:0x0") === null);

console.log("isFetchableMapsUrl — ALLOW");
for (const u of [
  "https://maps.app.goo.gl/abc",
  "https://goo.gl/maps/AbC",
  "https://www.google.com/maps/place/X",
  "https://google.com/maps",
  "https://consent.google.com/m?continue=x",
  "https://www.google.co.uk/maps",
  "https://www.google.com.vn/maps",
  "http://maps.app.goo.gl/abc", // scheme upgraded at storage; fetch gate allows http host
]) ok(`allow ${u}`, isFetchableMapsUrl(u) === true);

console.log("isFetchableMapsUrl — DENY (SSRF guard)");
for (const u of [
  "https://169.254.169.254/maps", // cloud metadata
  "http://127.0.0.1/maps/place",
  "http://localhost:8080/maps",
  "https://foo.internal/maps",
  "https://attacker.example.com/maps/place", // arbitrary host w/ /maps path
  "https://goo.gl/abcd", // general shortener, non-maps path
  "https://google.com.evil.com/maps", // suffix spoof
  "https://evilgoogle.com/maps", // prefix spoof
  "https://googleapis.com/maps", // adjacent google* host
  "https://[::1]/maps", // IPv6 loopback
  "ftp://google.com/maps", // non-http scheme
  "https://maps.apple.com/?q=foo", // Apple not in fetch allowlist (inline-coords only)
]) ok(`deny ${u}`, isFetchableMapsUrl(u) === false);

console.log(`\n=== ${n} assertions passed ===`);
