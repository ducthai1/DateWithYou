import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A blog category the admin can add, rename or reorder.
 *
 * `slug` is the stable key a post's `category` points at; renaming changes only
 * the display `name`, never the slug, so existing posts keep their link. `order`
 * sets how categories sort in menus and the editor's picker. Four defaults are
 * seeded on first read so the blog is never category-less.
 */
const blogCategorySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

export type BlogCategory = InferSchemaType<typeof blogCategorySchema>;

export const BlogCategoryModel =
  models.BlogCategory ?? model("BlogCategory", blogCategorySchema);
