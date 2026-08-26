import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { LocationModel } from "@/server/db/models/location";
import {
  LocationConfigModel,
  type LocationConfig,
} from "@/server/db/models/location-config";
import { LiveLocationModel } from "@/server/db/models/live-location";
import { NavigationInviteModel } from "@/server/db/models/navigation-invite";
import { SpaceModel } from "@/server/db/models/space";
import { DISTRICTS, CATEGORIES } from "@/lib/districts-categories";
import { requireEnv } from "@/lib/env";
import { resolveGeoFromMapsUrl, extractFirstUrl } from "@/server/lib/resolve-maps-geo";
import { geocodeAddress } from "@/server/lib/geocode-address";
import { PARTNER_FIX_FRESH_MS } from "@/lib/maps";

const districtSchema = z.string().trim().min(1);
const categorySchema = z.string().trim().min(1);
const statusEnum = z.enum(["want_to_go", "visited"]);
// Only allow https links (anti stored-XSS / open-redirect on rendered hrefs).
const httpsUrl = z.string().url().startsWith("https://");
const geo = z.object({ lat: z.number(), lng: z.number() });

// Mobile clipboards often wrap the share link in prose ("Quán X https://…")
// and the picker may hand back an http:// form. Pull out the first URL and
// upgrade the scheme before the https-only guard runs, so a phone paste that
// "looks" malformed still validates and stores cleanly.
const mapsUrlInput = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  const url = extractFirstUrl(trimmed);
  if (!url) return trimmed; // let httpsUrl produce a clear validation error
  return url.replace(/^http:\/\//i, "https://");
}, httpsUrl.optional());

