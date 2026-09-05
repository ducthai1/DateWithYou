import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { BlogPostModel } from "@/server/db/models/blog-post";
import { BlogCategoryModel } from "@/server/db/models/blog-category";
import { slugify } from "@/lib/slug";

/**
 * Blog / marketing articles.
 *
 * Two audiences on one model: the public procedures only ever see published
 * posts and read the fields a list or a page needs; the admin procedures (gated
 * by ADMIN_EMAILS) manage every post in any state. The body is stored and
 * returned verbatim — the render side owns how it looks, not this router.
 */

/** Seeded once if the category collection is empty, so the blog always has some. */
const DEFAULT_CATEGORIES = [
  { slug: "tin-tuc", name: "Tin tức" },
  { slug: "tinh-nang", name: "Tính năng" },
  { slug: "meo-hay", name: "Mẹo hay" },
  { slug: "cap-nhat", name: "Cập nhật" },
];

type CategoryDoc = { slug: string; name: string; order?: number };

/** Insert the defaults the first time — idempotent and race-safe: slug is
 *  unique, so a duplicate insert from a concurrent request is ignored. */
async function ensureDefaultCategories() {
  const count = await BlogCategoryModel.estimatedDocumentCount();
  if (count > 0) return;
  await BlogCategoryModel.insertMany(
    DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i })),
    { ordered: false },
  ).catch(() => {
    /* Another request seeded them first — fine. */
  });
}

/** A category slug no other category holds — suffixes -2, -3… on collision. */
async function uniqueCategorySlug(base: string): Promise<string> {
  const root = slugify(base) || "danh-muc";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await BlogCategoryModel.findOne({ slug: candidate }).select("_id").lean();
    if (!clash) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** The filter every public query shares: published AND its time has come. A
 *  post scheduled for the future is published in the DB but stays hidden until
 *  then, so scheduling needs no cron — the clock in this filter does it. */
function liveFilter(extra: Record<string, unknown> = {}) {
  return { status: "published", publishedAt: { $lte: new Date() }, ...extra };
}

/** Escape a user string so it is a literal inside a RegExp. */
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  category: z.string().trim().min(1).max(40).default("tin-tuc"),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
  // An explicit publish time — omit to publish now; a future time schedules.
  publishedAt: z.coerce.date().optional(),
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
  categories: publicProcedure.query(async () => {
    await connectToDatabase();
    await ensureDefaultCategories();
    const rows = await BlogCategoryModel.find()
      .select("slug name order")
      .sort({ order: 1, name: 1 })
      .lean<CategoryDoc[]>();
    return rows.map((c) => ({ slug: c.slug, name: c.name, order: c.order ?? 0 }));
  }),

  /** Every published slug, for the sitemap. Two fields only. */
  sitemap: publicProcedure.query(async () => {
    await connectToDatabase();
    const rows = await BlogPostModel.find(liveFilter())
      .select("slug publishedAt updatedAt")
      .sort({ publishedAt: -1 })
      .limit(1000)
      .lean<{ slug: string; publishedAt?: Date; updatedAt?: Date }[]>();
    return rows.map((r) => ({
      slug: r.slug,
      lastModified: (r.updatedAt ?? r.publishedAt ?? null) as Date | null,
    }));
  }),

  list: publicProcedure
    .input(
      z.object({
        category: z.string().trim().min(1).max(40).optional(),
        tag: z.string().trim().min(1).max(30).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(24).default(9),
      }),
    )
    .query(async ({ input }) => {
      await connectToDatabase();
      const filter: Record<string, unknown> = liveFilter();
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
      const rows = await BlogPostModel.find(liveFilter({ featured: true }))
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
      const rows = await BlogPostModel.find(liveFilter())
        .select(CARD_FIELDS)
        .sort({ viewCount: -1, publishedAt: -1 })
        .limit(input?.limit ?? 5)
        .lean<PostDoc[]>();
      return rows.map(card);
    }),

  search: publicProcedure
    .input(z.object({ q: z.string().trim().min(1).max(80), limit: z.number().int().min(1).max(20).default(12) }))
    .query(async ({ input }) => {
      await connectToDatabase();
      const rx = new RegExp(escapeRegex(input.q), "i");
      const rows = await BlogPostModel.find(liveFilter({ $or: [{ title: rx }, { excerpt: rx }, { tags: rx }] }))
        .select(CARD_FIELDS)
        .sort({ publishedAt: -1 })
        .limit(input.limit)
        .lean<PostDoc[]>();
      return rows.map(card);
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1) }))
    .query(async ({ input }) => {
      await connectToDatabase();
      // A plain read: the page renders this statically (ISR), so counting a
      // view here would count once per revalidate, not once per reader. The
      // count is done by recordView, called from the page after it loads.
      const doc = await BlogPostModel.findOne(liveFilter({ slug: input.slug })).lean<PostDoc>();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      return full(doc);
    }),

  recordView: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
      await connectToDatabase();
      // Only a published post earns a view; a bad slug is a silent no-op, not
      // an error — a view beacon has nowhere to show one.
      await BlogPostModel.updateOne(liveFilter({ slug: input.slug }), { $inc: { viewCount: 1 } });
      return { ok: true };
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
      publishedAt: input.status === "published" ? (input.publishedAt ?? new Date()) : undefined,
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
        // Publishing with no explicit date stamps now, first time only; an explicit
        // publishedAt (carried in `rest`) reschedules — a future time hides it
        // until then, a past time makes it live at once.
        if (status === "published" && input.publishedAt === undefined && !current.publishedAt) {
          patch.publishedAt = new Date();
        }
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

  // ── Admin: categories ───────────────────────────────────────────────────
  categoryCreate: adminProcedure
    .input(z.object({ name: z.string().trim().min(1).max(60) }))
    .mutation(async ({ input }) => {
      await connectToDatabase();
      await ensureDefaultCategories();
      const slug = await uniqueCategorySlug(input.name);
      const top = await BlogCategoryModel.findOne().sort({ order: -1 }).select("order").lean<{ order?: number }>();
      const doc = await BlogCategoryModel.create({ slug, name: input.name, order: (top?.order ?? 0) + 1 });
      return { slug: doc.slug, name: doc.name, order: doc.order };
    }),

  categoryUpdate: adminProcedure
    .input(
      z.object({
        slug: z.string(),
        name: z.string().trim().min(1).max(60).optional(),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await connectToDatabase();
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.order !== undefined) patch.order = input.order;
      const doc = await BlogCategoryModel.findOneAndUpdate({ slug: input.slug }, patch, { new: true }).lean<CategoryDoc>();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      return { slug: doc.slug, name: doc.name, order: doc.order ?? 0 };
    }),

  categoryRemove: adminProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ input }) => {
      await connectToDatabase();
      const inUse = await BlogPostModel.countDocuments({ category: input.slug });
      if (inUse > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Còn ${inUse} bài đang thuộc danh mục này. Đổi danh mục các bài đó trước khi xoá.`,
        });
      }
      await BlogCategoryModel.deleteOne({ slug: input.slug });
      return { ok: true };
    }),
});
