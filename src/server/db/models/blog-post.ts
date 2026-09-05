import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A marketing / announcement article.
 *
 * Body is the HTML the editor produced, stored and rendered as-is — the render
 * side must not reformat it (a lesson paid for across the GrowX CMS sites:
 * default CSS only, never `!important`, keep empty paragraphs, read colours the
 * editor writes as CSS variables). Everything the list needs — title, excerpt,
 * cover — is a top-level field so a list query never has to parse the body.
 *
 * `status` gates public visibility; only "published" is ever served publicly.
 * `featured` is the editor's pick for the hero; "popular" is derived from
 * `viewCount`, not a flag.
 */
const blogPostSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    excerpt: { type: String, default: "" },
    body: { type: String, default: "" },
    coverImage: { type: String },
    category: { type: String, default: "tin-tuc", index: true },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    featured: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    publishedAt: { type: Date },
    // Optional SEO overrides; fall back to title/excerpt when empty.
    metaTitle: { type: String },
    metaDescription: { type: String },
    authorId: { type: String, required: true },
    authorName: { type: String, default: "" },
  },
  { timestamps: true },
);

// Public list: published, newest first, optionally by category.
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ status: 1, category: 1, publishedAt: -1 });
// "Popular": published, by views.
blogPostSchema.index({ status: 1, viewCount: -1 });

export type BlogPost = InferSchemaType<typeof blogPostSchema>;

export const BlogPostModel = models.BlogPost ?? model("BlogPost", blogPostSchema);
