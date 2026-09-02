import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { MemoryModel } from "@/server/db/models/memory";
import { LocationModel } from "@/server/db/models/location";
import { ReactionModel } from "@/server/db/models/reaction";
import { NoteModel } from "@/server/db/models/note";
import { destroyAssets } from "@/server/cloudinary";
import { resolveEmbed } from "@/server/lib/resolve-embed";

// Re-derive embed metadata server-side from each URL so iframe srcs are never
// attacker-controlled (the client only needs to send the pasted URL). Async
// because TikTok links are resolved via oEmbed (short-links + thumbnails).
async function deriveEmbeds(embeds: { url: string }[] | undefined) {
  return Promise.all(
    (embeds ?? []).map(async (e) => {
      const p = await resolveEmbed(e.url);
      return {
        provider: p.provider,
        url: e.url,
        embedId: p.embedId ?? undefined,
        embedUrl: p.embedUrl ?? undefined,
        thumbnailUrl: p.thumbnailUrl ?? undefined,
        title: p.title ?? undefined,
      };
    }),
  );
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
  // Optional, and validated as a clock time so a stray value cannot reach the
  // display layer. Empty string is accepted and stored as absent.
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Giờ không hợp lệ").optional().or(z.literal("")),
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
  /**
   * One page of the timeline, newest first.
   *
   * Used to return every memory in the space with all its photos and embeds.
   * A feed that grows for years and carries up to ten photos per entry is not
   * something to send in one response — the payload only ever gets bigger, and
   * nobody scrolls to the bottom of it.
   *
   * The cursor pairs date with _id because date is not unique: several
   * memories share a day, and paging on date alone either repeats them across
   * pages or skips them.
   *
   * Tag filtering moved here from the client for the same reason. Filtering a
   * page that has already been fetched only searches what happens to be loaded,
   * so picking a tag whose memories sit further down the feed would show
   * nothing and look like they had been lost.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(60).default(24),
          tag: z.string().trim().min(1).max(24).optional(),
        })
        .default({ limit: 24 }),
    )
    .query(async ({ ctx, input }) => {
    await connectToDatabase();
    const filter: Record<string, unknown> = { spaceId: ctx.spaceId };
    if (input.tag) filter.tags = input.tag;
    if (input.cursor) {
      // date is a Date, so the cursor carries it as ISO and it is compared as
      // a Date — a string comparison against a BSON date matches nothing and
      // would silently return an empty second page.
      const [cursorDate, cursorId] = input.cursor.split("|");
      const at = new Date(cursorDate);
      filter.$or = [
        { date: { $lt: at } },
        { date: at, _id: { $lt: cursorId } },
      ];
    }
    // One extra row tells us whether another page exists without a count query.
    const docs = await MemoryModel.find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(input.limit + 1)
      .lean();
    const hasMore = docs.length > input.limit;
    const page = hasMore ? docs.slice(0, input.limit) : docs;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? `${new Date(last.date as Date).toISOString()}|${String(last._id)}`
        : null;
    const items = page.map((d) => ({
      id: String(d._id),
      title: d.title,
      caption: d.caption ?? null,
      time: (d as { time?: string }).time || null,
      // Dimensions travel with the URL. They are stored and validated already,
      // and without them the client cannot reserve a photo's space before it
      // loads — which is what made the timeline jump around as it scrolled.
      photos: (d.photos ?? []).map(
        (p: { url: string; publicId: string; width?: number; height?: number }) => ({
          url: p.url,
          publicId: p.publicId,
          width: p.width ?? null,
          height: p.height ?? null,
        }),
      ),
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
    return { items, nextCursor };
  }),

  /**
   * Every tag used in the space, for the filter chips.
   *
   * Separate from the feed on purpose: the chips have to show tags from the
   * whole timeline, not only from the pages that happen to be loaded, or a tag
   * would appear and disappear as you scroll.
   */
  tags: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const values = await MemoryModel.distinct("tags", { spaceId: ctx.spaceId });
    return (values as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"));
  }),

  create: protectedProcedure
    .input(memoryInput)
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await assertLocationInSpace(input.locationId, ctx.spaceId);
      const doc = await MemoryModel.create({
        ...input,
        embeds: await deriveEmbeds(input.embeds),
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
        ...(patch.embeds ? { embeds: await deriveEmbeds(patch.embeds) } : {}),
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
      // Reactions and notes point at the memory by id, so deleting the memory
      // alone would leave them addressing nothing — invisible rows that still
      // count against the space and would reattach if an id were ever reused.
      await Promise.all([
        ReactionModel.deleteMany({
          spaceId: ctx.spaceId,
          targetType: "memory",
          targetId: input.id,
        }),
        NoteModel.deleteMany({
          spaceId: ctx.spaceId,
          targetType: "memory",
          targetId: input.id,
        }),
      ]);
      await destroyAssets(publicIds); // best-effort, after the DB delete
      return { ok: true };
    }),
});
