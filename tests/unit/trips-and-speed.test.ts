import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { splitTrips, type TrackSample } from "@/lib/trip-split";
import {
  ALL_HOURS,
  cellOf,
  hourBucket,
  learnedRouteSeconds,
  tallyKey,
  tallyTrip,
  type CellTally,
} from "@/lib/speed-profile";

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 29, 9, 0); // 16:00 in Vietnam, a Thursday

/** Standing at one spot, a fix every 25 s. */
function stay(lat: number, lng: number, from: number, minutes: number): TrackSample[] {
  return Array.from({ length: Math.floor((minutes * 60) / 25) + 1 }, (_, i) => ({ at: from + i * 25_000, lat, lng }));
}
/** Riding north in a straight line at `kmh`, a fix every 25 s. */
function ride(lat: number, lng: number, from: number, minutes: number, kmh: number): TrackSample[] {
  const perFix = (kmh / 3.6) * 25 / 111_000;
  return Array.from({ length: Math.floor((minutes * 60) / 25) }, (_, i) => ({ at: from + (i + 1) * 25_000, lat: lat + (i + 1) * perFix, lng }));
}

describe("tách chuyến từ điểm định vị", () => {
  const home = stay(10.8, 106.7, T0, 20);
  const leave = home[home.length - 1].at;
  const go = ride(10.8, 106.7, leave, 15, 24); // 6 km
  const end = go[go.length - 1];
  const cafe = stay(end.lat, end.lng, end.at + 25_000, 30);

  test("nhà → quán → ngồi quán: một chuyến, từ lúc rời nhà tới lúc tới quán", () => {
    const now = cafe[cafe.length - 1].at + MIN;
    const { trips, settledUntil } = splitTrips([...home, ...go, ...cafe], now);
    assert.equal(trips.length, 1);
    const t = trips[0];
    assert.equal(t.startedAt, leave);
    // The bike stopped on its last moving fix, which is where the café stop begins.
    assert.equal(t.endedAt, end.at);
    assert.ok(Math.abs(t.distanceM - 6000) < 300, `quãng ${t.distanceM}`);
    // Next pass starts at the café stop, so the ride home departs from it.
    assert.equal(settledUntil, end.at);
  });

  test("mới tới quán được 3 phút thì chuyến chưa xong", () => {
    const early = cafe.slice(0, 8);
    const now = early[early.length - 1].at + 10_000;
    const { trips, settledUntil } = splitTrips([...home, ...go, ...early], now);
    assert.equal(trips.length, 0);
    assert.equal(settledUntil, leave);
  });

  test("dừng đèn đỏ 2 phút không cắt đôi chuyến", () => {
    const a = ride(10.8, 106.7, leave, 8, 24);
    const p = a[a.length - 1];
    const light = stay(p.lat, p.lng, p.at + 25_000, 2);
    const b = ride(p.lat, p.lng, light[light.length - 1].at, 8, 24);
    const q = b[b.length - 1];
    const there = stay(q.lat, q.lng, q.at + 25_000, 20);
    const { trips } = splitTrips([...home, ...a, ...light, ...b, ...there], there[there.length - 1].at);
    assert.equal(trips.length, 1);
  });

  test("đi bộ ra bãi xe 300 m không phải chuyến", () => {
    const walk = ride(10.8, 106.7, leave, 3, 6);
    const p = walk[walk.length - 1];
    const there = stay(p.lat, p.lng, p.at + 25_000, 20);
    assert.equal(splitTrips([...home, ...walk, ...there], there[there.length - 1].at).trips.length, 0);
  });

  test("máy im hơn 10 phút giữa đường: chuyến kết thúc ở điểm cuối trước khi im", () => {
    const now = go[go.length - 1].at + 30 * MIN;
    const { trips, settledUntil } = splitTrips([...home, ...go], now);
    assert.equal(trips.length, 1);
    assert.equal(trips[0].endedAt, go[go.length - 1].at);
    assert.equal(settledUntil, go[go.length - 1].at + 1);
  });
});

