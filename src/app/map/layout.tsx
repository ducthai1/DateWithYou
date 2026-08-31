import type { ReactNode } from "react";

/**
 * The map's tile-server assets — style, sprite, glyphs, tilejson — are ~410 KB
 * that MapLibre cannot ask for until its own 267 KB bundle has downloaded and
 * parsed. Measured on a throttled phone profile that made the whole route
 * strictly serial: JS finished at 3.2s, the style request left at 3.3s, glyphs
 * only at 4.7s (they wait on the first tile), and the map painted at 6.4s.
 *
 * None of those bytes depend on the JS. This script ships inside the route's
 * HTML, so the browser starts them while the bundle is still downloading and
 * they are sitting in the HTTP cache by the time MapLibre asks. Every URL here
 * is `public, max-age=…` with `access-control-allow-origin: *`, so the warm
 * response is a plain cache hit later — including from MapLibre's worker, which
 * shares the same HTTP cache.
 *
 * Keep the URLs byte-identical to what MapLibre requests (see the style at
 * https://tiles.openfreemap.org/styles/liberty): a URL that differs by even the
 * sprite's `@2x` suffix is downloaded twice instead of once. The three glyph
 * ranges are the ones a Vietnam viewport actually uses — 0-255 and 256-511 for
 * Latin, 7680-7935 for the Vietnamese diacritics in Latin Extended Additional.
 *
 * `priority:"low"` is load-bearing, not a nicety. A phone on slow 4G is
 * bandwidth-bound, not latency-bound: warming these at normal priority made
 * them race the map bundle for the same pipe, pushing the 267 KB chunk from
 * 3.2s to 5.2s and leaving the total unchanged. At low priority the bundle
 * keeps the fast lane and these fill the leftovers, so both land sooner than
 * either did when they were serial.
 *
 * This is a Fragment on purpose: /map lives inside a `flex-1 min-h-0` scroll
 * frame, and a wrapper <div> here would break that chain and make the page
 * unscrollable.
 */
const WARM_TILE_ASSETS = `(function(){try{
var b="https://tiles.openfreemap.org";
var x=(window.devicePixelRatio||1)>1?"@2x":"";
var u=[b+"/styles/liberty",b+"/planet",b+"/sprites/ofm_f384/ofm"+x+".json",b+"/sprites/ofm_f384/ofm"+x+".png"];
var f=["Regular","Italic"],r=["0-255","256-511","7680-7935"],i,j;
for(i=0;i<f.length;i++)for(j=0;j<r.length;j++)u.push(b+"/fonts/Noto%20Sans%20"+f[i]+"/"+r[j]+".pbf");
for(i=0;i<u.length;i++)fetch(u[i],{mode:"cors",priority:"low"}).catch(function(){});
}catch(e){}})();`;

export default function MapLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: WARM_TILE_ASSETS }} />
      {children}
    </>
  );
}
