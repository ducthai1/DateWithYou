/*
 * Map asset cache.
 *
 * Deliberately narrow. It answers exactly two things: requests to the tile
 * server, and our own /_next/static/ files. Nothing else — no HTML, no RSC
 * payload, no tRPC, no uploads — so a deploy can never be shadowed by a stale
 * cached shell and there is no update-loop failure mode to reason about.
 * /_next/static/ is safe to keep forever because Next content-hashes those
 * filenames and serves them `immutable`: a new build cannot reuse a URL, it can
 * only mint new ones. The old entries are then dead weight, which is what the
 * size cap is for.
 *
 * Why it exists: measured on a throttled phone profile, /map takes ~6.4s to
 * paint with an empty cache and ~1.6s with a warm one. The HTTP cache already
 * gives that speed-up, but mobile browsers evict it aggressively — hardest in
 * an installed PWA, which is exactly how this app is used — so the second and
 * hundredth visit kept paying the cold price. The Cache API is not evicted the
 * same way, so the warm path becomes the normal path.
 *
 * Caching the app's own chunks is not an afterthought, it is the main event.
 * Serving every tile-server byte from disk while the chunks still came off the
 * network left the map at 6.9s — unchanged. The map screen waits on a 267 KB
 * maplibre chunk and its neighbours, and until those are local nothing else
 * moves the number.
 *
 * The URLs are safe to keep indefinitely because the tile server versions them
 * by path (/planet/20260823_080002_pt/...) and serves them `public, max-age`
 * up to ten years. Style and tilejson are the two that do change in place, so
 * those revalidate in the background instead.
 */
const HOST = "https://tiles.openfreemap.org";
const STATIC = "ofm-static-v1"; // fonts, sprites — never change under a fixed URL
const TILES = "ofm-tiles-v1"; // versioned tile pyramid
const LIVE = "ofm-live-v1"; // style + tilejson, refreshed in the background
const APP = "app-static-v1"; // content-hashed /_next/static/ chunks and fonts
const TILE_LIMIT = 400; // ~25 MB of vector tiles; plenty for the areas one couple browses
const APP_LIMIT = 250; // a few builds' worth of chunks before the oldest are dropped

self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const keep = new Set([STATIC, TILES, LIVE, APP]);
      for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  ),
);

/** Oldest-first trim; Cache API returns keys in insertion order. */
async function trim(cache, limit) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName, limit) {
  let cache = null;
  try {
    cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    if (hit) return hit;
  } catch (err) {
    // No cache available at all — fall through to the network.
    console.warn("sw: cache unavailable", err);
    return fetch(request);
  }
  const res = await fetch(request);
  // Only 200s are worth keeping. An opaque response would poison the cache with
  // something we can never read the status of, so those are passed through.
  //
  // Storing is wrapped because storing is the optional half of this. A quota
  // error, a private window, or a browser with site data disabled would
  // otherwise reject the whole fetch event and the request would fail — a cache
  // that cannot save must still let the page load.
  if (res.ok && res.type !== "opaque") {
    try {
      await cache.put(request, res.clone());
      if (limit) await trim(cache, limit);
    } catch (err) {
      console.warn("sw: could not cache", request.url, err);
    }
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(LIVE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    // Hashed build output only. Everything else on this origin must stay live.
    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(cacheFirst(request, APP, APP_LIMIT));
    }
    return;
  }

  if (!request.url.startsWith(HOST)) return;
  const path = url.pathname;

  if (path.startsWith("/fonts/") || path.startsWith("/sprites/")) {
    event.respondWith(cacheFirst(request, STATIC));
  } else if (path.startsWith("/natural_earth/") || /^\/planet\/[^/]+\//.test(path)) {
    event.respondWith(cacheFirst(request, TILES, TILE_LIMIT));
  } else if (path.startsWith("/styles/") || path === "/planet") {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/* ── Notifications ────────────────────────────────────────────────────────
 * The only way this app reaches a phone that is locked, in another app, or has
 * the browser closed. Also the only way to make an iPhone buzz at all: WebKit
 * ships no Vibration API, but a notification is delivered by iOS itself and so
 * uses the person's own ringer and haptic settings.
 *
 * On iOS this works only for a web app added to the Home Screen — Safari grants
 * push to installed apps, not to tabs.
 */

self.addEventListener("push", (event) => {
  // A push with no readable body still deserves to arrive: showing a generic
  // notification beats swallowing it, and a push event that shows nothing at
  // all can cost the origin its permission on some browsers.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Vivu No Plan";
  const body = data.body || "Bạn có thông báo mới.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      /*
       * The badge is the small status-bar icon, and Android throws away its
       * colours: it keeps only the alpha channel and paints that in the system
       * tint. icon-192.png has no alpha at all — every pixel opaque — so the
       * mask was a filled square and the phone drew a blank white block.
       *
       * badge-96.png is the brand's V knocked out of a rounded tile, on
       * transparency — a shape, which is the only thing that survives being
       * reduced to a mask. iOS ignores badge entirely and uses the app icon,
       * so this costs nothing there.
       */
      badge: "/badge-96.png",
      // `tag` collapses a repeat instead of stacking; renotify makes the phone
      // buzz again for the replacement rather than updating it silently.
      tag: data.tag || "vivu",
      renotify: true,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse a window that is already open — opening a second copy of the app
      // loses whatever the person had on screen, and on iOS the new one starts
      // from a cold boot.
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
