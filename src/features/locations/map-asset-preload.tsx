import { MAP_TILE_HOST } from "@/lib/map-tile-assets";

/**
 * Break the head off MapLibre's start-up chain — and only the head.
 *
 * The map's start-up is serial, because each step only knows what to ask for
 * once the one before it has landed. Measured on a production build over
 * localhost with an empty cache, so this is the chain itself and not the
 * network:
 *
 *   app JS chunks   99 →  477ms
 *   style JSON     514 →  617ms   ← only starts once maplibre is parsed
 *   tilejson       648 → 1125ms   ← only starts once the style is read
 *   sprite         649 → 1206ms
 *   glyphs (×6)   1576 → 1981ms   ← only start once a label needs them
 *   first idle frame     2844ms
 *
 * The style and the tilejson are 6 KB and 2 KB, at fixed URLs, and everything
 * else in that list waits behind them. Asking for those two in the route's
 * head removes two round trips from the front of the chain for the price of
 * 8 KB.
 *
 * ── Why the other seven assets are NOT here ────────────────────────────────
 *
 * They were, in the first version — all nine, as static preloads. On localhost
 * that drew the map at 2027ms instead of 2844ms. On a throttled 1.5 Mbps
 * profile it drew at 8187ms instead of 6281ms: the sprite and the six glyph
 * files are 405 KB, and on a link that was already full they pushed the app's
 * own chunks from ~1.4s out to 6.0s — and until that JavaScript exists, no
 * downloaded asset can be used by anything. Marking them
 * `fetchpriority="low"` did not help (8134ms); "low" still shares the pipe.
 *
 * That is the same trap WarmMapAssets documents from the other side: asking
 * for the very bytes the visible map is queueing for, on a link that has none
 * to spare, once turned a 3.4s map into a 26.4s one. 8 KB cannot do that;
 * 405 KB measurably can. The heavy assets stay where MapLibre asks for them
 * itself, at the priority it chooses, and WarmMapAssets still fetches them
 * ahead of time from every OTHER page — which is where there is bandwidth to
 * spare and nothing waiting on it.
 */
export function MapAssetPreload() {
  return (
    <>
      {/* A handshake, not bytes: DNS, TCP and TLS to a third-party host is its
          own round trip, and every request below is behind it. */}
      <link rel="preconnect" href={MAP_TILE_HOST} crossOrigin="anonymous" />
      {/*
       * `as="fetch"` because MapLibre reads both of these through fetch, and
       * `crossOrigin` to match its anonymous request mode — a mismatch on
       * either would leave the preload unused and download the file twice.
       */}
      <link
        rel="preload"
        as="fetch"
        href={`${MAP_TILE_HOST}/styles/liberty`}
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        as="fetch"
        href={`${MAP_TILE_HOST}/planet`}
        crossOrigin="anonymous"
      />
    </>
  );
}
