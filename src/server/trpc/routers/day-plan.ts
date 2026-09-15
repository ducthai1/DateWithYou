import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { LocationModel } from "@/server/db/models/location";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { TripModel } from "@/server/db/models/trip";
import { bucketForTime } from "@/lib/plan-meta";
import { planDay, reasonFor, SLOT_KINDS, type Candidate, type SlotKind } from "@/lib/day-planner";
import { BUDGET_KEYS, costBandFor } from "@/lib/day-planner-taxonomy";
import { searchPlacesNearby } from "@/server/lib/search-places-nearby";

/**
 * "Hôm nay đi đâu?" — two procedures, and a hard line between them.
 *
 * `generate` is a rehearsal. It reads, it thinks, and it writes nothing: a
 * person can press it ten times, dislike all ten answers and close the tab,
 * and the space is exactly as they left it. `confirm` is the moment of
 * consent, and the only moment anything is written.
 *
 * That line is not a nicety. The alternative — saving suggestions as they are
 * generated — fills somebody's map with places they never chose, and there is
 * no good way to explain that afterwards.
 */

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const geoInput = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const kindEnum = z.enum(SLOT_KINDS as unknown as [SlotKind, ...SlotKind[]]);

/** How far back a visit still counts against a place being offered again. */
const RECENCY_WINDOW_DAYS = 30;

const dayMs = 86_400_000;
const epochOf = (key: string) => Date.parse(`${key}T00:00:00Z`);
const keyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** What to ask Google for, in the words a person would use. */
const QUERY_FOR: Record<SlotKind, string> = {
  meal: "quán ăn ngon",
  cafe: "quán cà phê",
  drink: "quán bar quán nhậu",
  stroll: "công viên chỗ đi dạo",
  entertain: "chỗ vui chơi giải trí",
};

/** A suggestion, as it travels to the client and back. Never in the database. */
const suggestionInput = z.object({
  externalId: z.string().min(1).max(256),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(60),
  district: z.string().trim().min(1).max(80),
  geo: geoInput,
  address: z.string().trim().max(300).nullish(),
  rating: z.number().min(0).max(5).nullish(),
  priceLevel: z.number().int().min(0).max(4).nullish(),
  openTime: timeStr.nullish(),
  closeTime: timeStr.nullish(),
});
type Suggestion = z.infer<typeof suggestionInput>;

/** The id a temporary suggestion carries inside a draft. */
const tempId = (externalId: string) => `ext:${externalId}`;

/**
 * When each place was last visited, from the couple's own record.
 *
 * Two sources, because they mean the same thing and are written by different
 * screens: a plan item pinned to a place on a past day, and the `visitedAt`
 * stamp the list sets when somebody ticks a place off. The newest of the two
 * wins. This is the loop that stops the generator repeating itself — without
 * it the same top-rated places come back every time, and by the third use the
 * feature is boring.
 */
async function lastVisits(spaceId: string, on: string): Promise<Map<string, number>> {
  const from = keyOf(epochOf(on) - RECENCY_WINDOW_DAYS * dayMs);
  const out = new Map<string, number>();

  const items = await PlanItemModel.find({
    spaceId,
    date: { $gte: from, $lte: on },
    locationId: { $ne: null },
  })
    .select("locationId date")
    .lean<Array<{ locationId?: string; date: string }>>();
  for (const it of items) {
    if (!it.locationId) continue;
    const at = epochOf(it.date);
    if (!Number.isFinite(at)) continue;
    out.set(it.locationId, Math.max(out.get(it.locationId) ?? 0, at));
  }
  return out;
}

