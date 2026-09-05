import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { BlogPostModel } from "@/server/db/models/blog-post";
import { slugify } from "@/lib/slug";

/**
 * Blog / marketing articles.
 *
 * Two audiences on one model: the public procedures only ever see published
 * posts and read the fields a list or a page needs; the admin procedures (gated
 * by ADMIN_EMAILS) manage every post in any state. The body is stored and
 * returned verbatim — the render side owns how it looks, not this router.
 */

const CATEGORIES = ["tin-tuc", "tinh-nang", "meo-hay", "cap-nhat"] as const;

/** The columns a list row needs — never the body. */
const CARD_FIELDS = "slug title excerpt coverImage category tags featured viewCount publishedAt";

type PostDoc = {
  _id: unknown;
  slug: string;
  title: string;
  excerpt?: string;
  body?: string;
  coverImage?: string;
  category?: string;
  tags?: string[];
  status?: string;
  featured?: boolean;
  viewCount?: number;
  publishedAt?: Date;
  metaTitle?: string;
  metaDescription?: string;
  authorId?: string;
  authorName?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

function card(d: PostDoc) {
  return {
    slug: d.slug,
    title: d.title,
    excerpt: d.excerpt ?? "",
    coverImage: d.coverImage ?? null,
    category: d.category ?? "tin-tuc",
    tags: d.tags ?? [],
    featured: Boolean(d.featured),
    viewCount: d.viewCount ?? 0,
    // Only a real publish date — a draft has none. Public lists carry only
    // published posts, so this is never null there.
    publishedAt: (d.publishedAt ?? null) as Date | null,
  };
}

function full(d: PostDoc) {
  return {
    ...card(d),
    id: String(d._id),
    body: d.body ?? "",
    status: (d.status ?? "draft") as "draft" | "published",
    metaTitle: d.metaTitle ?? "",
    metaDescription: d.metaDescription ?? "",
    authorName: d.authorName ?? "",
    createdAt: (d.createdAt ?? null) as Date | null,
    updatedAt: (d.updatedAt ?? null) as Date | null,
  };
}

const postInput = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(90).optional(),
  excerpt: z.string().trim().max(400).default(""),
  body: z.string().max(200_000).default(""),
  coverImage: z.string().url().max(2000).optional().or(z.literal("")),
  category: z.enum(CATEGORIES).default("tin-tuc"),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(400).optional(),
});

/** A slug that no OTHER post holds — suffixes -2, -3… on collision. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || "bai-viet";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await BlogPostModel.findOne({ slug: candidate }).select("_id").lean<{ _id: unknown }>();
    if (!clash || (exceptId && String(clash._id) === exceptId)) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export const blogRouter = router({
  // ── Public ──────────────────────────────────────────────────────────────
  categories: publicProcedure.query(() => CATEGORIES),

  list: publicProcedure
    .input(
      z.object({
        category: z.enum(CATEGORIES).optional(),
        tag: z.string().trim().min(1).max(30).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(24).default(9),
      }),
    )
    .query(async ({ input }) => {
      await connectToDatabase();
      const filter: Record<string, unknown> = { status: "published" };
      if (input.category) filter.category = input.category;
      if (input.tag) filter.tags = input.tag;
      const skip = (input.page - 1) * input.pageSize;
      const [rows, total] = await Promise.all([
        BlogPostModel.find(filter)
          .select(CARD_FIELDS)
          .sort({ publishedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(input.pageSize)
          .lean<PostDoc[]>(),
        BlogPostModel.countDocuments(filter),
      ]);
      return {
        items: rows.map(card),
        total,
        page: input.page,
        pageSize: input.pageSize,
        hasMore: skip + rows.length < total,
      };
    }),

  featured: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(6).default(3) }).optional())
    .query(async ({ input }) => {
      await connectToDatabase();
      const rows = await BlogPostModel.find({ status: "published", featured: true })
        .select(CARD_FIELDS)
        .sort({ publishedAt: -1 })
        .limit(input?.limit ?? 3)
        .lean<PostDoc[]>();
      return rows.map(card);
    }),

  popular: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(10).default(5) }).optional())
    .query(async ({ input }) => {
      await connectToDatabase();
      const rows = await BlogPostModel.find({ status: "published" })
        .select(CARD_FIELDS)
        .sort({ viewCount: -1, publishedAt: -1 })
        .limit(input?.limit ?? 5)
        .lean<PostDoc[]>();
      return rows.map(card);
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1) }))
    .query(async ({ input }) => {
      await connectToDatabase();
      // One atomic read-and-count: a view is counted only for a post that
      // exists and is published, and the returned doc is the pre-increment one
      // (fine — the reader does not see their own +1).
      const doc = await BlogPostModel.findOneAndUpdate(
        { slug: input.slug, status: "published" },
        { $inc: { viewCount: 1 } },
        { new: false },
      ).lean<PostDoc>();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      return full(doc);
    }),

  // ── Admin (ADMIN_EMAILS) ────────────────────────────────────────────────
  adminList: adminProcedure
    .input(
      z
        .object({ status: z.enum(["draft", "published"]).optional() })
        .optional(),
    )
    .query(async ({ input }) => {
      await connectToDatabase();
      const filter = input?.status ? { status: input.status } : {};
      const rows = await BlogPostModel.find(filter).sort({ updatedAt: -1 }).lean<PostDoc[]>();
      return rows.map(full);
    }),

  adminGet: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      await connectToDatabase();
      const doc = await BlogPostModel.findById(input.id).lean<PostDoc>();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      return full(doc);
    }),

  create: adminProcedure.input(postInput).mutation(async ({ ctx, input }) => {
    await connectToDatabase();
    const slug = await uniqueSlug(input.slug || input.title);
    const doc = await BlogPostModel.create({
      ...input,
      slug,
      coverImage: input.coverImage || undefined,
      publishedAt: input.status === "published" ? new Date() : undefined,
      authorId: ctx.userId,
      authorName: ctx.userEmail,
    });
    return full(doc.toObject() as PostDoc);
  }),

  update: adminProcedure
    .input(postInput.partial().extend({ id: z.string() }))
    .mutation(async ({ input }) => {
      await connectToDatabase();
      const { id, slug, status, ...rest } = input;
      const current = await BlogPostModel.findById(id).lean<PostDoc>();
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });

      const patch: Record<string, unknown> = { ...rest };
      if (slug !== undefined) patch.slug = await uniqueSlug(slug || current.title, id);
      if (input.coverImage !== undefined) patch.coverImage = input.coverImage || undefined;
      if (status !== undefined) {
        patch.status = status;
        // Stamp publishedAt the first time it goes public; keep it thereafter.
        if (status === "published" && !current.publishedAt) patch.publishedAt = new Date();
      }
      const doc = await BlogPostModel.findByIdAndUpdate(id, patch, { new: true }).lean<PostDoc>();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      return full(doc);
    }),

  remove: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await connectToDatabase();
      await BlogPostModel.findByIdAndDelete(input.id);
      return { ok: true };
    }),
});
