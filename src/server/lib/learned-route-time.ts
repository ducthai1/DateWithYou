import { SpeedCellModel } from "@/server/db/models/speed-cell";
import {
  ALL_HOURS,
  cellsAlong,
  hourBucket,
  learnedRouteSeconds,
  tallyKey,
  type CellTally,
} from "@/lib/speed-profile";

/**
 * Route times corrected by this couple's own riding (src/lib/speed-profile.ts).
 * Returns a timer that leaves every number exactly as the provider gave it
 * when there is no history for the squares the route crosses.
 */
export async function routeTimer(spaceId: string, lines: Array<Array<[number, number]>>, at = Date.now()) {
  const bucket = hourBucket(at);
  const cells = [...new Set(lines.flatMap((c) => cellsAlong(c)))];
  let profile = new Map<string, CellTally>();
  if (cells.length) {
    try {
      const rows = await SpeedCellModel.find({ spaceId, cell: { $in: cells }, bucket: { $in: [bucket, ALL_HOURS] } })
        .select("cell bucket m s")
        .lean<Array<{ cell: string; bucket: string; m: number; s: number }>>();
      profile = new Map(rows.map((r) => [tallyKey(r.cell, r.bucket), { m: r.m, s: r.s }]));
    } catch (err) {
      // A route with the provider's time beats no route.
      console.error("routeTimer: speed history unavailable", err);
    }
  }
  return (coords: Array<[number, number]>, providerSeconds: number) =>
    profile.size ? learnedRouteSeconds(coords, providerSeconds, profile, bucket) : { seconds: providerSeconds, learnedShare: 0 };
}
