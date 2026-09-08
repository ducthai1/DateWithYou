import { cldThumb } from "@/lib/cloudinary-url";

/**
 * The right size of a blog image for where it is shown.
 *
 * Covers come from two places. Cloudinary URLs resize themselves through the
 * transformation segment (`cldThumb`). The brand artwork shipped with the app
 * under /blog/img is static, so it is built in two widths — the 1200px file
 * for the article, and a `-640` twin for cards, where the full file was
 * costing 100–240 KB per thumbnail and twelve of them per index page.
 */
export function coverAt(url: string, width: 640 | 1200): string {
  if (url.startsWith("/blog/img/") && url.endsWith(".webp")) {
    return width <= 640 ? url.replace(/\.webp$/, "-640.webp") : url;
  }
  return width <= 640 ? cldThumb(url, 640) : url;
}
