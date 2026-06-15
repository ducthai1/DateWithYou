import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { MemoryModel } from "@/server/db/models/memory";
import { LocationModel } from "@/server/db/models/location";
import { destroyAssets } from "@/server/cloudinary";
import { parseEmbed } from "@/lib/embed";

// Re-derive embed metadata server-side from each URL so iframe srcs are never
// attacker-controlled (the client only needs to send the pasted URL).
function deriveEmbeds(embeds: { url: string }[] | undefined) {
  return (embeds ?? []).map((e) => {
    const p = parseEmbed(e.url);
    return {
      provider: p.provider,
      url: e.url,
      embedId: p.embedId ?? undefined,
      embedUrl: p.embedUrl ?? undefined,
      thumbnailUrl: p.thumbnailUrl ?? undefined,
    };
  });
}

const photo = z.object({
  url: z.string().url().startsWith("https://"),
  publicId: z.string().min(1),
  width: z.number().optional(),
  height: z.number().optional(),
});

// Only the URL is accepted; embed metadata is derived server-side (deriveEmbeds).
const embed = z.object({
  url: z.string().url().startsWith("https://"),
});

const memoryInput = z.object({
  title: z.string().trim().min(1).max(120),
  caption: z.string().trim().max(1000).optional(),
  photos: z.array(photo).max(10).default([]),
  embeds: z.array(embed).max(10).default([]),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  date: z.coerce.date(),
  locationId: z.string().optional(),
  geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

// FK guard: a referenced location must belong to the caller's space.
async function assertLocationInSpace(
  locationId: string | undefined,
  spaceId: string,
) {
  if (!locationId) return;
  const loc = await LocationModel.findOne({ _id: locationId, spaceId })
    .select("_id")
    .lean();
  if (!loc) throw new TRPCError({ code: "BAD_REQUEST", message: "BAD_LOCATION" });
}

export const memoryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const docs = await MemoryModel.find({ spaceId: ctx.spaceId })
      .sort({ date: -1 })
      .lean();
    return docs.map((d) => ({
      id: String(d._id),
      title: d.title,
      caption: d.caption ?? null,
      photos: (d.photos ?? []).map((p: { url: string; publicId: string }) => ({
        url: p.url,
        publicId: p.publicId,
      })),
      embeds: (d.embeds ?? []).map((e: Record<string, string>) => ({
        provider: e.provider,
        url: e.url,
        embedUrl: e.embedUrl ?? null,
        thumbnailUrl: e.thumbnailUrl ?? null,
        title: e.title ?? null,
      })),
      tags: d.tags ?? [],
      date: d.date,
      locationId: d.locationId ?? null,
      geo: d.geo?.lat != null ? { lat: d.geo.lat, lng: d.geo.lng } : null,
    }));
  }),

  create: protectedProcedure
    .input(memoryInput)
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await assertLocationInSpace(input.locationId, ctx.spaceId);
      const doc = await MemoryModel.create({
        ...input,
        embeds: deriveEmbeds(input.embeds),
        spaceId: ctx.spaceId,
        createdBy: ctx.userId,
      });
      return { id: String(doc._id) };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).and(memoryInput.partial()))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { id, ...patch } = input;
      await assertLocationInSpace(patch.locationId, ctx.spaceId);
      const existing = await MemoryModel.findOne({ _id: id, spaceId: ctx.spaceId });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      // Compute assets to drop, persist the DB change FIRST, then destroy —
      // so a save failure never leaves the doc pointing at deleted images.
      let removed: string[] = [];
      if (patch.photos) {
        const nextIds = new Set(patch.photos.map((p) => p.publicId));
        removed = (existing.photos ?? [])
          .map((p: { publicId: string }) => p.publicId)
          .filter((pid: string) => !nextIds.has(pid));
      }
      existing.set({
        ...patch,
        ...(patch.embeds ? { embeds: deriveEmbeds(patch.embeds) } : {}),
      });
      await existing.save();
      await destroyAssets(removed);
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await MemoryModel.findOne({ _id: input.id, spaceId: ctx.spaceId });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      const publicIds = (doc.photos ?? []).map(
        (p: { publicId: string }) => p.publicId,
      );
      await doc.deleteOne();
      await destroyAssets(publicIds); // best-effort, after the DB delete
      return { ok: true };
    }),
});
