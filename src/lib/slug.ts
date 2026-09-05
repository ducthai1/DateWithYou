import { toBaseLetters } from "./vietnamese-text";

/**
 * A URL slug from a Vietnamese title: accents folded, spaces to hyphens,
 * everything else dropped. "Tính năng mới: Bản đồ" → "tinh-nang-moi-ban-do".
 *
 * The slug is what a post is fetched by, so it is generated once and then owned
 * by the author — renaming a title must not silently change a published URL.
 */
export function slugify(input: string): string {
  return toBaseLetters(input)
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
