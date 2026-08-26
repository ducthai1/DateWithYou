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
