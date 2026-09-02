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
 * Square thumbnail for the timeline grid.
 *
 * `dpr_auto` doubles it on a retina screen without doubling it on a laptop, so
 * the phone that needs the pixels is the only one paying for them.
 */
export function cldThumb(url: string, size = 400): string {
  return withTransform(url, `c_fill,g_auto,w_${size},h_${size},f_auto,q_auto,dpr_auto`);
}

/** Big enough to fill a dialog on any phone, far short of the original. */
export function cldPreview(url: string, width = 1000): string {
  return withTransform(url, `c_limit,w_${width},f_auto,q_auto,dpr_auto`);
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
