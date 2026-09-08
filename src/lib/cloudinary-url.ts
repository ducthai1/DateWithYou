/**
 * Ask Cloudinary for the size actually being displayed.
 *
 * Photos are stored as the delivery URL the upload returned, and that URL is the
 * ORIGINAL — a several-megabyte phone photo. It was being used unchanged for a
 * 120px thumbnail in the timeline grid, three per card, and then again at full
 * size inside the detail dialog. A screen of ten memories asked for tens of
 * megabytes to draw a few hundred pixels of pictures.
 *
 * Cloudinary reads transformations from the path segment right after `/upload/`,
 * so the same stored URL can serve every size without re-uploading anything or
 * migrating a single record.
 *
 * `f_auto` and `q_auto` are on every variant: they let Cloudinary pick AVIF or
 * WebP for browsers that take it and choose a quality that suits the image, which
 * is most of the saving before any resizing happens.
 */

/** Only rewrite what we recognise; anything else is returned untouched. */
const UPLOAD_MARKER = "/image/upload/";

function withTransform(url: string, transform: string): string {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  const i = url.indexOf(UPLOAD_MARKER);
  if (i === -1) return url;
  const head = url.slice(0, i + UPLOAD_MARKER.length);
  const tail = url.slice(i + UPLOAD_MARKER.length);
  // Already carries a transformation (a URL we built earlier): leave it alone
  // rather than stacking a second one on top.
  if (/^[a-z]{1,3}_[^/]+\//.test(tail)) return url;
  return `${head}${transform}/${tail}`;
}

/**
 * Square thumbnail, at exactly `size` DEVICE pixels.
 *
 * `dpr_auto` used to be here, on the belief that Cloudinary would double the
 * image on a retina screen. It does not, and cannot: it answers the browser's
 * `DPR` client hint, which is only sent by a page that opts in with an
 * `Accept-CH` header — and, for images on another origin, only with a
 * matching `Permissions-Policy` delegation as well. Neither is set here, so
 * `dpr_auto` resolved to 1 every single time. Measured against the same asset:
 * 8,846 bytes with no hint, 42,615 with `DPR: 3` — the identical byte count as
 * an explicit `dpr_3.0`. Every thumbnail in the app was therefore a 1x image
 * stretched over a 2x or 3x box, which is exactly how the calendar's day
 * photos came to look soft.
 *
 * The fix is to ask for the pixels outright and let the browser choose among
 * candidates (`cldThumbSrcSet`), which needs no headers and no guessing about
 * hint support.
 */
export function cldThumb(url: string, size = 400): string {
  return withTransform(url, `c_fill,g_auto,w_${size},h_${size},f_auto,q_auto`);
}

/**
 * The same crop at several sizes, as a `srcset` with width descriptors.
 *
 * Width descriptors rather than `2x`/`3x` ones because these boxes change size
 * with the breakpoint: paired with a `sizes` attribute the browser works out
 * the need from the layout AND the screen density, so a small phone cell does
 * not fetch the desktop image just because the screen is dense.
 */
export function cldThumbSrcSet(url: string, sizes: readonly number[]): string {
  if (!url.includes("res.cloudinary.com")) return "";
  return sizes.map((s) => `${cldThumb(url, s)} ${s}w`).join(", ");
}

/** Big enough to fill a dialog on any phone, far short of the original. */
export function cldPreview(url: string, width = 1000): string {
  // No dpr_auto here either (see cldThumb). Callers already pass a width
  // generous enough for a dialog on a dense screen, so nothing is scaled up:
  // 1000px of picture in a box a third that wide.
  return withTransform(url, `c_limit,w_${width},f_auto,q_auto`);
}

/**
 * The version behind the lightbox, for pinch-zooming into.
 *
 * Still capped: a 4000px original is more than any phone screen can show, and
 * the difference is invisible while the wait is not.
 */
export function cldFull(url: string, width = 2000): string {
  return withTransform(url, `c_limit,w_${width},f_auto,q_auto`);
}