describe("học tốc độ của hai người", () => {
  test("giờ theo Việt Nam, tách ngày thường với cuối tuần", () => {
    assert.equal(hourBucket(Date.UTC(2026, 9, 29, 10, 30)), "wd17");
    assert.equal(hourBucket(Date.UTC(2026, 9, 31, 10, 30)), "we17");
    // 23:30 UTC Friday is 06:30 Saturday in Vietnam.
    assert.equal(hourBucket(Date.UTC(2026, 9, 30, 23, 30)), "we6");
  });

  test("cộng mét và giây theo ô, bỏ khúc mất sóng và cú nhảy GPS", () => {
    const pts: TrackSample[] = [
      { at: T0, lat: 10.8, lng: 106.7 },
      { at: T0 + 25_000, lat: 10.8 + 100 / 111_000, lng: 106.7 },
      // 5 minutes of silence
      { at: T0 + 325_000, lat: 10.8 + 200 / 111_000, lng: 106.7 },
      // 2 km in 25 s
      { at: T0 + 350_000, lat: 10.8 + 2200 / 111_000, lng: 106.7 },
    ];
    const t = tallyTrip(pts);
    const all = [...t].filter(([k]) => k.endsWith(`|${ALL_HOURS}`)).map(([, v]) => v);
    assert.equal(all.length, 1);
    assert.ok(Math.abs(all[0].m - 100) < 2);
    assert.equal(all[0].s, 25);
  });

  test("chưa có dữ liệu thì giữ nguyên số của bản đồ", () => {
    const coords: Array<[number, number]> = [[106.7, 10.8], [106.7, 10.81]];
    assert.deepEqual(learnedRouteSeconds(coords, 120, new Map(), "wd17"), { seconds: 120, learnedShare: 0 });
  });

  test("ô đi nhiều lần lúc 17 giờ thì gần như theo nhịp thật, ô khác vẫn theo bản đồ", () => {
    // Two ~1.33 km segments, three squares each; the map says 3 minutes for all of it.
    const coords: Array<[number, number]> = [[106.7, 10.8], [106.7, 10.812], [106.7, 10.824]];
    const profile = new Map<string, CellTally>();
    // They crawl through 10.800–10.812 at 17:00: 2 m/s, twenty km of history.
    for (const cell of [cellOf(10.801, 106.7), cellOf(10.805, 106.7), cellOf(10.809, 106.7)]) {
      profile.set(tallyKey(cell, "wd17"), { m: 20_000, s: 10_000 });
    }
    const r = learnedRouteSeconds(coords, 180, profile, "wd17");
    assert.ok(r.learnedShare > 0.4 && r.learnedShare < 0.55, `share ${r.learnedShare}`);
    // ~95% trust: 1334 m at ~0.48 s/m ≈ 639 s, plus the other half at the map's 90 s.
    assert.ok(Math.abs(r.seconds - 729) < 25, `seconds ${r.seconds}`);
    // At 03:00 that hour has no history, and the squares have none at any hour.
    assert.equal(learnedRouteSeconds(coords, 180, profile, "wd3").seconds, 180);
  });

  test("một lần đi lẻ (hôm mưa) chỉ kéo ước tính đi một ít; nhịp vô lý bị kẹp", () => {
    const coords: Array<[number, number]> = [[106.7, 10.8], [106.7, 10.81]];
    const thin = new Map<string, CellTally>();
    for (const cell of [cellOf(10.801, 106.7), cellOf(10.805, 106.7), cellOf(10.809, 106.7)]) {
      thin.set(tallyKey(cell, "wd17"), { m: 100, s: 900 });
    }
    const once = learnedRouteSeconds(coords, 120, thin, "wd17").seconds;
    assert.ok(once > 120 && once < 200, `one wet ride moved it to ${once}`);
    // 10 s per metre would be 0.36 km/h; clamped to 5.4 km/h, at near-full trust.
    const crawl = new Map<string, CellTally>();
    for (const cell of [cellOf(10.801, 106.7), cellOf(10.805, 106.7), cellOf(10.809, 106.7)]) {
      crawl.set(tallyKey(cell, ALL_HOURS), { m: 100_000, s: 1_000_000 });
    }
    const r = learnedRouteSeconds(coords, 120, crawl, "wd17");
    assert.ok(Math.abs(r.seconds - 1112 / 1.5) < 15, `seconds ${r.seconds}`);
  });
});
