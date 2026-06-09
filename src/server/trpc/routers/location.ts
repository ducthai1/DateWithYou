import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { LocationModel } from "@/server/db/models/location";
import { LocationConfigModel } from "@/server/db/models/location-config";
import { DISTRICTS, CATEGORIES } from "@/lib/districts-categories";
import { requireEnv } from "@/lib/env";

const districtSchema = z.string().trim().min(1);
const categorySchema = z.string().trim().min(1);
const statusEnum = z.enum(["want_to_go", "visited"]);
// Only allow https links (anti stored-XSS / open-redirect on rendered hrefs).
const httpsUrl = z.string().url().startsWith("https://");
const geo = z.object({ lat: z.number(), lng: z.number() });

/**
 * Best-effort extraction of coordinates from a Google Maps URL so a pasted link
 * drops a pin automatically. Short links (maps.app.goo.gl / goo.gl) are resolved
 * by following the redirect to the full URL that carries @lat,lng or !3d!4d.
 * Returns null when the link has no embedded coordinates.
 */
async function geoFromGoogleMapsUrl(
  url: string,
): Promise<{ lat: number; lng: number } | null> {
  let finalUrl = url;
  if (/(?:maps\.app\.goo\.gl|goo\.gl)\//.test(url)) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      finalUrl = res.url || url;
    } catch {
      // redirect/network failure → parse the original URL as-is
    }
  }
  // Order matters: !3d!4d is the actual place; @lat,lng is only the camera
  // centre (often ~1km off), so it must be the last resort.
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|ll|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const re of patterns) {
    const m = finalUrl.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}

const locationInput = z.object({
  name: z.string().trim().min(1).max(120),
  district: districtSchema,
  category: categorySchema,
  geo: geo.optional(),
  googleMapsUrl: httpsUrl.optional(),
  socialUrl: httpsUrl.optional(),
  mustTry: z.string().trim().max(200).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  status: statusEnum.optional(),
  note: z.string().trim().max(500).optional(),
});

export const locationRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          district: districtSchema.optional(),
          category: categorySchema.optional(),
          status: statusEnum.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const filter: Record<string, unknown> = { spaceId: ctx.spaceId };
      if (input?.district) filter.district = input.district;
      if (input?.category) filter.category = input.category;
      if (input?.status) filter.status = input.status;
      const docs = await LocationModel.find(filter)
        .sort({ createdAt: -1 })
        .lean();
      return docs.map((d) => ({
        id: String(d._id),
        name: d.name,
        district: d.district,
        category: d.category,
        geo: d.geo?.lat != null ? { lat: d.geo.lat, lng: d.geo.lng } : null,
        googleMapsUrl: d.googleMapsUrl ?? null,
        socialUrl: d.socialUrl ?? null,
        mustTry: d.mustTry ?? null,
        rating: d.rating ?? null,
        status: d.status as "want_to_go" | "visited",
        note: d.note ?? null,
      }));
    }),

  create: protectedProcedure
    .input(locationInput)
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      // Auto-drop a pin from the pasted Google Maps link when no coords were set.
      let geoVal = input.geo;
      if (!geoVal && input.googleMapsUrl) {
        geoVal = (await geoFromGoogleMapsUrl(input.googleMapsUrl)) ?? undefined;
      }
      const doc = await LocationModel.create({
        ...input,
        geo: geoVal,
        spaceId: ctx.spaceId,
        createdBy: ctx.userId,
      });
      return { id: String(doc._id) };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).and(locationInput.partial()))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { id, ...patch } = input;
      // Re-resolve a pin when the maps link changed and no coords were provided.
      if (!patch.geo && patch.googleMapsUrl) {
        const g = await geoFromGoogleMapsUrl(patch.googleMapsUrl);
        if (g) patch.geo = g;
      }
      const res = await LocationModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        { $set: patch },
        { new: true },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  toggleStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await LocationModel.findOne({
        _id: input.id,
        spaceId: ctx.spaceId,
      }).select("status");
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      doc.status = doc.status === "visited" ? "want_to_go" : "visited";
      await doc.save();
      return { status: doc.status as "want_to_go" | "visited" };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await LocationModel.deleteOne({
        _id: input.id,
        spaceId: ctx.spaceId,
      });
      if (res.deletedCount === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  // Server-side Directions proxy — keeps the secret token off the client and
  // validates the destination belongs to the caller's space.
  getRoute: protectedProcedure
    .input(z.object({ destinationId: z.string(), origin: geo }))
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const dest = await LocationModel.findOne({
        _id: input.destinationId,
        spaceId: ctx.spaceId,
      })
        .select("geo")
        .lean<{ geo?: { lat: number; lng: number } }>();
      if (!dest?.geo || dest.geo.lat == null)
        throw new TRPCError({ code: "NOT_FOUND", message: "NO_DESTINATION_GEO" });

      // Valhalla via Stadia Maps. The `motor_scooter` costing is purpose-built
      // for motorbikes: it obeys one-way streets (no illegal contraflow) yet may
      // use the smaller roads a scooter is allowed on — the realistic Vietnam
      // motorbike route, which no ORS profile offers.
      const key = requireEnv("STADIA_API_KEY");
      const res = await fetch(
        `https://api.stadiamaps.com/route/v1?api_key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locations: [
              { lat: input.origin.lat, lon: input.origin.lng },
              { lat: dest.geo.lat, lon: dest.geo.lng },
            ],
            costing: "motor_scooter",
            directions_options: { units: "kilometers" },
          }),
        },
      );
      if (!res.ok)
        throw new TRPCError({ code: "BAD_GATEWAY", message: "DIRECTIONS_FAILED" });
      const data = (await res.json()) as {
        trip?: {
          summary?: { length?: number; time?: number };
          legs?: Array<{ shape?: string }>;
        };
      };
      const trip = data.trip;
      if (!trip?.legs?.length)
        throw new TRPCError({ code: "NOT_FOUND", message: "NO_ROUTE" });
      // Valhalla returns each leg as a precision-6 encoded polyline; stitch them
      // into a single GeoJSON LineString the map can render directly.
      const coordinates = trip.legs.flatMap((leg) =>
        leg.shape ? decodePolyline(leg.shape, 6) : [],
      );
      return {
        distanceMeters: Math.round((trip.summary?.length ?? 0) * 1000),
        durationSeconds: Math.round(trip.summary?.time ?? 0),
        geometry: { type: "LineString", coordinates },
      };
    }),

  getConfig: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    let config = await LocationConfigModel.findOne({ spaceId: ctx.spaceId }).lean();
    if (!config) {
      config = await LocationConfigModel.create({
        spaceId: ctx.spaceId,
        categories: CATEGORIES,
        districts: DISTRICTS,
      });
    }
    return {
      categories: config.categories,
      districts: config.districts,
    };
  }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        categories: z.array(z.string().trim().min(1)),
        districts: z.array(z.string().trim().min(1)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await LocationConfigModel.findOneAndUpdate(
        { spaceId: ctx.spaceId },
        { categories: input.categories, districts: input.districts },
        { upsert: true, new: true },
      );
      return { success: true };
    }),
});

/**
 * Decode a Google/Valhalla encoded polyline into GeoJSON [lng, lat] pairs.
 * Valhalla uses precision 6 (1e6); Google's classic format uses 5.
 */
function decodePolyline(
  encoded: string,
  precision = 6,
): Array<[number, number]> {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: Array<[number, number]> = [];
  const factor = Math.pow(10, precision);
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}