function toCandidate(
  row: {
    _id: unknown; name: string; category: string; district: string;
    geo?: { lat?: number; lng?: number } | null; rating?: number | null;
    priceLevel?: number | null; status?: string; mustTry?: string | null;
    openTime?: string | null; closeTime?: string | null; source?: string;
    visitedAt?: Date | null;
  },
  visits: Map<string, number>,
): Candidate {
  const id = String(row._id);
  const stamped = row.visitedAt ? new Date(row.visitedAt).getTime() : 0;
  const planned = visits.get(id) ?? 0;
  const last = Math.max(stamped, planned);
  return {
    id,
    name: row.name,
    category: row.category,
    district: row.district,
    geo: row.geo?.lat != null && row.geo?.lng != null ? { lat: row.geo.lat, lng: row.geo.lng } : null,
    rating: row.rating ?? null,
    priceLevel: row.priceLevel ?? null,
    status: row.status === "visited" ? "visited" : "want_to_go",
    mustTry: row.mustTry ?? null,
    openTime: row.openTime ?? null,
    closeTime: row.closeTime ?? null,
    source: row.source === "suggested" ? "suggested" : "user",
    lastVisitedAt: last || null,
  };
}

const centroid = (pts: Array<{ lat: number; lng: number }>) =>
  pts.length
    ? {
        lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length,
        lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length,
      }
    : null;

