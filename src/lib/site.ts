/**
 * Canonical site identity used by every absolute-URL surface: metadata,
 * robots.txt, sitemap.xml, the web manifest and the JSON-LD block.
 *
 * Keeping the origin in one place matters because Next needs an absolute
 * `metadataBase` to expand Open Graph / canonical URLs — without it every
 * og:image and canonical link is emitted as a relative path, which crawlers
 * and link unfurlers silently drop.
 */

/**
 * Resolution order:
 *  1. NEXT_PUBLIC_SITE_URL  — set this once a custom domain is attached.
 *  2. VERCEL_PROJECT_PRODUCTION_URL — the stable production host on Vercel
 *     (unlike VERCEL_URL, which is the per-deployment host and would make the
 *     canonical URL point at a throwaway preview).
 *  3. The current production host, as a last resort.
 */
const RAW_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://vivu-noplan.vercel.app");

/** Origin with no trailing slash, so `${SITE_URL}/path` never doubles up. */
export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

export const SITE_NAME = "Vivu No Plan";

/** Used as the default <title> and as the og:title fallback. */
export const SITE_TITLE =
  "Vivu No Plan — giữ lại mọi chuyến đi, dù có plan hay không";

/**
 * ~155 characters: long enough to be descriptive, short enough that Google
 * shows it whole instead of truncating mid-sentence.
 *
 * Deliberately never names a relationship. The product works for whoever the
 * other person happens to be — and works alone as well — so calling it a
 * couples app turned everyone else away at the first line they read.
 *
 * It also avoids the opposite failure. An early rewrite said "hai người bất
 * kỳ", which is accurate, wider, and reads like a terms-of-service clause. The
 * fix for narrow copy is not neutral copy; it is copy that describes the
 * moments instead of the relationship, so a reader recognises themselves
 * without being sorted into a category first.
 */
export const SITE_DESCRIPTION =
  "Ghim quán đã ghé, lên lịch cuối tuần, để vòng quay chọn chỗ ăn lúc bí ý tưởng, và cất vài điều chưa muốn nói ra. Đi một mình hay rủ thêm một người đều được.";

export const SITE_LOCALE = "vi_VN";

/**
 * Brand spellings people actually type. Fed to the Organization node's
 * `alternateName`, which is the supported way to tell a search engine that
 * several strings mean the same brand — unlike a keywords meta tag, which
 * Google has ignored since 2009.
 */
export const SITE_ALTERNATE_NAMES = [
  "VivuNoPlan",
  "Vivu NoPlan",
  "Vi vu No Plan",
  "Vivu Plan",
  "Vivu",
  "Vi vu không cần plan",
  "Đi chơi không cần plan",
];

/**
 * Routes that hold couple-private data. Listed once and consumed by both
 * `robots.ts` (Disallow) and the `X-Robots-Tag` headers in `next.config.ts`.
 * Two layers on purpose: Disallow asks well-behaved crawlers not to fetch,
 * while the header keeps the page out of the index even if something links
 * straight to it and a crawler fetches anyway.
 */
export const PRIVATE_ROUTES = [
  "/calendar",
  "/library",
  "/map",
  "/timeline",
  "/trips",
  "/vault",
  "/wheel",
  "/settings",
  "/onboarding",
  "/home",
  "/activity",
  "/search",
] as const;

/**
 * Auth screens. Real pages, but thin and near-duplicate — indexing them only
 * competes with the landing page for the same brand query, so they stay
 * crawlable (follow) yet unindexed.
 */
export const NOINDEX_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
] as const;
