import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { MediaItemModel } from "@/server/db/models/media-item";
import { resolveEmbed } from "@/server/lib/resolve-embed";

const kindEnum = z.enum(["music", "food_video", "recipe", "game"]);
const httpsUrl = z.string().url().startsWith("https://");

// Embed metadata is ALWAYS derived server-side from the URL — never trusted from
// the client — so a crafted request can't point an iframe at arbitrary content.
// Async because TikTok links are resolved via oEmbed (short-links + thumbnails).
async function embedFields(url: string | undefined) {
  if (!url) return { provider: undefined, embedId: undefined, embedUrl: undefined, thumbnailUrl: undefined };
  const e = await resolveEmbed(url);
  return {
    provider: e.provider,
    embedId: e.embedId ?? undefined,
    embedUrl: e.embedUrl ?? undefined,
    thumbnailUrl: e.thumbnailUrl ?? undefined,
  };
}

const recipe = z.object({
  ingredients: z.array(z.string().trim().min(1)).max(50).default([]),
  steps: z.array(z.string().trim().min(1)).max(50).default([]),
  cookTime: z.string().trim().max(40).optional(),
  servings: z.string().trim().max(40).optional(),
  coverImage: httpsUrl.optional(),
});

// Note: embed metadata (provider/embedId/embedUrl/thumbnailUrl) is NOT accepted
// from the client — it is derived from `url` on the server. See embedFields().
const mediaInput = z.object({
  kind: kindEnum,
  title: z.string().trim().min(1).max(160),
  note: z.string().trim().max(1000).optional(),
  url: httpsUrl.optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  recipe: recipe.optional(),
});

function serialize(d: Record<string, unknown>) {
  const r = d.recipe as Record<string, unknown> | undefined;
  return {
    id: String(d._id),
    kind: d.kind as "music" | "food_video" | "recipe" | "game",
    title: d.title as string,
    note: (d.note as string) ?? null,
    url: (d.url as string) ?? null,
    provider: (d.provider as string) ?? null,
    embedUrl: (d.embedUrl as string) ?? null,
    thumbnailUrl: (d.thumbnailUrl as string) ?? null,
    tags: (d.tags as string[]) ?? [],
    recipe: r
      ? {
          ingredients: (r.ingredients as string[]) ?? [],
          steps: (r.steps as string[]) ?? [],
          cookTime: (r.cookTime as string) ?? null,
          servings: (r.servings as string) ?? null,
          coverImage: (r.coverImage as string) ?? null,
        }
      : null,
  };
}

export const mediaRouter = router({
  list: protectedProcedure
    .input(z.object({ kind: kindEnum.optional() }).optional())
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const filter: Record<string, unknown> = { spaceId: ctx.spaceId };
      if (input?.kind) filter.kind = input.kind;
      const docs = await MediaItemModel.find(filter).sort({ createdAt: -1 }).lean();
      return docs.map(serialize);
    }),

  create: protectedProcedure.input(mediaInput).mutation(async ({ ctx, input }) => {
    await connectToDatabase();
    const doc = await MediaItemModel.create({
      ...input,
      ...(await embedFields(input.url)),
      spaceId: ctx.spaceId,
      createdBy: ctx.userId,
    });
    return { id: String(doc._id) };
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).and(mediaInput.partial()))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const { id, ...patch } = input;
      // Re-derive embed metadata whenever the URL changes.
      const derived = patch.url !== undefined ? await embedFields(patch.url) : {};
      const res = await MediaItemModel.findOneAndUpdate(
        { _id: id, spaceId: ctx.spaceId },
        { $set: { ...patch, ...derived } },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await MediaItemModel.deleteOne({ _id: input.id, spaceId: ctx.spaceId });
      if (res.deletedCount === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