export const dayPlanRouter = router({
  /**
   * Draft an afternoon. Writes nothing to the space.
   *
   * A mutation rather than a query on purpose: it is a button press, not a
   * view, and it must not be re-run by a cache revalidation — the one call it
   * may make to Google is metered.
   */
  generate: protectedProcedure
    .input(
      z.object({
        date: dateKey,
        startAt: timeStr,
        areas: z.array(z.string().trim().min(1)).max(12).default([]),
        kinds: z.array(kindEnum).max(5).default([]),
        budget: z.enum(BUDGET_KEYS).default("tuy-y"),
        origin: geoInput.nullish(),
        vibe: z.string().trim().max(40).nullish(),
        seed: z.string().trim().max(64).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();

      const visits = await lastVisits(ctx.spaceId, input.date);
      const rows = await LocationModel.find({ spaceId: ctx.spaceId })
        .select("name category district geo rating priceLevel status mustTry openTime closeTime source visitedAt")
        .limit(500)
        .lean<Parameters<typeof toCandidate>[0][]>();
      const saved = rows.map((r) => toCandidate(r, visits));

      const req = {
        date: input.date,
        startAt: input.startAt,
        areas: input.areas,
        kinds: input.kinds,
        budget: input.budget,
        origin: input.origin ?? null,
        vibe: input.vibe ?? null,
        seed: input.seed,
        now: epochOf(input.date),
      };

      let draft = planDay(req, saved);
      if (!draft.ok) return draft;

      /*
       * One Google call per press, not one per empty slot.
       *
       * Three empty slots would otherwise spend the whole day's allowance on a
       * single tap. So the first gap gets looked up and the rest stay marked
       * empty — which is also what tells the screen to offer "add a few places
       * you like" instead of pretending.
       *
       * Searching needs somewhere to search FROM. With no position and no
       * saved places there is nothing to centre on, and a blind query is money
       * spent on a guess, so it is skipped.
       */
      const suggestions = new Map<string, Suggestion>();
      const firstGap = draft.stops.find((s) => s.unfilled);
      const near = input.origin ?? centroid(saved.flatMap((c) => (c.geo ? [c.geo] : [])));
      if (firstGap && near) {
        const area = input.areas[0];
        const found = await searchPlacesNearby({
          spaceId: ctx.spaceId,
          query: area
            ? `${QUERY_FOR[firstGap.slot.kind]} ở ${area}`
            : QUERY_FOR[firstGap.slot.kind],
          near,
          weekday: new Date(epochOf(input.date)).getUTCDay(),
          dateKey: input.date,
        });
        const extra: Candidate[] = found.places.map((p) => {
          const s: Suggestion = {
            externalId: p.externalId,
            name: p.name,
            // The slot decides the category: it is what the planner matched on,
            // and Google's own types do not line up with a space's own list.
            category: firstGap.slot.kind === "meal" ? "Ăn tối"
              : firstGap.slot.kind === "cafe" ? "Cà phê"
              : firstGap.slot.kind === "drink" ? "Bar"
              : firstGap.slot.kind === "stroll" ? "Công viên"
              : "Workshop",
            district: area ?? "Chưa rõ khu vực",
            geo: p.geo,
            address: p.address ?? null,
            rating: p.rating ?? null,
            priceLevel: p.priceLevel ?? null,
            openTime: p.openTime,
            closeTime: p.closeTime,
          };
          suggestions.set(tempId(p.externalId), s);
          return {
            id: tempId(p.externalId),
            name: s.name,
            category: s.category,
            district: s.district,
            geo: s.geo,
            rating: s.rating,
            priceLevel: s.priceLevel,
            status: "want_to_go" as const,
            mustTry: null,
            openTime: s.openTime,
            closeTime: s.closeTime,
            source: "suggested" as const,
            lastVisitedAt: null,
          };
        });
        if (extra.length) draft = planDay(req, [...saved, ...extra]) as typeof draft;
      }

      /** One candidate, in the shape the screen shows and sends back. */
      const asOption = (
        c: Candidate,
        slot: { kind: SlotKind; startTime: string },
        cost: { min: number; max: number },
      ) => ({
        title: c.name,
        reason: reasonFor(c, slot, epochOf(input.date)),
        category: c.category,
        district: c.district,
        geo: c.geo ?? null,
        rating: c.rating ?? null,
        mustTry: c.mustTry ?? null,
        cost,
        locationId: suggestions.has(c.id) ? undefined : c.id,
        suggestion: suggestions.get(c.id) ?? null,
        kind: slot.kind,
      });

      const stops = draft.stops.map((s) => {
        const suggestion = s.place ? suggestions.get(s.place.id) ?? null : null;
        return {
          kind: s.slot.kind,
          bucket: s.slot.bucket,
          startTime: s.slot.startTime,
          minutes: s.slot.minutes,
          unfilled: s.unfilled,
          title: s.place?.name ?? "",
          reason: s.reason,
          travelM: s.travelM,
          cost: s.cost,
          warnings: s.warnings,
          category: s.place?.category ?? null,
          district: s.place?.district ?? null,
          geo: s.place?.geo ?? null,
          rating: s.place?.rating ?? null,
          mustTry: s.place?.mustTry ?? null,
          /** Set for a place already in the space. */
          locationId: s.place && !suggestion ? s.place.id : undefined,
          /** Set for a place Google found, which is not in the database yet. */
          suggestion,
          /*
           * The next-best places for this slot, so "Đổi chặng này" costs
           * nothing — no second request, and no second metered lookup.
           */
          alternatives: s.alternatives.map((c) =>
            asOption(c, s.slot, costBandFor(s.slot.kind, c.priceLevel)),
          ),
        };
      });

      return {
        ok: true as const,
        skeleton: draft.skeleton,
        date: draft.date,
        startAt: draft.startAt,
        seed: draft.seed,
        band: draft.band,
        warnings: draft.warnings,
        stops,
        /** Every slot empty: the screen offers "add a few places" rather than an error. */
        needsMorePlaces: stops.length > 0 && stops.every((s) => s.unfilled),
      };
    }),

  /**
   * Turn the draft on screen into a trip and its items.
   *
   * The draft is not trusted. Every saved place is re-checked against this
   * space, and the trip's identity is recomputed here from what actually
   * arrived — a client that edited the draft gets the plan it edited, not the
   * one it was given.
   */
  confirm: protectedProcedure
    .input(
      z.object({
        date: dateKey,
        title: z.string().trim().min(1).max(120).optional(),
        stops: z
          .array(
            z.object({
              kind: kindEnum,
              startTime: timeStr,
              title: z.string().trim().min(1).max(160),
              locationId: z.string().optional(),
              suggestion: suggestionInput.optional(),
              cost: z.number().min(0).max(100_000_000).default(0),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();

      // Every stop is one place or the other, never both and never neither.
      for (const s of input.stops) {
        if (!s.locationId === !s.suggestion) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "BAD_STOP" });
        }
      }

      // Saved places must belong to this space. Checked in one query rather
      // than one per stop, but the guard is the same as plan-item's.
      const ids = input.stops.map((s) => s.locationId).filter((v): v is string => !!v);
      if (ids.length) {
        const owned = await LocationModel.find({ _id: { $in: ids }, spaceId: ctx.spaceId })
          .select("_id")
          .lean<Array<{ _id: unknown }>>();
        if (owned.length !== new Set(ids).size) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "BAD_LOCATION" });
        }
      }

      /*
       * Google's places become rows now, and only now.
       *
       * Upserted on (spaceId, externalId), which is what makes a second tap
       * keep one row. `source: "suggested"` is set on insert only: a place the
       * couple has since pressed "Giữ lại" on must not be demoted back by
       * appearing in another plan.
       */
      const resolved: string[] = [];
      for (const s of input.stops) {
        if (s.locationId) { resolved.push(s.locationId); continue; }
        const sug = s.suggestion!;
        const row = await LocationModel.findOneAndUpdate(
          { spaceId: ctx.spaceId, externalId: sug.externalId },
          {
            $set: {
              name: sug.name,
              category: sug.category,
              district: sug.district,
              geo: sug.geo,
              rating: sug.rating ?? undefined,
              priceLevel: sug.priceLevel ?? undefined,
              openTime: sug.openTime ?? undefined,
              closeTime: sug.closeTime ?? undefined,
            },
            $setOnInsert: {
              spaceId: ctx.spaceId,
              externalId: sug.externalId,
              source: "suggested",
              status: "want_to_go",
              createdBy: ctx.userId,
            },
          },
          { upsert: true, new: true },
        ).lean<{ _id: unknown }>();
        resolved.push(String(row!._id));
      }

      /*
       * The plan's fingerprint, computed from what arrived rather than taken
       * from the client. Confirming the same draft twice lands on the same
       * trip; confirming a plan with a stop removed is a different plan and
       * correctly makes a second one.
       */
      const sourceKey = createHash("sha1")
        .update(
          [input.date, ...input.stops.map((s, i) => `${s.startTime}|${resolved[i]}`)].join(","),
        )
        .digest("hex");

      const existing = await TripModel.findOne({ spaceId: ctx.spaceId, sourceKey })
        .select("_id")
        .lean<{ _id: unknown }>();
      if (existing) {
        return {
          tripId: String(existing._id), date: input.date,
          alreadyConfirmed: true, locationIds: resolved,
        };
      }

      let tripId: string;
      try {
        const trip = await TripModel.create({
          spaceId: ctx.spaceId,
          title: input.title ?? `Hôm nay đi đâu — ${input.date}`,
          startDate: input.date,
          endDate: input.date,
          sourceKey,
          createdBy: ctx.userId,
        });
        tripId = String(trip._id);
      } catch (err) {
        // Two confirms racing: the unique index refused the second one, so the
        // first one's trip is the answer for both.
        const raced = await TripModel.findOne({ spaceId: ctx.spaceId, sourceKey })
          .select("_id")
          .lean<{ _id: unknown }>();
        if (!raced) throw err;
        return {
          tripId: String(raced._id), date: input.date,
          alreadyConfirmed: true, locationIds: resolved,
        };
      }

      await PlanItemModel.insertMany(
        input.stops.map((s, i) => ({
          spaceId: ctx.spaceId,
          title: s.title,
          date: input.date,
          bucket: bucketForTime(s.startTime),
          time: s.startTime,
          order: i,
          status: "planned",
          locationId: resolved[i],
          tripId,
          cost: Math.round(s.cost),
          createdBy: ctx.userId,
        })),
      );

      // The resolved ids travel back so the screen can offer "chỉ đường tới
      // chặng 1" and "rủ người kia" without another round trip.
      return { tripId, date: input.date, alreadyConfirmed: false, locationIds: resolved };
    }),
});
