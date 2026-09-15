import { LocationModel } from "@/server/db/models/location";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { connectToDatabase } from "@/server/db/connect";

/**
 * Clearing out places the day planner saved that nobody ever wanted.
 *
 * Confirming a plan can save a place Google found. Most of those become part
 * of a couple's map; some are a one-off nobody thinks about again, and left
 * alone they accumulate until the list screen is mostly strangers.
 *
 * Three things protect a row from this sweep, and each is a different kind of
 * "we meant it":
 *
 *   - somebody pressed **Giữ lại** (`source` is no longer "suggested")
 *   - somebody **went there** (`status: "visited"`) — a stronger keep than
 *     any button
 *   - it is a stop on a **confirmed plan**, because deleting it would leave a
 *     plan item pointing at nothing, on a real day in their calendar
 *
 * Runs from the daily cron that already exists rather than one of its own:
 * the schedule is the same, and a second cron entry costs a slot on the plan
 * this app is deployed on.
 */

/** How long an ignored suggestion is kept before it is swept. */
export const SUGGESTION_TTL_DAYS = 60;

export async function sweepStaleSuggestions(now = Date.now()): Promise<number> {
  await connectToDatabase();
  const cutoff = new Date(now - SUGGESTION_TTL_DAYS * 86_400_000);

  const stale = await LocationModel.find({
    source: "suggested",
    status: { $ne: "visited" },
    createdAt: { $lt: cutoff },
  })
    .select("_id")
    .lean<Array<{ _id: unknown }>>();
  if (!stale.length) return 0;

  const ids = stale.map((d) => String(d._id));
  // Anything on a plan stays, whatever its age.
  const planned = await PlanItemModel.find({ locationId: { $in: ids } })
    .select("locationId")
    .lean<Array<{ locationId?: string }>>();
  const keep = new Set(planned.map((p) => p.locationId));
  const doomed = ids.filter((id) => !keep.has(id));
  if (!doomed.length) return 0;

  const res = await LocationModel.deleteMany({ _id: { $in: doomed }, source: "suggested" });
  return res.deletedCount ?? 0;
}
