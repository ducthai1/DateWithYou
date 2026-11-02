/**
 * What a pasted shop link already says about the thing in it.
 *
 * A Shopee product link carries the product's own name in its path —
 * `shopee.vn/Giày-Sneaker-Nam-Trắng-i.88201679.2185432011` — so the wishlist
 * can fill the name from the link with no network call at all. Fetching the
 * page instead was tried and dropped: Shopee renders its pages in the browser
 * and serves no title to a plain request, and a server that fetches whatever
 * URL a user pastes is a server that can be pointed at its own network.
 *
 * Only a path written with Vietnamese marks is trusted as a name. Lazada and
 * Tiki strip the marks ("dien-thoai-iphone-15"), and "Dien thoai" in the name
 * box is a chore to fix rather than a head start.
 */

const VN_MARKS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const MAX_NAME = 80;

/** A link, not a gift's name: a scheme, "www.", or a host with a path. */
export function looksLikeLink(text: string): boolean {
  const s = text.trim();
  if (!s || /\s/.test(s)) return false;
  return /^https?:\/\//i.test(s) || /^www\./i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(s);
}

export function nameFromProductLink(link: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`);
  } catch {
    return null;
  }
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (!last) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(last);
  } catch {
    return null;
  }
  const words = slug
    .replace(/-i\.\d+\.\d+$/, "") // Shopee: -i.<shop>.<item>
    .replace(/-i\d+(-s\d+)?\.html?$/i, "") // Lazada: -i<item>-s<sku>.html
    .replace(/-p\d+\.html?$/i, "") // Tiki: -p<id>.html
    .replace(/\.html?$/i, "")
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!VN_MARKS.test(words) || words.split(" ").length < 2) return null;
  if (words.length <= MAX_NAME) return words;
  const cut = words.slice(0, MAX_NAME);
  return cut.slice(0, cut.lastIndexOf(" ")).trim() || cut;
}