const locationInput = z.object({
  name: z.string().trim().min(1).max(120),
  district: districtSchema,
  category: categorySchema,
  geo: geo.optional(),
  googleMapsUrl: mapsUrlInput,
  socialUrl: httpsUrl.optional(),
  mustTry: z.string().trim().max(200).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  status: statusEnum.optional(),
  openTime: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid format HH:mm").optional().or(z.literal("")),
  closeTime: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid format HH:mm").optional().or(z.literal("")),
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
        openTime: d.openTime ?? null,
        closeTime: d.closeTime ?? null,
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
        geoVal = (await resolveGeoFromMapsUrl(input.googleMapsUrl, geocodeAddress)) ?? undefined;
      }
      const doc = await LocationModel.create({
        ...input,
        geo: geoVal,
        // Stamp the visit day up-front when a place is added already "visited".
        visitedAt: input.status === "visited" ? new Date() : undefined,
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
        const g = await resolveGeoFromMapsUrl(patch.googleMapsUrl, geocodeAddress);
        if (g) patch.geo = g;
      }
      const update: Record<string, unknown> = { $set: patch };
      // Only (re)stamp visitedAt on an actual transition, so editing an
      // already-visited place's note/name never silently moves its calendar day.
      if (patch.status) {
        const current = await LocationModel.findOne({ _id: id, spaceId: ctx.spaceId })
          .select("status")
          .lean<{ status: string }>();
        if (patch.status === "visited" && current?.status !== "visited") {
          (update.$set as Record<string, unknown>).visitedAt = new Date();
        } else if (patch.status === "want_to_go") {
          update.$unset = { visitedAt: "" };
        }
      }
      const res = await LocationModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        update,
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
      const nowVisited = doc.status !== "visited";
      doc.status = nowVisited ? "visited" : "want_to_go";
      // Record the day it was marked visited; clear it when un-marking.
      doc.set("visitedAt", nowVisited ? new Date() : undefined);
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
    .input(z.object({
      // Either a saved-place id (looked up) or a raw destination coordinate.
      // The raw form lets the client re-route a single leg toward an arbitrary
      // intermediate stop (waypoint) that isn't a saved location.
      destinationId: z.string().optional(),
      destination: geo.optional(),
      origin: geo,
      waypoints: z.array(z.object({ lat: z.number(), lng: z.number() })).optional()
    }))
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      let destGeo = input.destination;
      if (!destGeo) {
        if (!input.destinationId)
          throw new TRPCError({ code: "BAD_REQUEST", message: "NO_DESTINATION" });
        const dest = await LocationModel.findOne({
          _id: input.destinationId,
          spaceId: ctx.spaceId,
        })
          .select("geo")
          .lean<{ geo?: { lat: number; lng: number } }>();
        if (!dest?.geo || dest.geo.lat == null)
          throw new TRPCError({ code: "NOT_FOUND", message: "NO_DESTINATION_GEO" });
        destGeo = { lat: dest.geo.lat, lng: dest.geo.lng };
      }

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
              ...(input.waypoints?.map(w => ({ lat: w.lat, lon: w.lng })) || []),
              { lat: destGeo.lat, lon: destGeo.lng },
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
          legs?: Array<{ shape?: string; length?: number; time?: number }>;
        };
      };
      const trip = data.trip;
      if (!trip?.legs?.length)
        throw new TRPCError({ code: "NOT_FOUND", message: "NO_ROUTE" });
      const legs = trip.legs.map((leg) => ({
        distanceMeters: Math.round((leg.length ?? 0) * 1000),
        durationSeconds: Math.round(leg.time ?? 0),
        geometry: {
          type: "LineString",
          coordinates: leg.shape ? decodePolyline(leg.shape, 6) : [],
        },
      }));
      const allCoordinates = legs.flatMap((l) => l.geometry.coordinates);

      return {
        distanceMeters: Math.round((trip.summary?.length ?? 0) * 1000),
        durationSeconds: Math.round(trip.summary?.time ?? 0),
        geometry: { type: "LineString", coordinates: allCoordinates },
        legs,
      };
    }),

  getConfig: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const existing = await LocationConfigModel.findOne({
      spaceId: ctx.spaceId,
    }).lean<LocationConfig>();
    if (existing) {
      return { categories: existing.categories, districts: existing.districts };
    }
    // First access for this space: seed the config with the default lists and
    // return those defaults (spread to plain string[] so the tRPC output type
    // is concrete, not a readonly tuple).
    await LocationConfigModel.create({
      spaceId: ctx.spaceId,
      categories: CATEGORIES,
      districts: DISTRICTS,
    });
    return {
      categories: [...CATEGORIES] as string[],
      districts: [...DISTRICTS] as string[],
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

  // Upsert the user's current location and return the partner's location (if recently active)
  pingLiveLocation: protectedProcedure
    .input(z.object({
      lat: z.number(),
      lng: z.number(),
      heading: z.number().nullable().optional(),
      speedKmH: z.number().nullable().optional(),
      accuracy: z.number().nullable().optional(),
      batteryLevel: z.number().nullable().optional(),
      pingAction: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      
      // Update own location
      await LiveLocationModel.findOneAndUpdate(
        { spaceId: ctx.spaceId, userId: ctx.userId },
        { 
          lat: input.lat,
          lng: input.lng,
          heading: input.heading,
          speedKmH: input.speedKmH,
          accuracy: input.accuracy,
          batteryLevel: input.batteryLevel,
          pingAction: input.pingAction,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Other members in this space whose last ping is still fresh. The window
      // is shared with the client so a cached fix and a queried one mean the
      // same thing — see PARTNER_FIX_FRESH_MS.
      const freshSince = new Date(Date.now() - PARTNER_FIX_FRESH_MS);
      const partners = await LiveLocationModel.find({
        spaceId: ctx.spaceId,
        userId: { $ne: ctx.userId },
        updatedAt: { $gt: freshSince }
      }).lean<{ userId: string; lat: number; lng: number; heading: number | null; speedKmH: number | null; accuracy: number | null; batteryLevel: number | null; pingAction: string | null; updatedAt: Date }[]>();

      return partners;
    }),

  // ── Navigation Invites ("Cùng khởi hành") ─────────────────────────────

  /**
   * Send a "Cùng khởi hành" invite to the partner in the same space.
   * Cancels any existing pending invite from this user first.
   */
  sendNavInvite: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        locationName: z.string().min(1),
        waypoints: z.array(z.object({
          lat: z.number(),
          lng: z.number(),
          name: z.string(),
          type: z.enum(["partner_location", "saved_place", "custom"]).default("custom"),
          status: z.enum(["pending", "arrived"]).default("pending")
        })).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();

      // Find the partner in this space.
      const space = await SpaceModel.findById(ctx.spaceId)
        .select("members")
        .lean<{ members: string[] }>();
      if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
      const partnerId = space.members.find((m) => m !== ctx.userId);
      if (!partnerId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cần có 2 người trong không gian để rủ nhau đi.",
        });

      // Cancel any previous pending invite from this user.
      await NavigationInviteModel.updateMany(
        { spaceId: ctx.spaceId, initiatorId: ctx.userId, status: "pending" },
        { status: "rejected" },
      );

      const invite = await NavigationInviteModel.create({
        spaceId: ctx.spaceId,
        initiatorId: ctx.userId,
        targetId: partnerId,
        locationId: input.locationId,
        locationName: input.locationName,
        waypoints: input.waypoints || [],
      });

      return { id: String(invite._id) };
    }),

  /** Accept or reject an incoming navigation invite. */
  respondNavInvite: protectedProcedure
    .input(
      z.object({
        inviteId: z.string().min(1),
        accept: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const invite = await NavigationInviteModel.findOneAndUpdate(
        {
          _id: input.inviteId,
          spaceId: ctx.spaceId,
          targetId: ctx.userId,
          status: "pending",
        },
        {
          status: input.accept ? "accepted" : "rejected",
          // Keep an accepted trip's document alive through a realistic ride so
          // the end-trip notification (and reload guard) still work past the
          // original 5-minute pending TTL.
          ...(input.accept ? { expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) } : {}),
        },
        { new: true },
      ).lean<{
        _id: unknown;
        locationId: string;
        locationName: string;
        status: string;
        waypoints: Array<{
          lat: number;
          lng: number;
          name: string;
          type: "partner_location" | "saved_place" | "custom";
          status: "pending" | "arrived";
        }>;
      }>();

      if (!invite)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lời mời không tồn tại hoặc đã hết hạn.",
        });

      return {
        id: String(invite._id),
        locationId: invite.locationId,
        locationName: invite.locationName,
        status: invite.status,
        // Return waypoints so both partners can reconstruct the multi-leg route
        waypoints: (invite.waypoints ?? []).map((w) => ({
          lat: w.lat,
          lng: w.lng,
          name: w.name,
          type: w.type,
          status: w.status,
        })),
      };
    }),

  /**
   * Poll the status of an invite the current user SENT. Reconciliation fallback
   * for the sender: the SSE `invite-response` event is pushed only once on the
   * status transition, so a single dropped frame (proxy buffering, reconnect
   * gap) would otherwise leave the sender waiting forever. Returns "expired"
   * when the invite is gone (TTL) so the client can stop waiting.
   */
  sentInviteStatus: protectedProcedure
    .input(z.object({ inviteId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const invite = await NavigationInviteModel.findOne({
        _id: input.inviteId,
        spaceId: ctx.spaceId,
        initiatorId: ctx.userId,
      })
        .select("status locationId locationName waypoints")
        .lean<{
          status: string;
          locationId: string;
          locationName: string;
          waypoints: {
            lat: number;
            lng: number;
            name: string;
            type: "partner_location" | "saved_place" | "custom";
            status: "pending" | "arrived";
          }[];
        }>();
      if (!invite) {
        return { status: "expired", locationId: null, locationName: null, waypoints: [] };
      }
      return {
        status: invite.status,
        locationId: invite.locationId,
        locationName: invite.locationName,
        waypoints: (invite.waypoints ?? []).map((w) => ({
          lat: w.lat,
          lng: w.lng,
          name: w.name,
          type: w.type,
          status: w.status,
        })),
      };
    }),

  /** Cancel a pending invite the current user sent. */
  cancelNavInvite: protectedProcedure
    .input(z.object({ inviteId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await NavigationInviteModel.findOneAndUpdate(
        {
          _id: input.inviteId,
          spaceId: ctx.spaceId,
          initiatorId: ctx.userId,
          status: "pending",
        },
        { status: "rejected" },
      );
      return { ok: true };
    }),

  /**
   * End a shared ("Cùng khởi hành") trip. Either partner may call it; the invite
   * is marked ended with `endedBy` so the SSE notifies only the OTHER partner,
   * who is then asked whether to stop too.
   */
  endNavTrip: protectedProcedure
    .input(z.object({ inviteId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await NavigationInviteModel.findOneAndUpdate(
        {
          _id: input.inviteId,
          spaceId: ctx.spaceId,
          $or: [{ initiatorId: ctx.userId }, { targetId: ctx.userId }],
        },
        { status: "ended", endedBy: ctx.userId },
      );
      return { ok: true };
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
