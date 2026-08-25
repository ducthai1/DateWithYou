import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { MemoryModel } from "@/server/db/models/memory";
import { LocationModel } from "@/server/db/models/location";
import { MediaItemModel } from "@/server/db/models/media-item";
import { TripModel } from "@/server/db/models/trip";
import { TimeCapsuleModel } from "@/server/db/models/time-capsule";
import { SAIGON_OFFSET_MIN, dateKeyFromDate } from "@/lib/date-keys";

/* Everything here is deliberately a *shared* number for the space. There is no
 * per-member breakdown and no streak: the point is reminiscence ("tụi mình đã
 * lưu 128 kỷ niệm"), not a scoreboard between two people. Adding a per-partner
 * split later would turn every one of these counters into a comparison. */

/** Saigon wall-clock offset in the "+07:00" form $dateToString expects. */
const SAIGON_TZ = `+${String(Math.floor(SAIGON_OFFSET_MIN / 60)).padStart(2, "0")}:${String(
  SAIGON_OFFSET_MIN % 60,
).padStart(2, "0")}`;

type Counted = { count: number }[];

/** Whole days between two `YYYY-MM-DD` Saigon day keys. */
function daysBetweenKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

export const statsRouter = router({
  /**
   * Warm counters for the "Chúng mình" panel — one round of parallel
   * aggregations, all scoped to the caller's space. Every value is shared by
   * the couple; nothing is attributed to (or comparable between) either member.
   */
  overview: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const spaceId = ctx.spaceId;

    const [space, memoryFacet, locationFacet, tripFacet, recipes, capsuleRows] =
      await Promise.all([
        SpaceModel.findById(spaceId)
          .select("anniversaryDate")
          .lean<{ anniversaryDate?: Date | null } | null>(),

        MemoryModel.aggregate<{
          totals: { count: number; photos: number }[];
          byMonth: { _id: string; count: number }[];
        }>([
          { $match: { spaceId } },
          {
            $facet: {
              totals: [
                {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },
                    // $size throws on a missing field, so default it first.
                    photos: { $sum: { $size: { $ifNull: ["$photos", []] } } },
                  },
                },
              ],
              byMonth: [
                {
                  $group: {
                    _id: {
                      $dateToString: {
                        format: "%Y-%m",
                        date: "$date",
                        timezone: SAIGON_TZ,
                      },
                    },
                    count: { $sum: 1 },
                  },
                },
                // Ties resolve to the most recent month — the warmer read.
                { $sort: { count: -1, _id: -1 } },
                { $limit: 1 },
              ],
            },
          },
        ]),

        LocationModel.aggregate<{
          pinned: Counted;
          visited: Counted;
          districts: Counted;
        }>([
          { $match: { spaceId } },
          {
            $facet: {
              pinned: [{ $count: "count" }],
              visited: [{ $match: { status: "visited" } }, { $count: "count" }],
              districts: [
                { $match: { status: "visited", district: { $nin: [null, ""] } } },
                { $group: { _id: "$district" } },
                { $count: "count" },
              ],
            },
          },
        ]),

        TripModel.aggregate<{ total: Counted; completed: Counted }>([
          { $match: { spaceId } },
          {
            $facet: {
              total: [{ $count: "count" }],
              completed: [{ $match: { status: "completed" } }, { $count: "count" }],
            },
          },
        ]),

        MediaItemModel.countDocuments({ spaceId, kind: "recipe" }),

        TimeCapsuleModel.aggregate<{ _id: boolean | null; count: number }>([
          { $match: { spaceId } },
          { $group: { _id: "$isOpened", count: { $sum: 1 } } },
        ]),
      ]);

    const memoryTotals = memoryFacet[0]?.totals[0];
    const busiest = memoryFacet[0]?.byMonth[0];
    const loc = locationFacet[0];
    const trip = tripFacet[0];

    const capsulesOpened = capsuleRows
      .filter((r) => r._id === true)
      .reduce((sum, r) => sum + r.count, 0);
    const capsulesSealed = capsuleRows
      .filter((r) => r._id !== true)
      .reduce((sum, r) => sum + r.count, 0);

    const anniversaryDate = space?.anniversaryDate ?? null;
    // Counted in Saigon calendar days so the number never flips a day early or
    // late just because the server clock runs in UTC. Future anniversaries
    // (a date typed by mistake) clamp to null rather than showing a negative.
    const daysTogether = anniversaryDate
      ? Math.max(
          0,
          daysBetweenKeys(dateKeyFromDate(anniversaryDate), dateKeyFromDate(new Date())),
        )
      : null;

    return {
      memories: memoryTotals?.count ?? 0,
      photos: memoryTotals?.photos ?? 0,
      placesPinned: loc?.pinned[0]?.count ?? 0,
      placesVisited: loc?.visited[0]?.count ?? 0,
      districtsCovered: loc?.districts[0]?.count ?? 0,
      trips: trip?.total[0]?.count ?? 0,
      tripsCompleted: trip?.completed[0]?.count ?? 0,
      recipes,
      capsulesSealed,
      capsulesOpened,
      anniversaryDate,
      daysTogether,
      busiestMonth: busiest ? { key: busiest._id, count: busiest.count } : null,
    };
  }),
});
