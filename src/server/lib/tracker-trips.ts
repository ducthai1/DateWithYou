import { TrackerLinkModel } from "@/server/db/models/tracker-link";
import { TrackPointModel } from "@/server/db/models/track-point";
import { RideModel } from "@/server/db/models/ride";
import { LocationModel } from "@/server/db/models/location";
import { SpeedCellModel } from "@/server/db/models/speed-cell";
import { calculateDistance } from "@/lib/maps";
import { splitTrips, type SplitTrip } from "@/lib/trip-split";
import { tallyTrip } from "@/lib/speed-profile";
import { vnClock } from "@/server/lib/partner-alerts";
import type { TrackerFix } from "@/lib/owntracks";

/**
 * The tracker's fixes, kept, and turned into rides and pace once a trip ends.
 * The cutting rules are in src/lib/trip-split.ts, the pace in src/lib/speed-profile.ts.
 */

type TripLink = {
  _id: unknown;
  spaceId: string;
  userId: string;
  home?: { lat: number; lng: number } | null;
  tripCursorAt?: Date | null;
};

/** Looking for finished trips on every 25 s fix would re-read the same points each time. */
export const TRIPS_CHECK_EVERY_MS = 2 * 60_000;
/** A trip ending this close to a saved place is a trip to that place. */
const PLACE_M = 150;
const MAX_RIDE_POINTS = 2000;

export async function recordTrackPoint(link: TripLink, fix: TrackerFix) {
  try {
    await TrackPointModel.create({
      spaceId: link.spaceId,
      userId: link.userId,
      at: new Date(fix.at),
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy,
    });
  } catch (err) {
    // The same fix again, re-sent after a reply that never reached the phone.
    if ((err as { code?: number }).code !== 11000) throw err;
  }
}

function evenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)]);
}

async function destinationOf(link: TripLink, trip: SplitTrip) {
  const end = trip.points[trip.points.length - 1];
  const places = await LocationModel.find({ spaceId: link.spaceId, "geo.lat": { $ne: null } })
    .select("name geo")
    .lean<Array<{ _id: unknown; name: string; geo: { lat: number; lng: number } }>>();
  let best: { id: string; name: string; d: number } | null = null;
  for (const p of places) {
    const d = calculateDistance(p.geo, end);
    if (d <= PLACE_M && (!best || d < best.d)) best = { id: String(p._id), name: p.name, d };
  }
  if (best) return { destinationName: best.name, destinationLocationId: best.id };
  if (link.home && calculateDistance(link.home, end) <= PLACE_M) return { destinationName: "Nhà" };
  return { destinationName: `Chuyến lúc ${vnClock(trip.startedAt)}` };
}

async function saveTrip(link: TripLink, trip: SplitTrip) {
  const startedAt = new Date(trip.startedAt);
  const endedAt = new Date(trip.endedAt);

  // Their pace counts even when the ride itself is already on record.
  const tally = tallyTrip(trip.points);
  if (tally.size) {
    await SpeedCellModel.bulkWrite(
      [...tally].map(([key, t]) => {
        const [cell, bucket] = key.split("|");
        return {
          updateOne: {
            filter: { spaceId: link.spaceId, cell, bucket },
            update: { $inc: { m: t.m, s: t.s } },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  /*
   * Navigating in the app records its own ride when it ends; the tracker was
   * running alongside and saw the same trip. One ride, not two.
   */
  const already = await RideModel.exists({
    spaceId: link.spaceId,
    userId: link.userId,
    startedAt: { $lt: endedAt },
    endedAt: { $gt: startedAt },
  });
  if (already) return false;

  const pts = evenly(trip.points, MAX_RIDE_POINTS);
  await RideModel.create({
    spaceId: link.spaceId,
    userId: link.userId,
    ...(await destinationOf(link, trip)),
    startedAt,
    endedAt,
    distanceMeters: Math.round(trip.distanceM),
    durationSeconds: Math.round((trip.endedAt - trip.startedAt) / 1000),
    path: pts.map((p) => [p.lng, p.lat]),
    pathAt: pts.map((p) => p.at),
    source: "tracker",
  });
  return true;
}

/**
 * Turn the trips that have ended since the last pass into rides.
 *
 * Claimed atomically on `tripsCheckedAt` so two requests arriving together —
 * a fix and someone opening the ride list — cannot both save the same trip.
 * `everyMs` is how recent a previous pass may be before this one is skipped.
 */
export async function closeTrips(linkId: unknown, now: number, everyMs = TRIPS_CHECK_EVERY_MS): Promise<number> {
  const link = await TrackerLinkModel.findOneAndUpdate(
    { _id: linkId, $or: [{ tripsCheckedAt: null }, { tripsCheckedAt: { $lt: new Date(now - everyMs) } }] },
    { $set: { tripsCheckedAt: new Date(now) } },
    { new: true },
  ).lean<TripLink>();
  if (!link) return 0;

  const rows = await TrackPointModel.find({
    spaceId: link.spaceId,
    userId: link.userId,
    ...(link.tripCursorAt ? { at: { $gte: link.tripCursorAt } } : {}),
  })
    .sort({ at: 1 })
    .limit(20_000)
    .select("at lat lng")
    .lean<Array<{ at: Date; lat: number; lng: number }>>();
  const { trips, settledUntil } = splitTrips(
    rows.map((r) => ({ at: new Date(r.at).getTime(), lat: r.lat, lng: r.lng })),
    now,
  );

  let saved = 0;
  for (const trip of trips) if (await saveTrip(link, trip)) saved++;
  if (settledUntil !== null) {
    await TrackerLinkModel.updateOne({ _id: link._id }, { $set: { tripCursorAt: new Date(settledUntil) } });
  }
  return saved;
}

const closing = new Map<string, Promise<void>>();

/**
 * Every tracker in a space — for the ride screen, so a trip shows up without
 * waiting for the next fix.
 *
 * The list and the totals above it arrive in one batch and both call this;
 * the second waits on the first's pass instead of finding the claim taken and
 * counting before the new ride exists ("0 chuyến" over a list of one).
 */
export function closeSpaceTrips(spaceId: string, now: number): Promise<void> {
  const running = closing.get(spaceId);
  if (running) return running;
  const pass = (async () => {
    const links = await TrackerLinkModel.find({ spaceId }).select("_id").lean<Array<{ _id: unknown }>>();
    await Promise.all(links.map((l) => closeTrips(l._id, now, 5_000)));
  })().finally(() => closing.delete(spaceId));
  closing.set(spaceId, pass);
  return pass;
}
