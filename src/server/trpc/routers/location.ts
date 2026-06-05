import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { LocationModel } from "@/server/db/models/location";
import { DISTRICTS, CATEGORIES } from "@/lib/districts-categories";
import { requireEnv } from "@/lib/env";

const districtEnum = z.enum(DISTRICTS);
const categoryEnum = z.enum(CATEGORIES);
const statusEnum = z.enum(["want_to_go", "visited"]);
// Only allow https links (anti stored-XSS / open-redirect on rendered hrefs).
const httpsUrl = z.string().url().startsWith("https://");
const geo = z.object({ lat: z.number(), lng: z.number() });

const locationInput = z.object({
  name: z.string().trim().min(1).max(120),
  district: districtEnum,
  category: categoryEnum,
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
          district: districtEnum.optional(),
          category: categoryEnum.optional(),
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
      const doc = await LocationModel.create({
        ...input,
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

      const token = requireEnv("MAPBOX_SECRET_TOKEN");
      const coords = `${input.origin.lng},${input.origin.lat};${dest.geo.lng},${dest.geo.lat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok)
        throw new TRPCError({ code: "BAD_GATEWAY", message: "DIRECTIONS_FAILED" });
      const data = (await res.json()) as {
        routes?: Array<{
          distance: number;
          duration: number;
          geometry: unknown;
        }>;
      };
      const route = data.routes?.[0];
      if (!route) throw new TRPCError({ code: "NOT_FOUND", message: "NO_ROUTE" });
      return {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        geometry: route.geometry,
      };
    }),
});
