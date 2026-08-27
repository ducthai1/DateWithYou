/**
 * The URL segments of the public feature pages, in the order the landing page
 * links to them.
 *
 * Deliberately a separate module from the content registry, and it must stay
 * that way. `nav-items.ts` needs this list — SpaceGuard reads it to decide
 * whether a route requires a space — and eight client components import
 * nav-items. Importing the full registry there pulled every paragraph and every
 * FAQ answer of all four marketing pages into a client chunk that every signed
 * in user downloads on every page: about 20KB of prose to derive four strings.
 *
 * This file imports nothing, so it costs four strings and no more.
 */
export const FEATURE_PAGE_SLUGS = [
  "hom-nay-an-gi",
  "luu-dia-diem-da-di",
  "nhat-ky-du-lich",
  "thu-gui-tuong-lai",
] as const;

export type FeaturePageSlug = (typeof FEATURE_PAGE_SLUGS)[number];

/**
 * Every publicly indexable marketing route, feature pages plus the hub that
 * lists them and the landing page itself.
 *
 * One list because three separate places need the same answer: the app-chrome
 * exclusions (a public route must not be treated as needing a space — get this
 * wrong and a visitor from a search result is bounced to onboarding), the
 * sitemap, and the robots build check. Adding /tinh-nang showed the previous
 * shape was too narrow: it spread FEATURE_PAGE_SLUGS, so a public page that was
 * not a feature page had to be remembered by hand in each of those places.
 */
export const MARKETING_ROUTES: string[] = [
  "/",
  "/tinh-nang",
  ...FEATURE_PAGE_SLUGS.map((slug) => `/${slug}`),
];
