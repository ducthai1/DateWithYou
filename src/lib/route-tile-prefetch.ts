/**
 * Pull the map tiles for a whole route before the ride needs them.
 *
 * The map only asks for a tile when the camera reaches it, so a rider who
 * loses signal ten minutes in arrives at ground the map has never seen and
 * gets a blank canvas with a blue line on it. The tile server publishes at
 * zoom 14 at most (the tilejson says so); every closer view is that same tile
 * drawn larger. So the tiles along the line at zoom 14, plus zoom 12 for the
 * overview, are the complete set a ride can ever ask for — and for a city ride
 * that is a few dozen small files, fetched once while the connection is good.
 *
 * The service worker keeps whatever comes through here in its tile cache, the
 * same place the map's own requests land, so the map finds them without
 * knowing this happened. Without the worker (a dev build, a private window)
 * this only warms the HTTP cache, which is still better than nothing.
 */
const HOST = "https://tiles.openfreemap.org";
/** 14 is the source's maxzoom; 12 gives the zoomed-out picture of the route. */
const ZOOMS = [12, 14] as const;
const DETAIL_ZOOM = 14;
/** ~60 KB apiece in a city; this cap is roughly 20 MB on the worst route. */
const MAX_TILES = 320;
const CONCURRENCY = 6;

type TileKey = { z: number; x: number; y: number };

const fetched = new Set<string>();
let templatePromise: Promise<string | null> | null = null;

/** The versioned tile URL pattern, read from the live tilejson — never guessed. */
async function tileTemplate(): Promise<string | null> {
  templatePromise ??= fetch(`${HOST}/planet`, { mode: "cors" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { tiles?: string[] } | null) => j?.tiles?.[0] ?? null)
    .catch(() => null);
  const t = await templatePromise;
  if (!t) templatePromise = null; // let the next call try again
  return t;
}

function toTile(lng: number, lat: number, z: number): TileKey {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latR = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
  return { z, x: ((x % n) + n) % n, y: Math.min(n - 1, Math.max(0, y)) };
}

/**
 * Every tile the line passes through, in riding order, most-needed first:
 * the overview, then the tiles under the line, then their neighbours at the
 * detail zoom so a turn just past a tile edge still has ground under it.
 */
export function routeTileKeys(coords: Array<[number, number]>): TileKey[] {
  const onLine: string[] = [];
  const ring: string[] = [];
  const seen = new Set<string>();
  const add = (list: string[], t: TileKey) => {
    const k = `${t.z}/${t.x}/${t.y}`;
    if (seen.has(k)) return;
    seen.add(k);
    list.push(k);
  };
  for (const z of ZOOMS) {
    let prev: TileKey | null = null;
    for (const [lng, lat] of coords) {
      const t = toTile(lng, lat, z);
      // Two consecutive points can skip a tile on a long straight; fill the gap.
      if (prev) {
        const steps = Math.max(Math.abs(t.x - prev.x), Math.abs(t.y - prev.y));
        for (let i = 1; i < steps; i++) {
          add(onLine, {
            z,
            x: Math.round(prev.x + ((t.x - prev.x) * i) / steps),
            y: Math.round(prev.y + ((t.y - prev.y) * i) / steps),
          });
        }
      }
      add(onLine, t);
      prev = t;
    }
  }
  const n = 2 ** DETAIL_ZOOM;
  for (const k of [...onLine]) {
    const [z, x, y] = k.split("/").map(Number);
    if (z !== DETAIL_ZOOM) continue;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= n) continue;
        add(ring, { z, x: (((x + dx) % n) + n) % n, y: ny });
      }
  }
  return [...onLine, ...ring].map((k) => {
    const [z, x, y] = k.split("/").map(Number);
    return { z, x, y };
  });
}

export type PrefetchSummary = { requested: number; dropped: number; failed: number };

/**
 * Best effort, never throws. Skipped on a metered or 2G connection, where a
 * few megabytes for ground the rider may never look at is the wrong trade.
 */
export async function prefetchRouteTiles(coords: Array<[number, number]>): Promise<PrefetchSummary> {
  const none = { requested: 0, dropped: 0, failed: 0 };
  if (typeof window === "undefined" || coords.length < 2) return none;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (conn?.saveData) return none;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return none;

  const template = await tileTemplate();
  if (!template) return none;

  const keys = routeTileKeys(coords);
  const kept = keys.slice(0, MAX_TILES);
  const urls = kept
    .map((t) => template.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y)))
    .filter((u) => !fetched.has(u));

  // Bounded: a long day of rides must not grow this without limit.
  if (fetched.size > 4000) fetched.clear();

  let failed = 0;
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        const r = await fetch(u, { mode: "cors" });
        if (r.ok) fetched.add(u);
        else failed++;
      } catch {
        // Offline already, or blocked — the next route change tries again.
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { requested: urls.length, dropped: keys.length - kept.length, failed };
}
